import { logger } from '@/shared/logger';
import { ConversationState } from './claude-service';

export interface ResponseFormat {
  maxTokens: number;
  structure: 'natural' | 'structured' | 'json' | 'bullet';
  style: 'casual' | 'professional' | 'brief' | 'detailed';
  includeEmoji: boolean;
}

export interface OptimizedResponse {
  content: string;
  tokenEstimate: number;
  efficiency: number; // Value per token
}

export class ResponseOptimizer {
  private static instance: ResponseOptimizer;

  // Token budgets for different conversation states
  private readonly STATE_BUDGETS: Record<ConversationState, ResponseFormat> = {
    [ConversationState.GREETING]: {
      maxTokens: 100,
      structure: 'natural',
      style: 'casual',
      includeEmoji: true
    },
    [ConversationState.HEALTH_INQUIRY]: {
      maxTokens: 300,
      structure: 'natural',
      style: 'professional',
      includeEmoji: true
    },
    [ConversationState.PRODUCT_RECOMMENDATION]: {
      maxTokens: 600,
      structure: 'structured',
      style: 'professional',
      includeEmoji: true
    },
    [ConversationState.DIET_CONSULTATION]: {
      maxTokens: 400,
      structure: 'structured',
      style: 'professional',
      includeEmoji: true
    },
    [ConversationState.ORDER_COLLECTION]: {
      maxTokens: 350,
      structure: 'structured',
      style: 'brief',
      includeEmoji: true
    },
    [ConversationState.ORDER_CONFIRMATION]: {
      maxTokens: 500,
      structure: 'json',
      style: 'detailed',
      includeEmoji: true
    },
    [ConversationState.CONVERSATION_COMPLETE]: {
      maxTokens: 150,
      structure: 'natural',
      style: 'brief',
      includeEmoji: true
    },
    [ConversationState.GENERAL_SUPPORT]: {
      maxTokens: 200,
      structure: 'natural',
      style: 'casual',
      includeEmoji: true
    }
  };

  // Indonesian language optimization patterns
  private readonly INDONESIAN_OPTIMIZATIONS = {
    // Common abbreviations that maintain warmth
    abbreviations: {
      'kakak': 'kak',
      'sebentar': 'bentar',
      'gimana': 'gmn',
      'bagaimana': 'bgmn',
      'silahkan': 'silakan',
      'terima kasih': 'makasih',
      'tidak apa-apa': 'gpp'
    },
    
    // Shorter but warm alternatives
    phrases: {
      'Selamat pagi kakak': 'Pagi kak! 😊',
      'Selamat siang kakak': 'Siang kak! 😊',
      'Selamat sore kakak': 'Sore kak! 😊',
      'Selamat malam kakak': 'Malam kak! 😊',
      'Ada yang bisa saya bantu?': 'Ada yg bisa dibantu?',
      'Bagaimana kabarnya?': 'Apa kabar?',
      'Silahkan tunggu sebentar': 'Tunggu bentar ya',
      'Terima kasih sudah menunggu': 'Makasih udah sabar',
      'Apakah ada pertanyaan lain?': 'Ada pertanyaan lain?'
    },

    // Efficient emotional expressions
    emotions: {
      'senang': '😊',
      'baik': '👍',
      'terima kasih': '🙏',
      'maaf': '🙏',
      'semangat': '💪',
      'bagus': '👌',
      'oke': '✅'
    }
  };

  public static getInstance(): ResponseOptimizer {
    if (!ResponseOptimizer.instance) {
      ResponseOptimizer.instance = new ResponseOptimizer();
    }
    return ResponseOptimizer.instance;
  }

  /**
   * Optimize response based on conversation state and preferences
   */
  public optimizeResponse(
    rawResponse: string,
    state: ConversationState,
    userPreferences?: {
      brief?: boolean;
      emoji?: boolean;
      style?: 'casual' | 'professional';
    }
  ): OptimizedResponse {
    const format = this.getResponseFormat(state, userPreferences);
    let optimizedContent = rawResponse;

    // Apply optimization based on format
    switch (format.structure) {
      case 'natural':
        optimizedContent = this.optimizeNaturalResponse(rawResponse, format);
        break;
      case 'structured':
        optimizedContent = this.optimizeStructuredResponse(rawResponse, format);
        break;
      case 'json':
        optimizedContent = this.optimizeJsonResponse(rawResponse, format);
        break;
      case 'bullet':
        optimizedContent = this.optimizeBulletResponse(rawResponse, format);
        break;
    }

    // Apply Indonesian language optimizations
    optimizedContent = this.applyIndonesianOptimizations(optimizedContent, format);

    // Estimate tokens and efficiency
    const tokenEstimate = this.estimateTokens(optimizedContent);
    const efficiency = this.calculateEfficiency(optimizedContent, tokenEstimate, state);

    // Ensure within token budget
    if (tokenEstimate > format.maxTokens) {
      optimizedContent = this.truncateResponse(optimizedContent, format.maxTokens);
    }

    logger.debug('Response optimized', {
      state,
      originalLength: rawResponse.length,
      optimizedLength: optimizedContent.length,
      tokenEstimate,
      efficiency,
      format
    });

    return {
      content: optimizedContent,
      tokenEstimate,
      efficiency
    };
  }

  /**
   * Get response format based on state and preferences
   */
  private getResponseFormat(
    state: ConversationState,
    userPreferences?: {
      brief?: boolean;
      emoji?: boolean;
      style?: 'casual' | 'professional';
    }
  ): ResponseFormat {
    const baseFormat = { ...this.STATE_BUDGETS[state] };

    // Apply user preferences
    if (userPreferences?.brief) {
      baseFormat.maxTokens = Math.floor(baseFormat.maxTokens * 0.7);
      baseFormat.style = 'brief';
    }

    if (userPreferences?.emoji === false) {
      baseFormat.includeEmoji = false;
    }

    if (userPreferences?.style) {
      baseFormat.style = userPreferences.style;
    }

    return baseFormat;
  }

  /**
   * Optimize natural conversation responses
   */
  private optimizeNaturalResponse(content: string, format: ResponseFormat): string {
    let optimized = content;

    // Remove redundant phrases
    optimized = optimized
      .replace(/Saya akan membantu Anda/gi, 'Saya bantu')
      .replace(/Terima kasih telah/gi, 'Makasih udah')
      .replace(/Apakah Anda/gi, 'Apakah kamu')
      .replace(/silahkan beri tahu/gi, 'kasih tau');

    // Simplify common expressions
    if (format.style === 'brief') {
      optimized = optimized
        .replace(/Baik sekali/gi, 'Bagus')
        .replace(/Sangat baik/gi, 'Oke banget')
        .replace(/Tidak masalah/gi, 'Gpp');
    }

    return optimized;
  }

  /**
   * Optimize structured responses (product recommendations, etc.)
   */
  private optimizeStructuredResponse(content: string, _format: ResponseFormat): string {
    let optimized = content;

    // Use bullet points for lists
    optimized = optimized.replace(/(\d+\.\s)/g, '• ');

    // Shorten product descriptions
    optimized = optimized
      .replace(/Produk ini sangat cocok untuk/gi, 'Cocok untuk')
      .replace(/Manfaat utama dari produk ini adalah/gi, 'Manfaat:')
      .replace(/Cara penggunaan yang disarankan/gi, 'Cara pakai:');

    // Optimize pricing format
    optimized = optimized.replace(/Harga produk ini adalah/gi, 'Harga:');

    return optimized;
  }

  /**
   * Optimize JSON responses for order collection
   */
  private optimizeJsonResponse(content: string, _format: ResponseFormat): string {
    // Extract structured data and format as clean JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return JSON.stringify(parsed, null, 2);
      } catch {
        // If parsing fails, return original content
        return content;
      }
    }

    return content;
  }

  /**
   * Optimize bullet point responses
   */
  private optimizeBulletResponse(content: string, _format: ResponseFormat): string {
    let optimized = content;

    // Convert numbered lists to bullets
    optimized = optimized.replace(/(\d+\.\s)/g, '• ');

    // Remove redundant introductory phrases
    optimized = optimized
      .replace(/Berikut adalah.*:/gi, '')
      .replace(/Di bawah ini adalah.*:/gi, '');

    return optimized.trim();
  }

  /**
   * Apply Indonesian language optimizations
   */
  private applyIndonesianOptimizations(content: string, format: ResponseFormat): string {
    let optimized = content;

    // Apply abbreviations for brief responses
    if (format.style === 'brief') {
      for (const [long, short] of Object.entries(this.INDONESIAN_OPTIMIZATIONS.abbreviations)) {
        const regex = new RegExp(long, 'gi');
        optimized = optimized.replace(regex, short);
      }
    }

    // Apply phrase optimizations
    for (const [long, short] of Object.entries(this.INDONESIAN_OPTIMIZATIONS.phrases)) {
      const regex = new RegExp(long, 'gi');
      optimized = optimized.replace(regex, short);
    }

    // Add emojis if enabled
    if (format.includeEmoji) {
      for (const [emotion, emoji] of Object.entries(this.INDONESIAN_OPTIMIZATIONS.emotions)) {
        // Only replace if emotion word is at the end of a sentence or standalone
        const regex = new RegExp(`\\b${emotion}\\b(?=[\\.\\!\\?\\s]|$)`, 'gi');
        optimized = optimized.replace(regex, `${emotion} ${emoji}`);
      }
    }

    return optimized;
  }

  /**
   * Estimate token count for response
   */
  private estimateTokens(content: string): number {
    // Rough estimation: Indonesian text averages ~3-4 characters per token
    // Emojis count as 1-2 tokens each
    const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
    const textLength = content.length - emojiCount;
    
    return Math.ceil(textLength / 3.5) + (emojiCount * 1.5);
  }

  /**
   * Calculate efficiency score (value per token)
   */
  private calculateEfficiency(content: string, tokenCount: number, state: ConversationState): number {
    // Base efficiency factors
    const factors = {
      informationDensity: this.calculateInformationDensity(content),
      emotional_warmth: this.calculateEmotionalWarmth(content),
      actionability: this.calculateActionability(content, state),
      clarity: this.calculateClarity(content)
    };

    // Weighted average based on conversation state
    const weights = this.getEfficiencyWeights(state);
    const totalValue = Object.entries(factors).reduce((sum, [key, value]) => {
      return sum + (value * (weights[key as keyof typeof weights] || 1));
    }, 0);

    return totalValue / tokenCount;
  }

  /**
   * Calculate information density
   */
  private calculateInformationDensity(content: string): number {
    // Count meaningful words (not articles, prepositions, etc.)
    const meaningfulWords = content
      .toLowerCase()
      .split(/\s+/)
      .filter(word => !['yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'adalah', 'akan', 'dapat'].includes(word));
    
    return meaningfulWords.length / content.split(/\s+/).length;
  }

  /**
   * Calculate emotional warmth
   */
  private calculateEmotionalWarmth(content: string): number {
    const warmWords = ['kak', 'makasih', 'senang', 'baik', 'bagus', 'oke'];
    const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length;
    
    const warmWordCount = warmWords.reduce((count, word) => {
      return count + (content.toLowerCase().match(new RegExp(word, 'g')) || []).length;
    }, 0);
    
    return (warmWordCount + emojiCount) / 10; // Normalize to 0-1 range
  }

  /**
   * Calculate actionability (how clear the next steps are)
   */
  private calculateActionability(content: string, state: ConversationState): number {
    const actionWords = ['pilih', 'order', 'pesan', 'beli', 'coba', 'gunakan', 'minum', 'konsumsi'];
    const questionWords = ['apakah', 'bagaimana', 'berapa', 'kapan', 'dimana'];
    
    const actionCount = actionWords.reduce((count, word) => {
      return count + (content.toLowerCase().match(new RegExp(word, 'g')) || []).length;
    }, 0);
    
    const questionCount = questionWords.reduce((count, word) => {
      return count + (content.toLowerCase().match(new RegExp(word, 'g')) || []).length;
    }, 0);
    
    // Order states should be more actionable
    const multiplier = [ConversationState.ORDER_COLLECTION, ConversationState.ORDER_CONFIRMATION].includes(state) ? 1.5 : 1;
    
    return Math.min((actionCount + questionCount) * multiplier / 5, 1);
  }

  /**
   * Calculate clarity score
   */
  private calculateClarity(content: string): number {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, sentence) => sum + sentence.split(/\s+/).length, 0) / sentences.length;
    
    // Shorter sentences are generally clearer for WhatsApp
    return Math.max(0, 1 - (avgSentenceLength - 8) / 20);
  }

  /**
   * Get efficiency weights for different conversation states
   */
  private getEfficiencyWeights(state: ConversationState): Record<string, number> {
    const baseWeights = {
      informationDensity: 1.0,
      emotional_warmth: 1.0,
      actionability: 1.0,
      clarity: 1.0
    };

    switch (state) {
      case ConversationState.HEALTH_INQUIRY:
        return { ...baseWeights, informationDensity: 1.5, clarity: 1.3 };
      case ConversationState.PRODUCT_RECOMMENDATION:
        return { ...baseWeights, informationDensity: 1.4, actionability: 1.2 };
      case ConversationState.ORDER_COLLECTION:
        return { ...baseWeights, actionability: 1.6, clarity: 1.4 };
      case ConversationState.GREETING:
        return { ...baseWeights, emotional_warmth: 1.5 };
      default:
        return baseWeights;
    }
  }

  /**
   * Truncate response to fit token budget
   */
  private truncateResponse(content: string, maxTokens: number): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let truncated = '';
    let tokenCount = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence + '.');
      if (tokenCount + sentenceTokens > maxTokens) {
        break;
      }
      truncated += sentence + '.';
      tokenCount += sentenceTokens;
    }
    
    return truncated.trim() || content.substring(0, maxTokens * 3); // Fallback
  }

  /**
   * Get optimization statistics
   */
  public getOptimizationStats(): {
    stateFormats: Record<ConversationState, ResponseFormat>;
    optimizationPatterns: {
      abbreviations: number;
      phrases: number;
      emotions: number;
    };
  } {
    return {
      stateFormats: this.STATE_BUDGETS,
      optimizationPatterns: {
        abbreviations: Object.keys(this.INDONESIAN_OPTIMIZATIONS.abbreviations).length,
        phrases: Object.keys(this.INDONESIAN_OPTIMIZATIONS.phrases).length,
        emotions: Object.keys(this.INDONESIAN_OPTIMIZATIONS.emotions).length
      }
    };
  }
}