import { logger } from '@/shared/logger';
import { getConditionDisclaimer } from '@/shared/disclaimers';
import { Product, ProductRecommendation } from '@/types/product';
import { productDatabase, ProductSearchFilters } from './product-database';

export interface HealthAssessment {
  symptoms: string[];
  conditions: string[];
  severity: 'mild' | 'moderate' | 'severe';
  duration: 'acute' | 'chronic';
  goals: string[];
}

export interface RecommendationContext {
  customerAge?: number;
  gender?: 'male' | 'female';
  existingMedications?: string[];
  allergies?: string[];
  budget?: 'low' | 'medium' | 'high';
  previousPurchases?: string[];
}

export class ProductService {

  public async getProductRecommendations(
    healthAssessment: HealthAssessment, 
    context?: RecommendationContext
  ): Promise<ProductRecommendation[]> {
    try {
      // Get all relevant products based on health concerns
      const allConcerns = [...healthAssessment.symptoms, ...healthAssessment.conditions];
      const candidateProducts = await productDatabase.getProductRecommendations(allConcerns, 20);

      if (candidateProducts.length === 0) {
        logger.info('No products found for health concerns, returning general recommendations', {
          healthConcerns: allConcerns
        });
        // Return general wellness products if no specific matches
        const generalProducts = await productDatabase.getAllProducts({ 
          category: 'general_wellness', 
          inStock: true 
        });
        return generalProducts.slice(0, 3).map(product => ({
          product,
          relevanceScore: 0.5,
          reason: 'Produk kesehatan umum yang dapat membantu menjaga kesehatan Anda',
          benefits: product.benefits.slice(0, 3)
        }));
      }

      // Score and rank products
      const recommendations = candidateProducts.map(product => {
        const score = this.calculateRelevanceScore(product, healthAssessment, context);
        const reason = this.generateRecommendationReason(product, healthAssessment);
        const benefits = this.extractRelevantBenefits(product, healthAssessment);

        return {
          product,
          relevanceScore: score,
          reason,
          benefits
        };
      });

      // Sort by relevance score and return top recommendations
      const sortedRecommendations = recommendations
        .filter(rec => rec.relevanceScore > 0.2) // Minimum relevance threshold
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 5); // Top 5 recommendations

      logger.info('Generated product recommendations', {
        healthConcerns: allConcerns,
        candidateCount: candidateProducts.length,
        recommendationCount: sortedRecommendations.length,
        topScore: sortedRecommendations[0]?.relevanceScore || 0
      });

      return sortedRecommendations;

    } catch (error) {
      logger.error('Failed to generate product recommendations', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        healthAssessment 
      });
      throw error;
    }
  }

  private calculateRelevanceScore(
    product: Product, 
    assessment: HealthAssessment, 
    context?: RecommendationContext
  ): number {
    let score = 0;
    const productData = product.metadata as any;

    // Extract health conditions and symptoms from product metadata
    const productConditions = productData?.healthConditions || [];
    const productSymptoms = productData?.symptoms || [];

    // Direct condition matches (highest weight)
    const conditionMatches = assessment.conditions.filter(condition =>
      productConditions.some((pc: string) => 
        this.isHealthMatch(pc, condition)
      )
    );
    score += conditionMatches.length * 0.4;

    // Symptom matches (high weight)
    const symptomMatches = assessment.symptoms.filter(symptom =>
      productSymptoms.some((ps: string) => 
        this.isHealthMatch(ps, symptom)
      )
    );
    score += symptomMatches.length * 0.3;

    // Goal alignment through benefits (medium weight)
    const goalMatches = assessment.goals.filter(goal =>
      product.benefits.some(benefit => 
        this.isHealthMatch(benefit, goal)
      )
    );
    score += goalMatches.length * 0.2;

    // Category-specific scoring
    score += this.getCategoryScore(product.category, assessment) * 0.1;

    // Severity adjustment
    if (assessment.severity === 'severe') {
      score *= 1.2; // Boost for severe cases
    } else if (assessment.severity === 'mild') {
      score *= 0.9; // Slight reduction for mild cases
    }

    // Duration consideration
    if (assessment.duration === 'chronic') {
      score *= 1.1; // Boost for chronic conditions needing long-term support
    }

    // Context adjustments
    if (context) {
      score = this.applyContextAdjustments(score, product, context);
    }

    // Stock availability penalty
    if (!product.inStock) {
      score *= 0.1; // Heavily penalize out-of-stock products
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }

  private isHealthMatch(text1: string, text2: string): boolean {
    const normalize = (text: string) => text.toLowerCase().trim();
    const normalized1 = normalize(text1);
    const normalized2 = normalize(text2);

    // Direct match
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return true;
    }

    // Fuzzy matching for typos (similarity > 80%)
    if (this.calculateSimilarity(normalized1, normalized2) > 0.8) {
      return true;
    }

    // Indonesian health mapping
    const healthMappings = this.getIndonesianHealthMappings();
    
    for (const [indonesian, english] of Object.entries(healthMappings)) {
      if (english.length === 0) continue; // Skip if no English terms 
      
      // Direct mapping match
      if (
        (normalized1.includes(indonesian) || (english[0] && normalized1.includes(english[0]))) &&
        (normalized2.includes(indonesian) || english.some(eng => normalized2.includes(eng)))
      ) {
        return true;
      }

      // Fuzzy match against Indonesian term
      if (this.calculateSimilarity(normalized1, indonesian) > 0.8 || 
          this.calculateSimilarity(normalized2, indonesian) > 0.8) {
        return true;
      }

      // Fuzzy match against English equivalents
      for (const englishTerm of english) {
        if (this.calculateSimilarity(normalized1, englishTerm) > 0.8 || 
            this.calculateSimilarity(normalized2, englishTerm) > 0.8) {
          return true;
        }
      }
    }

    return false;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));
    
    // Initialize first row and column
    for (let i = 0; i <= str2.length; i++) {
      matrix[i]![0] = i;
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0]![j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1, // substitution
            matrix[i]![j - 1]! + 1,     // insertion
            matrix[i - 1]![j]! + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length]![str1.length]!;
  }

  private getCategoryScore(category: string, assessment: HealthAssessment): number {
    const categoryScoring = {
      'diabetes_support': assessment.conditions.some(c => 
        ['diabetes', 'gula darah', 'kencing manis'].some(term => c.toLowerCase().includes(term))
      ) ? 1.0 : 0,
      'cardiovascular': assessment.conditions.some(c => 
        ['jantung', 'hipertensi', 'darah tinggi', 'kolesterol'].some(term => c.toLowerCase().includes(term))
      ) ? 1.0 : 0,
      'digestive_health': assessment.symptoms.some(s => 
        ['maag', 'lambung', 'pencernaan', 'perut'].some(term => s.toLowerCase().includes(term))
      ) ? 1.0 : 0,
      'weight_management': assessment.goals.some(g => 
        ['diet', 'turun berat', 'kurus', 'gemuk'].some(term => g.toLowerCase().includes(term))
      ) ? 1.0 : 0,
      'immunity': assessment.symptoms.some(s => 
        ['lemah', 'sering sakit', 'imun'].some(term => s.toLowerCase().includes(term))
      ) ? 1.0 : 0,
      'general_wellness': 0.5 // Always somewhat relevant
    };

    return categoryScoring[category as keyof typeof categoryScoring] || 0;
  }

  private applyContextAdjustments(score: number, product: Product, context: RecommendationContext): number {
    let adjustedScore = score;

    // Budget considerations
    if (context.budget) {
      const budgetRanges = {
        'low': { max: 200000 },
        'medium': { min: 150000, max: 400000 },
        'high': { min: 300000 }
      };

      const range = budgetRanges[context.budget];
      if (context.budget === 'low' && 'max' in range && product.price > range.max) {
        adjustedScore *= 0.7; // Reduce score for expensive products on low budget
      } else if (context.budget === 'high' && 'min' in range && product.price > range.min) {
        adjustedScore *= 1.1; // Boost premium products for high budget
      }
    }

    // Age considerations
    if (context.customerAge) {
      if (context.customerAge > 60) {
        // Boost products suitable for elderly
        if (product.suitableFor.some(suit => 
          ['lansia', 'elderly', 'usia lanjut'].some(term => 
            suit.toLowerCase().includes(term)
          )
        )) {
          adjustedScore *= 1.15;
        }
      } else if (context.customerAge < 30) {
        // Boost products for young adults
        if (product.suitableFor.some(suit => 
          ['remaja', 'dewasa muda', 'aktif'].some(term => 
            suit.toLowerCase().includes(term)
          )
        )) {
          adjustedScore *= 1.1;
        }
      }
    }

    // Avoid recommending products with customer allergies
    if (context.allergies && context.allergies.length > 0) {
      const hasAllergen = product.ingredients.some(ingredient =>
        context.allergies!.some(allergy =>
          ingredient.toLowerCase().includes(allergy.toLowerCase())
        )
      );
      if (hasAllergen) {
        adjustedScore *= 0.1; // Heavily penalize products with allergens
      }
    }

    // Avoid duplicate recommendations from previous purchases
    if (context.previousPurchases && context.previousPurchases.includes(product.id)) {
      adjustedScore *= 0.5; // Reduce score for previously purchased products
    }

    return adjustedScore;
  }

  private generateRecommendationReason(product: Product, assessment: HealthAssessment): string {
    const reasons: string[] = [];
    const productData = product.metadata as any;

    // Check condition matches
    const productConditions = productData?.healthConditions || [];
    const matchedConditions = assessment.conditions.filter(condition =>
      productConditions.some((pc: string) => this.isHealthMatch(pc, condition))
    );

    if (matchedConditions.length > 0) {
      reasons.push(`Diformulasikan khusus untuk ${matchedConditions.join(', ')}`);
    }

    // Check symptom matches
    const productSymptoms = productData?.symptoms || [];
    const matchedSymptoms = assessment.symptoms.filter(symptom =>
      productSymptoms.some((ps: string) => this.isHealthMatch(ps, symptom))
    );

    if (matchedSymptoms.length > 0) {
      reasons.push(`Efektif mengatasi ${matchedSymptoms.join(', ')}`);
    }

    // Add product-specific benefits
    if (product.benefits.length > 0) {
      const topBenefits = product.benefits.slice(0, 2);
      reasons.push(`Memberikan manfaat: ${topBenefits.join(' dan ')}`);
    }

    // Add severity-specific reasoning
    if (assessment.severity === 'severe') {
      reasons.push('Formulasi kuat untuk kondisi yang memerlukan perhatian serius');
    } else if (assessment.severity === 'mild') {
      reasons.push('Pendekatan alami dan gentle untuk perawatan sehari-hari');
    }

    const baseReason = reasons.join('. ') || `${product.name} sangat sesuai untuk kebutuhan kesehatan Anda`;
    const disclaimer = getConditionDisclaimer(assessment.conditions);
    return `${baseReason}\n\n${disclaimer}`;
  }

  private extractRelevantBenefits(product: Product, assessment: HealthAssessment): string[] {
    const allConcerns = [...assessment.symptoms, ...assessment.conditions, ...assessment.goals];
    
    return product.benefits.filter(benefit =>
      allConcerns.some(concern =>
        this.isHealthMatch(benefit, concern)
      )
    ).slice(0, 3); // Top 3 relevant benefits
  }

  private getIndonesianHealthMappings(): Record<string, string[]> {
    return {
      // Digestive issues - Enhanced with colloquial terms
      'maag': ['gastritis', 'stomach acid', 'acid reflux', 'GERD'],
      'asam lambung': ['acid reflux', 'GERD', 'heartburn'],
      'perut kembung': ['bloating', 'gas', 'indigestion'],
      'begah': ['bloated', 'stuffed', 'overfull', 'distended'],
      'eneg': ['nauseous', 'sick', 'queasy'],
      'mulas': ['stomach cramps', 'abdominal pain', 'digestive pain'],
      'sembelit': ['constipation', 'digestive'],
      'diare': ['diarrhea', 'loose stool'],
      'pencernaan': ['digestion', 'digestive', 'gut health'],
      
      // Energy/Fatigue - Colloquial Indonesian terms  
      'lemes': ['weak', 'fatigue', 'low energy', 'tired'],
      'capek': ['tired', 'exhausted', 'fatigued'],
      'ngantuk': ['drowsy', 'sleepy', 'tired'],
      'lelah': ['fatigue', 'energy', 'stamina', 'tiredness'],
      'lemas': ['weakness', 'fatigue', 'low energy'],
      'drop': ['exhausted', 'energy crash', 'fatigue'],
      
      // Pain & Discomfort - Indonesian expressions
      'pegel': ['aching', 'sore', 'muscle pain', 'stiff'],
      'kliyengan': ['dizzy', 'lightheaded', 'vertigo'],
      'pusing': ['dizziness', 'headache'],
      
      // Respiratory - Regional variations
      'seseg': ['stuffy nose', 'nasal congestion', 'blocked nose'],
      'batuk': ['cough', 'respiratory'],
      'flu': ['cold', 'flu', 'respiratory'],
      
      // Cardiovascular - Enhanced detection
      'darah tinggi': ['hypertension', 'high blood pressure', 'cardiovascular'],
      'hipertensi': ['hypertension', 'high blood pressure', 'cardiovascular'],
      'tensi naik': ['high blood pressure', 'hypertension', 'cardiovascular'],
      'tensi tinggi': ['high blood pressure', 'hypertension', 'cardiovascular'],
      'tekanan darah tinggi': ['hypertension', 'high blood pressure', 'cardiovascular'],
      'kolesterol': ['cholesterol', 'lipid', 'cardiovascular'],
      'kolestrol': ['cholesterol', 'lipid', 'cardiovascular'],
      'jantung': ['heart', 'cardiovascular', 'cardiac'],
      'berdebar': ['palpitation', 'heart rate', 'cardiovascular'],
      
      // Product Names - Direct matching for mGanik products
      'mganik': ['diabetes', 'hypertension', 'cardiovascular', 'glucose', 'blood pressure'],
      'ganik': ['diabetes', 'hypertension', 'cardiovascular', 'glucose', 'blood pressure'],
      'metafiber': ['diabetes', 'glucose', 'blood sugar', 'fiber'],
      '3peptide': ['hypertension', 'blood pressure', 'cardiovascular', 'heart'],
      'peptide': ['hypertension', 'blood pressure', 'cardiovascular', 'heart'],
      'superfood': ['diabetes', 'glucose', 'moringa', 'kelor'],
      'kelor': ['diabetes', 'superfood', 'moringa'],
      'moringa': ['diabetes', 'superfood', 'kelor'],
      
      // Metabolic - Enhanced
      'diabetes': ['diabetes', 'blood sugar', 'glucose'],
      'diabates': ['diabetes', 'blood sugar', 'glucose'],
      'diabetis': ['diabetes', 'blood sugar', 'glucose'],
      'gula darah': ['blood sugar', 'glucose', 'diabetes'],
      'kencing manis': ['diabetes', 'blood sugar', 'glucose'],
      'sering haus': ['excessive thirst', 'polydipsia', 'diabetes'],
      'sering kencing': ['frequent urination', 'polyuria', 'diabetes'],
      'gemuk': ['obesity', 'weight loss', 'overweight'],
      'kegemukan': ['obesity', 'weight loss', 'overweight'],
      'berat badan naik': ['weight gain', 'obesity', 'overweight'],
      'kurus': ['weight gain', 'underweight'],
      'diet': ['weight management', 'weight loss'],
      
      // Mental Health & Sleep
      'stress': ['stress', 'anxiety', 'mental health'],
      'stres': ['stress', 'anxiety', 'mental health'],
      'tertekan': ['stress', 'anxiety', 'depression'],
      'beban pikiran': ['stress', 'mental health', 'anxiety'],
      'insomnia': ['sleep', 'insomnia', 'sleep disorder'],
      'susah tidur': ['insomnia', 'sleep difficulty', 'sleeplessness'],
      'tidak bisa tidur': ['insomnia', 'sleep difficulty'],
      'begadang': ['sleep disorder', 'insomnia', 'poor sleep'],
      
      // Immune system - Enhanced
      'imunitas': ['immunity', 'immune system'],
      'imun': ['immunity', 'immune'],
      'daya tahan tubuh': ['immunity', 'immune system'],
      'sering sakit': ['frequent illness', 'weak immunity'],
      'mudah sakit': ['frequent illness', 'low immunity', 'weak immune system'],
      'gampang flu': ['frequent illness', 'low immunity'],
      'imun turun': ['low immunity', 'weak immune system'],
      
      // Additional colloquial terms
      'badan remuk': ['body aches', 'muscle pain', 'fatigue'],
      'badan rasanya remuk': ['body aches', 'muscle pain'],
      'lambung perih': ['gastritis', 'stomach acid', 'GERD'],
      'lambung sakit': ['gastritis', 'stomach pain'],
      'ulu hati': ['heartburn', 'acid reflux', 'GERD'],
      'tenggorokan sakit': ['sore throat', 'throat pain'],
      'mata berat': ['tired eyes', 'sleepy', 'fatigue'],
      'kepala berat': ['headache', 'fatigue', 'stress'],
      'perut mual': ['nausea', 'stomach upset'],
      'mual-mual': ['nausea', 'morning sickness'],
      'badan panas': ['fever', 'body heat', 'infection'],
      'meriang': ['fever', 'chills', 'flu'],
      'flu berat': ['severe flu', 'respiratory infection'],
      'batuk berdahak': ['productive cough', 'respiratory'],
      'batuk kering': ['dry cough', 'respiratory'],
      'sesak napas': ['shortness of breath', 'respiratory'],
      'napas berat': ['difficulty breathing', 'respiratory'],
      'dada sesak': ['chest tightness', 'respiratory', 'cardiovascular']
    };
  }

  // Public API methods
  public async getProductById(id: string): Promise<Product | null> {
    try {
      return await productDatabase.getProductById(id);
    } catch (error) {
      logger.error('Failed to get product by ID in service', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        productId: id 
      });
      throw error;
    }
  }

  public async getAllProducts(filters?: ProductSearchFilters): Promise<Product[]> {
    try {
      return await productDatabase.getAllProducts(filters);
    } catch (error) {
      logger.error('Failed to get all products in service', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        filters 
      });
      throw error;
    }
  }

  public async getProductsByCategory(category: string): Promise<Product[]> {
    try {
      return await productDatabase.getProductsByCategory(category);
    } catch (error) {
      logger.error('Failed to get products by category in service', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        category 
      });
      throw error;
    }
  }

  public async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    try {
      return await productDatabase.createProduct(productData);
    } catch (error) {
      logger.error('Failed to create product in service', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        productName: productData.name 
      });
      throw error;
    }
  }

  public async updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
    try {
      return await productDatabase.updateProduct(id, updates);
    } catch (error) {
      logger.error('Failed to update product in service', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        productId: id 
      });
      throw error;
    }
  }

  public async deleteProduct(id: string): Promise<boolean> {
    try {
      return await productDatabase.deleteProduct(id);
    } catch (error) {
      logger.error('Failed to delete product in service', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        productId: id 
      });
      throw error;
    }
  }

  public async searchProductsInIndonesian(query: string): Promise<Product[]> {
    try {
      const normalizedQuery = query.toLowerCase().trim();
      
      // Map Indonesian terms to health conditions
      const mappedConditions: string[] = [];
      const healthMappings = this.getIndonesianHealthMappings();
      
      for (const [indonesian, english] of Object.entries(healthMappings)) {
        if (normalizedQuery.includes(indonesian)) {
          mappedConditions.push(indonesian, ...english);
        }
      }

      // If no mapping found, use original query
      if (mappedConditions.length === 0) {
        mappedConditions.push(normalizedQuery);
      }

      // Search products using health conditions and symptoms
      return await productDatabase.getProductRecommendations(mappedConditions, 10);

    } catch (error) {
      logger.error('Failed to search products in Indonesian', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        query 
      });
      throw error;
    }
  }

  public async getProductStatistics(): Promise<{
    totalProducts: number;
    productsByCategory: Record<string, number>;
    inStockCount: number;
    averagePrice: number;
  }> {
    try {
      const allProducts = await productDatabase.getAllProducts();
      
      const statistics = {
        totalProducts: allProducts.length,
        productsByCategory: {} as Record<string, number>,
        inStockCount: allProducts.filter(p => p.inStock).length,
        averagePrice: allProducts.length > 0 
          ? allProducts.reduce((sum, p) => sum + p.price, 0) / allProducts.length 
          : 0
      };

      // Count products by category
      allProducts.forEach(product => {
        statistics.productsByCategory[product.category] = 
          (statistics.productsByCategory[product.category] || 0) + 1;
      });

      return statistics;

    } catch (error) {
      logger.error('Failed to get product statistics', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}

export const productService = new ProductService();