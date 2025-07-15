/**
 * Contextual Scoring Engine
 * Advanced product relevance scoring with temporal context, severity weighting, and user profile alignment
 */

import { logger } from '@/shared/logger';
import { Product } from '@/types/product';
import { 
  EnhancedHealthAssessment,
  ContextualProductRecommendation,
  ContextualReason,
  TemporalContext,
  UserHealthProfile,
  ExtractedSymptom,
  ExtractedCondition,
  ScoringWeights,
  ScoringContext
} from '@/types/health-intelligence';
import { enhancedHealthMappingService } from './enhanced-health-mapping';

// ScoringContext is now imported from types

export class ContextualScoringEngine {
  private readonly maxScore = 1.0;
  private readonly minRelevanceThreshold = 0.2;

  constructor() {
    logger.info('Contextual Scoring Engine initialized with multi-dimensional scoring algorithms');
  }

  /**
   * Calculate contextual relevance score for product recommendations
   */
  public calculateContextualScore(
    product: Product,
    healthAssessment: EnhancedHealthAssessment,
    context?: ScoringContext
  ): ContextualProductRecommendation {
    const startTime = Date.now();

    try {
      // Get scoring weights from health categories
      const categoryWeights = this.getCategoryWeights(healthAssessment);
      
      // Calculate base relevance scores
      const symptomScore = this.calculateSymptomRelevance(product, healthAssessment.symptoms, categoryWeights);
      const conditionScore = this.calculateConditionRelevance(product, healthAssessment.conditions, categoryWeights);
      const temporalScore = this.calculateTemporalRelevance(product, healthAssessment.temporalContext);
      const severityScore = this.calculateSeverityAlignment(product, healthAssessment.severity);
      
      // Apply contextual multipliers
      const profileScore = context?.userProfile ? 
        this.calculateProfileAlignment(product, context.userProfile) : 0.5;
      const urgencyScore = context?.urgencyLevel ? 
        this.calculateUrgencyAlignment(product, context.urgencyLevel) : 0.5;

      // Weighted final score calculation
      const baseScore = (
        symptomScore.score * categoryWeights.symptomMatch +
        conditionScore.score * categoryWeights.conditionMatch +
        temporalScore.score * categoryWeights.durationBonus +
        severityScore.score * categoryWeights.severityMultiplier
      );

      const contextualMultiplier = (
        profileScore * categoryWeights.userProfileAlignment +
        urgencyScore * categoryWeights.contextualRelevance
      );

      const finalScore = Math.min(baseScore * (1 + contextualMultiplier), this.maxScore);

      // Generate contextual reasons
      const reasons = this.generateContextualReasons([
        symptomScore,
        conditionScore,
        temporalScore,
        severityScore
      ]);

      // Create recommendation
      const recommendation: ContextualProductRecommendation = {
        product,
        relevanceScore: finalScore,
        contextualReasons: reasons,
        benefits: this.extractRelevantBenefits(product, healthAssessment),
        urgencyLevel: context?.urgencyLevel || 'routine'
      };

      const duration = Date.now() - startTime;
      logger.debug('Contextual score calculated', {
        productName: product.name,
        finalScore: finalScore.toFixed(3),
        symptomMatches: symptomScore.matches,
        conditionMatches: conditionScore.matches,
        duration
      });

      return recommendation;

    } catch (error) {
      logger.error('Failed to calculate contextual score', {
        error: error instanceof Error ? error.message : 'Unknown error',
        productId: product.id
      });
      
      // Fallback to basic recommendation
      return {
        product,
        relevanceScore: 0.3,
        contextualReasons: [{
          type: 'condition_match',
          explanation: 'Produk umum untuk kesehatan',
          confidence: 0.3,
          supportingEvidence: []
        }],
        benefits: product.benefits.slice(0, 3),
        urgencyLevel: 'routine'
      };
    }
  }

  /**
   * Batch score multiple products for ranking
   */
  public scoreProductBatch(
    products: Product[],
    healthAssessment: EnhancedHealthAssessment,
    context?: ScoringContext,
    limit: number = 5
  ): ContextualProductRecommendation[] {
    const scoredProducts = products
      .map(product => this.calculateContextualScore(product, healthAssessment, context))
      .filter(rec => rec.relevanceScore >= this.minRelevanceThreshold)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    logger.info('Product batch scored', {
      totalProducts: products.length,
      qualifyingProducts: scoredProducts.length,
      topScore: scoredProducts[0]?.relevanceScore || 0,
      averageScore: scoredProducts.length > 0 ? 
        scoredProducts.reduce((sum, rec) => sum + rec.relevanceScore, 0) / scoredProducts.length : 0
    });

    return scoredProducts;
  }

  // Private scoring methods

  private calculateSymptomRelevance(
    product: Product, 
    symptoms: ExtractedSymptom[],
    _weights: ScoringWeights
  ): { score: number, matches: string[], confidence: number } {
    if (symptoms.length === 0) return { score: 0, matches: [], confidence: 0 };

    const productMetadata = product.metadata as any;
    const productSymptoms = productMetadata?.symptoms || [];
    const matches: string[] = [];
    let totalScore = 0;
    let totalConfidence = 0;

    symptoms.forEach(symptom => {
      // Check direct symptom matches
      const directMatch = productSymptoms.some((ps: string) => 
        this.isHealthTermMatch(ps.toLowerCase(), symptom.term.toLowerCase()) ||
        symptom.mappedTerms.some(mapped => ps.toLowerCase().includes(mapped.toLowerCase()))
      );

      if (directMatch) {
        const confidence = symptom.confidence;
        const severityBonus = this.getSeverityBonus(symptom.severity);
        const score = confidence * severityBonus;
        
        totalScore += score;
        totalConfidence += confidence;
        matches.push(symptom.term);
      }

      // Check contextual clues in product benefits
      const contextualMatch = product.benefits.some(benefit => 
        symptom.contextClues.some(clue => 
          benefit.toLowerCase().includes(clue.toLowerCase())
        )
      );

      if (contextualMatch && !directMatch) {
        totalScore += symptom.confidence * 0.5; // Lower score for contextual matches
        totalConfidence += symptom.confidence * 0.5;
        matches.push(`${symptom.term} (contextual)`);
      }
    });

    const averageScore = symptoms.length > 0 ? totalScore / symptoms.length : 0;
    const averageConfidence = symptoms.length > 0 ? totalConfidence / symptoms.length : 0;

    return {
      score: Math.min(averageScore, 1.0),
      matches,
      confidence: averageConfidence
    };
  }

  private calculateConditionRelevance(
    product: Product,
    conditions: ExtractedCondition[],
    weights: ScoringWeights
  ): { score: number, matches: string[], confidence: number } {
    if (conditions.length === 0) return { score: 0, matches: [], confidence: 0 };

    const productMetadata = product.metadata as any;
    const productConditions = productMetadata?.healthConditions || [];
    const matches: string[] = [];
    let totalScore = 0;
    let totalConfidence = 0;

    conditions.forEach(condition => {
      const directMatch = productConditions.some((pc: string) => 
        this.isHealthTermMatch(pc.toLowerCase(), condition.term.toLowerCase()) ||
        condition.mappedTerms.some(mapped => pc.toLowerCase().includes(mapped.toLowerCase()))
      );

      if (directMatch) {
        const confidence = condition.confidence;
        const severityBonus = this.getSeverityBonus(condition.severity);
        const conditionWeight = weights.conditionMatch || 0.3;
        const score = confidence * severityBonus * conditionWeight;
        
        totalScore += score;
        totalConfidence += confidence;
        matches.push(condition.term);
      }
    });

    const averageScore = conditions.length > 0 ? totalScore / conditions.length : 0;
    const averageConfidence = conditions.length > 0 ? totalConfidence / conditions.length : 0;

    return {
      score: Math.min(averageScore, 1.0),
      matches,
      confidence: averageConfidence
    };
  }

  private calculateTemporalRelevance(
    product: Product,
    temporalContext: TemporalContext
  ): { score: number, matches: string[], confidence: number } {
    let score = 0.5; // Base temporal score
    const matches: string[] = [];

    // Duration-based scoring
    const productMetadata = product.metadata as any;
    const productFeatures = productMetadata?.specialFeatures || {};

    if (temporalContext.duration === 'acute') {
      // Favor fast-acting products for acute conditions
      if (productFeatures.fastActing || product.name.toLowerCase().includes('instant')) {
        score += 0.3;
        matches.push('fast-acting for acute condition');
      }
    } else if (temporalContext.duration === 'chronic') {
      // Favor long-term support products for chronic conditions
      if (productFeatures.longTermSupport || product.name.toLowerCase().includes('support')) {
        score += 0.3;
        matches.push('long-term support for chronic condition');
      }
    }

    // Frequency-based scoring
    if (temporalContext.frequency === 'constant') {
      // Favor sustained-release or daily products
      if (product.dosage.toLowerCase().includes('daily') || product.dosage.toLowerCase().includes('rutin')) {
        score += 0.2;
        matches.push('daily use for constant symptoms');
      }
    }

    return {
      score: Math.min(score, 1.0),
      matches,
      confidence: 0.7
    };
  }

  private calculateSeverityAlignment(
    product: Product,
    severity: string
  ): { score: number, matches: string[], confidence: number } {
    let score = 0.5;
    const matches: string[] = [];

    const productMetadata = product.metadata as any;
    const productStrength = productMetadata?.strength || 'moderate';

    // Align product strength with condition severity
    const severityToStrength = {
      'mild': ['mild', 'gentle', 'light'],
      'moderate': ['moderate', 'standard', 'regular'],
      'severe': ['strong', 'potent', 'intensive', 'maximum']
    };

    const appropriateStrengths = severityToStrength[severity as keyof typeof severityToStrength] || ['moderate'];
    
    if (appropriateStrengths.includes(productStrength)) {
      score += 0.3;
      matches.push(`${productStrength} strength for ${severity} condition`);
    }

    // Check product warnings for severity indicators
    if (product.warnings && product.warnings.length > 0) {
      const hasIntensiveWarnings = product.warnings.some(warning => 
        warning.toLowerCase().includes('severe') || 
        warning.toLowerCase().includes('serious')
      );

      if (severity === 'severe' && hasIntensiveWarnings) {
        score += 0.2;
        matches.push('appropriate for severe conditions');
      }
    }

    return {
      score: Math.min(score, 1.0),
      matches,
      confidence: 0.8
    };
  }

  private calculateProfileAlignment(
    product: Product,
    profile: UserHealthProfile
  ): number {
    let alignmentScore = 0.5;

    // Age-based alignment
    if (profile.age) {
      const productSuitability = product.suitableFor;
      if (profile.age > 60 && productSuitability.some(suit => 
        suit.toLowerCase().includes('lansia') || suit.toLowerCase().includes('elderly')
      )) {
        alignmentScore += 0.2;
      } else if (profile.age < 30 && productSuitability.some(suit => 
        suit.toLowerCase().includes('dewasa muda') || suit.toLowerCase().includes('aktif')
      )) {
        alignmentScore += 0.2;
      }
    }

    // Chronic conditions alignment
    if (profile.chronicalConditions.length > 0) {
      const productMetadata = product.metadata as any;
      const productConditions = productMetadata?.healthConditions || [];
      
      const hasRelevantCondition = profile.chronicalConditions.some(condition =>
        productConditions.some((pc: string) => 
          pc.toLowerCase().includes(condition.toLowerCase())
        )
      );

      if (hasRelevantCondition) {
        alignmentScore += 0.3;
      }
    }

    return Math.min(alignmentScore, 1.0);
  }

  private calculateUrgencyAlignment(
    product: Product,
    urgencyLevel: 'routine' | 'soon' | 'urgent' | 'emergency'
  ): number {
    const productMetadata = product.metadata as any;
    const productFeatures = productMetadata?.specialFeatures || {};

    const urgencyScoring = {
      'routine': 0.5,
      'soon': productFeatures.fastActing ? 0.8 : 0.6,
      'urgent': productFeatures.fastActing ? 1.0 : 0.3,
      'emergency': 0.2 // Emergency cases should seek medical attention
    };

    return urgencyScoring[urgencyLevel];
  }

  private getCategoryWeights(healthAssessment: EnhancedHealthAssessment): ScoringWeights {
    // Get category weights from the first health category found
    const firstSymptom = healthAssessment.symptoms[0];
    const firstCondition = healthAssessment.conditions[0];
    
    let categoryId = 'general';
    if (firstCondition) {
      categoryId = firstCondition.medicalCategory;
    } else if (firstSymptom) {
      // Infer category from symptom (this would need enhancement)
      categoryId = 'general';
    }

    const category = enhancedHealthMappingService.getHealthCategory(categoryId);
    
    return category?.scoringWeights || {
      symptomMatch: 0.3,
      conditionMatch: 0.3,
      severityMultiplier: 1.0,
      durationBonus: 0.1,
      contextualRelevance: 0.2,
      userProfileAlignment: 0.1
    };
  }

  private getSeverityBonus(severity: string): number {
    const severityMultipliers = {
      'mild': 0.8,
      'moderate': 1.0,
      'severe': 1.3,
      'any': 1.0
    };
    
    return severityMultipliers[severity as keyof typeof severityMultipliers] || 1.0;
  }

  private isHealthTermMatch(term1: string, term2: string): boolean {
    // Enhanced matching logic
    const normalized1 = term1.toLowerCase().trim();
    const normalized2 = term2.toLowerCase().trim();
    
    return normalized1.includes(normalized2) || 
           normalized2.includes(normalized1) ||
           this.calculateSimilarity(normalized1, normalized2) > 0.8;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple similarity calculation (could be enhanced)
    if (str1 === str2) return 1.0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));
    
    for (let i = 0; i <= str2.length; i++) matrix[i]![0] = i;
    for (let j = 0; j <= str1.length; j++) matrix[0]![j] = j;
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1,
            matrix[i]![j - 1]! + 1,
            matrix[i - 1]![j]! + 1
          );
        }
      }
    }
    
    return matrix[str2.length]![str1.length]!;
  }

  private generateContextualReasons(
    scoreResults: Array<{ score: number, matches: string[], confidence: number }>
  ): ContextualReason[] {
    const reasons: ContextualReason[] = [];

    scoreResults.forEach((result, index) => {
      if (result.score > 0.3 && result.matches.length > 0) {
        const reasonTypes: ContextualReason['type'][] = [
          'symptom_match', 'condition_match', 'duration_suitable', 'severity_appropriate'
        ];
        
        reasons.push({
          type: reasonTypes[index] || 'symptom_match',
          explanation: `Cocok berdasarkan ${result.matches.join(', ')}`,
          confidence: result.confidence,
          supportingEvidence: result.matches
        });
      }
    });

    return reasons;
  }

  private extractRelevantBenefits(
    product: Product,
    healthAssessment: EnhancedHealthAssessment
  ): string[] {
    const allTerms = [
      ...healthAssessment.symptoms.map(s => s.term),
      ...healthAssessment.conditions.map(c => c.term),
      ...healthAssessment.goals
    ];

    return product.benefits.filter(benefit =>
      allTerms.some(term =>
        benefit.toLowerCase().includes(term.toLowerCase())
      )
    ).slice(0, 3);
  }
}

export const contextualScoringEngine = new ContextualScoringEngine();