import { logger } from '@/shared/logger';
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

    // Indonesian health mapping
    const healthMappings = this.getIndonesianHealthMappings();
    
    for (const [indonesian, english] of Object.entries(healthMappings)) {
      if (english.length === 0) continue; // Skip if no English terms 
      
      if (
        (normalized1.includes(indonesian) || (english[0] && normalized1.includes(english[0]))) &&
        (normalized2.includes(indonesian) || english.some(eng => normalized2.includes(eng)))
      ) {
        return true;
      }
    }

    return false;
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

    return reasons.join('. ') || `${product.name} sangat sesuai untuk kebutuhan kesehatan Anda`;
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
      // Digestive issues
      'maag': ['gastritis', 'stomach acid', 'acid reflux', 'GERD'],
      'asam lambung': ['acid reflux', 'GERD', 'heartburn'],
      'perut kembung': ['bloating', 'gas', 'indigestion'],
      'sembelit': ['constipation', 'digestive'],
      'diare': ['diarrhea', 'loose stool'],
      'pencernaan': ['digestion', 'digestive', 'gut health'],
      
      // Cardiovascular
      'darah tinggi': ['hypertension', 'high blood pressure'],
      'hipertensi': ['hypertension', 'high blood pressure'],
      'kolesterol': ['cholesterol', 'lipid'],
      'jantung': ['heart', 'cardiovascular', 'cardiac'],
      
      // Metabolic
      'diabetes': ['diabetes', 'blood sugar', 'glucose'],
      'gula darah': ['blood sugar', 'glucose', 'diabetes'],
      'gemuk': ['obesity', 'weight loss', 'overweight'],
      'kurus': ['weight gain', 'underweight'],
      'diet': ['weight management', 'weight loss'],
      
      // General symptoms
      'lelah': ['fatigue', 'energy', 'stamina', 'tiredness'],
      'pusing': ['dizziness', 'headache'],
      'stress': ['stress', 'anxiety', 'mental health'],
      'insomnia': ['sleep', 'insomnia', 'sleep disorder'],
      'lemas': ['weakness', 'fatigue', 'low energy'],
      
      // Immune system
      'imunitas': ['immunity', 'immune system'],
      'imun': ['immunity', 'immune'],
      'flu': ['cold', 'flu', 'respiratory'],
      'batuk': ['cough', 'respiratory'],
      'sering sakit': ['frequent illness', 'weak immunity']
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