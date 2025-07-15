/**
 * Enhanced Claude Service Integration
 * Extends existing ClaudeService with intelligent conversation flow and enhanced recommendations
 */

import { logger } from '@/shared/logger';
import { ConversationContext, ConversationState } from '@/claude/claude-service';
import { 
  ExtractedHealthData,
  ContextualProductRecommendation
} from '@/types/health-intelligence';
import { enhancedHealthMappingService } from './enhanced-health-mapping';
import { smartConversationEngine } from './smart-conversation-engine';
import { enhancedProductService } from './enhanced-product-service';

export interface EnhancedProcessResult {
  response: string;
  newState: ConversationState;
  conversationAnalysis?: any;
  contextualRecommendations?: ContextualProductRecommendation[];
  followUpQuestions?: any[];
}

export class EnhancedClaudeServiceIntegration {
  
  constructor() {
    logger.info('Enhanced Claude Service Integration initialized');
  }

  /**
   * Process message with enhanced intelligence layer
   * This wraps the existing ClaudeService.processMessage with additional intelligence
   */
  public async processMessageWithIntelligence(
    message: string,
    context: ConversationContext,
    existingClaudeService: any
  ): Promise<EnhancedProcessResult> {
    const startTime = Date.now();

    try {
      // Extract enhanced health data
      const extractedHealthData = this.extractHealthData(message, context);
      
      // Analyze conversation intelligence
      const conversationAnalysis = smartConversationEngine.analyzeConversation(
        message, 
        context, 
        extractedHealthData
      );
      
      // Get enhanced product recommendations
      const contextualRecommendations = await enhancedProductService.getEnhancedProductRecommendations(
        message, 
        context
      );
      
      // Generate intelligent response based on analysis
      const intelligentResponse = this.generateIntelligentResponse(
        conversationAnalysis,
        contextualRecommendations,
        context
      );
      
      // Determine conversation state
      const newState = this.determineConversationState(
        conversationAnalysis,
        contextualRecommendations,
        context
      );

      // Generate follow-up questions if needed
      const followUpQuestions = conversationAnalysis.nextBestAction === 'ask_questions' ?
        conversationAnalysis.recommendedQuestions : [];

      const duration = Date.now() - startTime;
      logger.info('Enhanced message processing completed', {
        userId: context.userId,
        messageLength: message.length,
        responseLength: intelligentResponse.length,
        completeness: conversationAnalysis.healthDataCompleteness,
        recommendationsCount: contextualRecommendations.length,
        followUpQuestionsCount: followUpQuestions.length,
        duration
      });

      return {
        response: intelligentResponse,
        newState,
        conversationAnalysis,
        contextualRecommendations,
        followUpQuestions
      };

    } catch (error) {
      logger.error('Enhanced processing failed, falling back to basic processing', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: context.userId
      });
      
      // Fallback to existing Claude service
      const basicResult = await existingClaudeService.processMessage(message, context);
      return {
        response: basicResult.response,
        newState: basicResult.newState
      };
    }
  }

  /**
   * Extract health data using enhanced mapping service
   */
  private extractHealthData(message: string, context: ConversationContext): ExtractedHealthData {
    // Combine recent conversation for context
    const recentMessages = context.messages
      .slice(-3)
      .map(m => typeof m.content === 'string' ? m.content : '')
      .join(' ');
    
    const fullContext = `${recentMessages} ${message}`;

    // Extract using enhanced mapping
    const { symptoms, conditions } = enhancedHealthMappingService.extractHealthTerms(fullContext);
    const temporalContext = enhancedHealthMappingService.extractTemporalContext(fullContext);
    
    // Build severity assessment
    const severityAssessment = this.buildSeverityAssessment(symptoms, conditions, fullContext);
    
    // Build user profile
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
   * Generate intelligent response combining analysis and recommendations
   */
  private generateIntelligentResponse(
    analysis: any,
    recommendations: ContextualProductRecommendation[],
    context: ConversationContext
  ): string {
    // Use smart conversation engine to create response
    let response = smartConversationEngine.createIntelligentResponse(
      analysis,
      recommendations,
      context
    );

    // Add product recommendations if appropriate
    if (analysis.nextBestAction === 'provide_recommendations' && recommendations.length > 0) {
      response = this.enhanceResponseWithRecommendations(response, recommendations);
    }

    // Add contextual follow-up if needed
    if (analysis.healthDataCompleteness < 70 && analysis.recommendedQuestions.length > 0) {
      const topQuestion = analysis.recommendedQuestions[0];
      if (topQuestion && !response.includes('?')) {
        response += `\n\n${topQuestion.question}`;
      }
    }

    return response;
  }

  /**
   * Enhance response with contextual product recommendations
   */
  private enhanceResponseWithRecommendations(
    baseResponse: string,
    recommendations: ContextualProductRecommendation[]
  ): string {
    if (recommendations.length === 0) return baseResponse;

    const topRec = recommendations[0]!;
    
    let enhancedResponse = baseResponse;
    
    // Add main recommendation
    if (!baseResponse.toLowerCase().includes(topRec.product.name.toLowerCase())) {
      enhancedResponse += `\n\nUntuk kondisi ini, saya rekomendasikan ${topRec.product.name}`;
      
      // Add contextual reason
      if (topRec.contextualReasons.length > 0) {
        const mainReason = topRec.contextualReasons[0]!;
        enhancedResponse += ` - ${mainReason.explanation}`;
      }
      
      // Add price
      enhancedResponse += ` (Rp ${topRec.product.price.toLocaleString('id-ID')})`;
    }

    // Add benefits if relevant
    if (topRec.benefits.length > 0) {
      const relevantBenefits = topRec.benefits.slice(0, 2);
      enhancedResponse += `\n\nManfaat utama: ${relevantBenefits.join(' dan ')}.`;
    }

    // Add urgency context if needed
    if (topRec.urgencyLevel === 'urgent' || topRec.urgencyLevel === 'soon') {
      enhancedResponse += '\n\n⚡ Kondisi ini sebaiknya segera ditangani ya.';
    }

    return enhancedResponse;
  }

  /**
   * Determine conversation state based on analysis
   */
  private determineConversationState(
    analysis: any,
    recommendations: ContextualProductRecommendation[],
    context: ConversationContext
  ): ConversationState {
    // Emergency cases
    if (analysis.urgencyLevel === 'emergency') {
      return ConversationState.GENERAL_SUPPORT; // For medical referral
    }

    // Based on next best action
    switch (analysis.nextBestAction) {
      case 'ask_questions':
        return ConversationState.HEALTH_INQUIRY;
        
      case 'provide_recommendations':
        return recommendations.length > 0 ? 
          ConversationState.PRODUCT_RECOMMENDATION : 
          ConversationState.HEALTH_INQUIRY;
          
      case 'seek_clarification':
        return ConversationState.HEALTH_INQUIRY;
        
      case 'escalate':
        return ConversationState.GENERAL_SUPPORT;
        
      default:
        return context.state; // Keep current state
    }
  }

  /**
   * Build severity assessment from extracted data
   */
  private buildSeverityAssessment(symptoms: any[], conditions: any[], fullContext: string): any {
    let maxSeverity = 'mild';
    let urgency: 'routine' | 'soon' | 'urgent' | 'emergency' = 'routine';

    // Find highest severity
    [...symptoms, ...conditions].forEach(item => {
      const itemSeverity = item.severity || 'mild';
      if (itemSeverity === 'severe') maxSeverity = 'severe';
      else if (itemSeverity === 'moderate' && maxSeverity !== 'severe') maxSeverity = 'moderate';
    });

    // Check for urgent language
    const urgentMarkers = ['parah', 'sangat', 'banget', 'tidak tahan', 'emergency', 'darurat'];
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
   * Build user profile from conversation context
   */
  private buildUserProfile(context: ConversationContext): any {
    const allText = context.messages
      .map(m => typeof m.content === 'string' ? m.content : '')
      .join(' ')
      .toLowerCase();

    // Extract basic demographics
    const ageMatch = allText.match(/(umur|usia)\s*(\d{1,2})/i);
    const age = ageMatch ? parseInt(ageMatch[2]!) : undefined;

    // Extract gender
    let gender: 'male' | 'female' | undefined;
    if (allText.includes('wanita') || allText.includes('perempuan')) {
      gender = 'female';
    } else if (allText.includes('pria') || allText.includes('laki')) {
      gender = 'male';
    }

    // Extract chronic conditions
    const chronicalConditions: string[] = [];
    if (allText.includes('diabetes')) chronicalConditions.push('diabetes');
    if (allText.includes('hipertensi')) chronicalConditions.push('hypertension');
    if (allText.includes('kolesterol')) chronicalConditions.push('cholesterol');

    return {
      age,
      gender,
      chronicalConditions,
      medicationHistory: [],
      lifestyleFactors: [],
      communicationPreference: context.metadata?.userPreferences?.communicationStyle || 'conversational'
    };
  }

  /**
   * Get conversation intelligence summary for debugging/monitoring
   */
  public getConversationIntelligence(
    message: string,
    context: ConversationContext
  ): any {
    const extractedHealthData = this.extractHealthData(message, context);
    return smartConversationEngine.analyzeConversation(message, context, extractedHealthData);
  }
}

export const enhancedClaudeServiceIntegration = new EnhancedClaudeServiceIntegration();