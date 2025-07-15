/**
 * Enhanced Product Service
 * Integrates enhanced health mapping, contextual scoring, and smart conversation systems
 */

import { logger } from '@/shared/logger';
import { Product } from '@/types/product';
import { ProductService, HealthAssessment, RecommendationContext } from '@/products/product-service';
import { productDatabase } from '@/products/product-database';
import { 
  EnhancedHealthAssessment,
  ContextualProductRecommendation,
  ExtractedHealthData,
  ScoringContext
} from '@/types/health-intelligence';
import { enhancedHealthMappingService } from './enhanced-health-mapping';
import { contextualScoringEngine } from './contextual-scoring-engine';
import { ConversationContext } from '@/claude/claude-service';

export class EnhancedProductService extends ProductService {
  
  constructor() {
    super();
    logger.info('Enhanced Product Service initialized with intelligent health mapping and contextual scoring');
  }

  /**
   * Get product recommendations using enhanced health assessment
   */
  public async getEnhancedProductRecommendations(
    message: string,
    context: ConversationContext,
    recommendationContext?: RecommendationContext
  ): Promise<ContextualProductRecommendation[]> {
    const startTime = Date.now();

    try {
      // Extract enhanced health data from message
      const extractedHealthData = this.extractEnhancedHealthData(message, context);
      
      // Convert to enhanced health assessment
      const enhancedAssessment = this.createEnhancedHealthAssessment(extractedHealthData, context);
      
      // Get candidate products using base service
      const candidateProducts = await this.getCandidateProducts(enhancedAssessment);
      
      // Create scoring context
      const scoringContext = this.createScoringContext(context, recommendationContext);
      
      // Score products using contextual engine
      const contextualRecommendations = contextualScoringEngine.scoreProductBatch(
        candidateProducts,
        enhancedAssessment,
        scoringContext,
        5 // Top 5 recommendations
      );

      const duration = Date.now() - startTime;
      logger.info('Enhanced product recommendations generated', {
        userId: context.userId,
        candidateProducts: candidateProducts.length,
        finalRecommendations: contextualRecommendations.length,
        topScore: contextualRecommendations[0]?.relevanceScore || 0,
        duration
      });

      return contextualRecommendations;

    } catch (error) {
      logger.error('Failed to generate enhanced product recommendations', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: context.userId
      });

      // Fallback to basic recommendations
      return this.getFallbackRecommendations(message, context, recommendationContext);
    }
  }

  /**
   * Convert basic health assessment to enhanced assessment with extracted data
   */
  public createEnhancedHealthAssessment(
    extractedHealthData: ExtractedHealthData,
    context: ConversationContext
  ): EnhancedHealthAssessment {
    // Extract basic assessment for compatibility
    const basicAssessment = this.extractBasicHealthAssessment(
      context.messages.map(m => typeof m.content === 'string' ? m.content : '').join(' ')
    );

    return {
      symptoms: extractedHealthData.symptoms,
      conditions: extractedHealthData.conditions,
      severity: extractedHealthData.severityAssessment.overall,
      duration: extractedHealthData.temporalContext.duration || 'unknown',
      goals: basicAssessment.goals,
      temporalContext: extractedHealthData.temporalContext,
      contextualFactors: [], // Could be enhanced further
      informationGaps: []
    };
  }

  /**
   * Extract enhanced health data from conversation
   */
  private extractEnhancedHealthData(message: string, context: ConversationContext): ExtractedHealthData {
    // Combine current message with recent conversation history
    const recentMessages = context.messages
      .slice(-3)
      .map(m => typeof m.content === 'string' ? m.content : '')
      .join(' ');
    
    const fullContext = `${recentMessages} ${message}`;

    // Extract health terms using enhanced mapping
    const { symptoms, conditions } = enhancedHealthMappingService.extractHealthTerms(fullContext);
    
    // Extract temporal context
    const temporalContext = enhancedHealthMappingService.extractTemporalContext(fullContext);
    
    // Assess severity
    const severityAssessment = this.assessSeverity(symptoms, conditions, fullContext);
    
    // Build user profile from context
    const userProfile = this.buildUserProfile(context);

    return {
      symptoms,
      conditions,
      temporalContext,
      severityAssessment,
      userProfile
    };
  }

  /**
   * Get candidate products using enhanced criteria
   */
  private async getCandidateProducts(assessment: EnhancedHealthAssessment): Promise<Product[]> {
    // Collect all health terms for search
    const searchTerms = [
      ...assessment.symptoms.map(s => s.term),
      ...assessment.conditions.map(c => c.term),
      ...assessment.goals
    ];

    if (searchTerms.length === 0) {
      // Return general wellness products if no specific terms
      return await this.getAllProducts({ category: 'general_wellness', inStock: true });
    }

    // Use database to get initial candidates
    const candidates = await productDatabase.getProductRecommendations(searchTerms, 20);
    
    // Filter by stock and basic criteria
    return candidates.filter(product => 
      product.inStock && 
      product.price > 0
    );
  }

  /**
   * Create scoring context from conversation context
   */
  private createScoringContext(
    context: ConversationContext,
    _recommendationContext?: RecommendationContext
  ): ScoringContext {
    const userProfile = this.buildUserProfile(context);
    
    return {
      userProfile,
      conversationHistory: context.messages.map(m => typeof m.content === 'string' ? m.content : ''),
      previousRecommendations: context.metadata?.mentionedProducts || [],
      urgencyLevel: 'routine', // Could be enhanced based on message analysis
      consultationDepth: context.metadata?.userPreferences?.communicationStyle === 'detailed' ? 'comprehensive' : 'basic'
    };
  }

  /**
   * Build user health profile from conversation context
   */
  private buildUserProfile(context: ConversationContext): any {
    const allText = context.messages
      .map(m => typeof m.content === 'string' ? m.content : '')
      .join(' ')
      .toLowerCase();

    // Extract age
    const ageMatch = allText.match(/(umur|usia)\s*(\d{1,2})/i) || allText.match(/(\d{1,2})\s*tahun/i);
    const age = ageMatch ? parseInt(ageMatch[2] || ageMatch[1]!) : undefined;

    // Extract gender
    let gender: 'male' | 'female' | undefined;
    if (allText.includes('wanita') || allText.includes('perempuan') || allText.includes('cewek')) {
      gender = 'female';
    } else if (allText.includes('pria') || allText.includes('laki') || allText.includes('cowok')) {
      gender = 'male';
    }

    // Extract chronic conditions
    const chronicalConditions: string[] = [];
    if (allText.includes('diabetes')) chronicalConditions.push('diabetes');
    if (allText.includes('hipertensi') || allText.includes('darah tinggi')) chronicalConditions.push('hypertension');
    if (allText.includes('kolesterol')) chronicalConditions.push('cholesterol');

    // Communication preference
    const communicationPreference = context.metadata?.userPreferences?.communicationStyle || 'conversational';

    return {
      age,
      gender,
      chronicalConditions,
      medicationHistory: [], // Could be extracted with more sophisticated parsing
      lifestyleFactors: [], // Could be extracted from lifestyle questions
      communicationPreference
    };
  }

  /**
   * Assess severity from extracted health data
   */
  private assessSeverity(symptoms: any[], conditions: any[], fullContext: string): any {
    let maxSeverity = 'mild';
    let urgency: 'routine' | 'soon' | 'urgent' | 'emergency' = 'routine';

    // Find highest severity from symptoms and conditions
    [...symptoms, ...conditions].forEach(item => {
      const itemSeverity = item.severity || 'mild';
      if (itemSeverity === 'severe') maxSeverity = 'severe';
      else if (itemSeverity === 'moderate' && maxSeverity !== 'severe') maxSeverity = 'moderate';
    });

    // Check for urgent language
    const urgentMarkers = ['parah', 'sangat', 'banget', 'tidak tahan', 'emergency'];
    const lowerContext = fullContext.toLowerCase();
    
    if (urgentMarkers.some(marker => lowerContext.includes(marker))) {
      if (maxSeverity === 'severe') urgency = 'urgent';
      else urgency = 'soon';
    }

    return {
      overall: maxSeverity,
      impact: maxSeverity === 'severe' ? 'severe' : 
              maxSeverity === 'moderate' ? 'moderate' : 'minimal',
      urgency,
      functionalImpact: maxSeverity === 'severe' ? 8 : 
                       maxSeverity === 'moderate' ? 5 : 2
    };
  }

  /**
   * Extract basic health assessment for compatibility with existing system
   */
  private extractBasicHealthAssessment(fullText: string): HealthAssessment {
    // Use existing logic from parent class for compatibility
    const lowerText = fullText.toLowerCase();
    
    // Extract symptoms using existing keyword matching
    const symptoms: string[] = [];
    const symptomKeywords = {
      'sakit kepala': ['sakit kepala', 'pusing', 'migrain'],
      'mual': ['mual', 'muntah', 'eneg'],
      'lelah': ['lelah', 'capek', 'lemas', 'fatigue'],
      // Add more as needed
    };

    for (const [symptom, keywords] of Object.entries(symptomKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        symptoms.push(symptom);
      }
    }

    // Extract conditions
    const conditions: string[] = [];
    const conditionKeywords = {
      'diabetes': ['diabetes', 'diabates', 'gula darah', 'kencing manis'],
      'hipertensi': ['hipertensi', 'darah tinggi', 'tensi tinggi'],
      // Add more as needed
    };

    for (const [condition, keywords] of Object.entries(conditionKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        conditions.push(condition);
      }
    }

    // Determine severity
    let severity: 'mild' | 'moderate' | 'severe' = 'mild';
    if (lowerText.includes('sangat') || lowerText.includes('parah')) {
      severity = 'severe';
    } else if (lowerText.includes('cukup') || lowerText.includes('lumayan')) {
      severity = 'moderate';
    }

    // Determine duration
    let duration: 'acute' | 'chronic' = 'acute';
    if (lowerText.includes('lama') || lowerText.includes('kronik')) {
      duration = 'chronic';
    }

    // Extract goals
    const goals: string[] = [];
    if (lowerText.includes('turun berat') || lowerText.includes('diet')) {
      goals.push('weight_loss');
    }
    if (lowerText.includes('energi') || lowerText.includes('stamina')) {
      goals.push('energy');
    }

    return { symptoms, conditions, severity, duration, goals };
  }

  /**
   * Fallback to basic recommendations if enhanced system fails
   */
  private async getFallbackRecommendations(
    message: string,
    context: ConversationContext,
    recommendationContext?: RecommendationContext
  ): Promise<ContextualProductRecommendation[]> {
    try {
      const basicAssessment = this.extractBasicHealthAssessment(message);
      const basicRecommendations = await this.getProductRecommendations(basicAssessment, recommendationContext);
      
      // Convert to contextual format
      return basicRecommendations.map(rec => ({
        product: rec.product,
        relevanceScore: rec.relevanceScore,
        contextualReasons: [{
          type: 'condition_match',
          explanation: rec.reason,
          confidence: rec.relevanceScore,
          supportingEvidence: [rec.reason]
        }],
        benefits: rec.benefits,
        urgencyLevel: 'routine' as const
      }));

    } catch (error) {
      logger.error('Fallback recommendations also failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: context.userId
      });
      return [];
    }
  }
}

export const enhancedProductService = new EnhancedProductService();