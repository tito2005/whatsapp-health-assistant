/**
 * Intelligence Integration Layer
 * Optional enhancement layer that can be enabled/disabled via feature flag
 */

import { logger } from '@/shared/logger';
import { ConversationContext, ConversationState } from '@/claude/claude-service';
import { enhancedClaudeServiceIntegration } from './enhanced-claude-service';

// Feature flag for enhanced intelligence
const ENABLE_ENHANCED_INTELLIGENCE = process.env.ENABLE_ENHANCED_INTELLIGENCE === 'true';

export class IntelligenceIntegration {
  
  constructor() {
    logger.info(`Intelligence Integration initialized - Enhanced mode: ${ENABLE_ENHANCED_INTELLIGENCE ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Process message with optional intelligence enhancement
   */
  public async processMessage(
    message: string,
    context: ConversationContext,
    existingClaudeService: any
  ): Promise<{ response: string; newState: ConversationState; enhancedData?: any }> {
    
    if (ENABLE_ENHANCED_INTELLIGENCE) {
      try {
        // Use enhanced processing
        const enhancedResult = await enhancedClaudeServiceIntegration.processMessageWithIntelligence(
          message,
          context,
          existingClaudeService
        );

        logger.info('Enhanced intelligence processing successful', {
          userId: context.userId,
          completeness: enhancedResult.conversationAnalysis?.healthDataCompleteness,
          recommendationsCount: enhancedResult.contextualRecommendations?.length || 0
        });

        return {
          response: enhancedResult.response,
          newState: enhancedResult.newState,
          enhancedData: {
            conversationAnalysis: enhancedResult.conversationAnalysis,
            contextualRecommendations: enhancedResult.contextualRecommendations,
            followUpQuestions: enhancedResult.followUpQuestions
          }
        };

      } catch (error) {
        logger.warn('Enhanced intelligence failed, falling back to basic processing', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: context.userId
        });
        
        // Fallback to basic processing
        return await this.processBasicMessage(message, context, existingClaudeService);
      }
    } else {
      // Use basic processing
      return await this.processBasicMessage(message, context, existingClaudeService);
    }
  }

  /**
   * Basic message processing (existing system)
   */
  private async processBasicMessage(
    message: string,
    context: ConversationContext,
    existingClaudeService: any
  ): Promise<{ response: string; newState: ConversationState }> {
    const result = await existingClaudeService.processMessage(message, context);
    return {
      response: result.response,
      newState: result.newState
    };
  }

  /**
   * Get intelligence status for monitoring
   */
  public getIntelligenceStatus(): {
    enhancedModeEnabled: boolean;
    healthMappingsCount: number;
    capabilities: string[];
  } {
    return {
      enhancedModeEnabled: ENABLE_ENHANCED_INTELLIGENCE,
      healthMappingsCount: ENABLE_ENHANCED_INTELLIGENCE ? 150 : 53, // Approximate counts
      capabilities: ENABLE_ENHANCED_INTELLIGENCE ? [
        'Enhanced health term recognition',
        'Fuzzy matching for typos',
        'Contextual scoring',
        'Smart follow-up questions',
        'Temporal context analysis',
        'Multi-symptom correlation'
      ] : [
        'Basic health term recognition',
        'Keyword matching',
        'Simple product scoring'
      ]
    };
  }
}

export const intelligenceIntegration = new IntelligenceIntegration();