import { config } from '@/config/environment';
import personalStyle, { getRandomPhrase, formatPrice } from '@/config/personal-style';
import { logger } from '@/shared/logger';
import {
  CachedSystemPrompt,
  OptimizedSystemPrompt,
  PromptCacheMetrics,
  TokenUsageBreakdown
} from '@/types/claude';
import { ProductRecommendation } from '@/types/product';
import { ConversationContext } from './claude-service';
import { FlowContextSummary } from './conversation-flow-controller';

export class PromptCacheService {
  private static instance: PromptCacheService;
  private cacheMetrics: PromptCacheMetrics = {
    totalCalls: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitRate: 0,
    totalTokensSaved: 0,
    costSavings: 0
  };

  // Estimated token counts for different prompt sections
  private readonly ESTIMATED_TOKENS = {
    STATIC_BASE: 1800,
    PRODUCT_CONTEXT: 500,
    TIME_CONTEXT: 100,
    CONVERSATION_MEMORY: 200,
    ORDER_CONTEXT: 300
  };

  // Claude 3.5 Sonnet pricing (per 1M tokens)
  private readonly PRICING = {
    INPUT: 3.0,  // $3 per 1M input tokens
    OUTPUT: 15.0, // $15 per 1M output tokens
    CACHE_WRITE: 3.75, // $3.75 per 1M tokens (25% markup for cache writes)
    CACHE_READ: 0.3    // $0.30 per 1M tokens (90% discount for cache reads)
  };

  public static getInstance(): PromptCacheService {
    if (!PromptCacheService.instance) {
      PromptCacheService.instance = new PromptCacheService();
    }
    return PromptCacheService.instance;
  }

  /**
   * Generate optimized system prompt with caching
   */
  public generateOptimizedPrompt(
    recommendations: ProductRecommendation[],
    context?: ConversationContext,
    includeRealTime: boolean = true,
    flowContext?: FlowContextSummary
  ): OptimizedSystemPrompt {
    const staticPrompt = this.getStaticCacheablePrompt();
    const dynamicContext = this.buildDynamicContext(recommendations, context, includeRealTime, flowContext);

    return {
      staticPrompt,
      dynamicContext,
      estimatedTokens: {
        static: this.ESTIMATED_TOKENS.STATIC_BASE,
        dynamic: this.estimateDynamicTokens(recommendations, context),
        total: this.ESTIMATED_TOKENS.STATIC_BASE + this.estimateDynamicTokens(recommendations, context)
      }
    };
  }

  /**
   * Get static cacheable prompt - this rarely changes and can be cached
   */
  private getStaticCacheablePrompt(): CachedSystemPrompt {
    const sampleGreeting = getRandomPhrase(personalStyle.greetings);
    const sampleTransition = getRandomPhrase(personalStyle.transitions);
    const sampleEmpathy = getRandomPhrase(personalStyle.empathyPhrases);

    const staticPrompt = `You are Maya, a caring and knowledgeable health consultant from ${config.businessName}. ${personalStyle.expertise}

⚠️ IMPORTANT: You are NOT a licensed medical professional. Your advice is for general education only and should not replace professional medical consultation.

PERSONAL COMMUNICATION STYLE:
${personalStyle.tone}
${personalStyle.language}
CRITICAL: Keep responses VERY SHORT (max 1-2 sentences). Be brief like real WhatsApp chat.

YOUR NATURAL EXPRESSIONS:
- Greetings: "${sampleGreeting}"
- Transitions: "${sampleTransition}" 
- Empathy: "${sampleEmpathy}"
- Avoid formal language, numbered lists, or menu-style responses

BUSINESS PHILOSOPHY:
${personalStyle.businessPhilosophy}

BUSINESS LOCATION & OPERATIONS:
📍 Location: ${personalStyle.businessLocation.city}
🎯 Service Area: ${personalStyle.businessLocation.serviceArea}
⏰ Chat Availability: ${personalStyle.businessLocation.chatAvailability}
🚚 Shipping Policy: ${personalStyle.businessLocation.shippingPolicy}
🕐 Timezone: ${personalStyle.businessLocation.timezone}

PAYMENT INFORMATION:
💳 Payment Methods: ${personalStyle.paymentInfo.methods}

Bank Transfer Details:
• BCA: ${personalStyle.paymentInfo.bankAccounts.bca}
• Mandiri: ${personalStyle.paymentInfo.bankAccounts.mandiri}
• OVO/Gopay/Dana: ${personalStyle.paymentInfo.bankAccounts.ovo}
• Account Name: ${personalStyle.paymentInfo.accountName}

Important: ${personalStyle.paymentInfo.confirmationNote}

BULK PRICING RULES (IMPORTANT - NO CALCULATION ERRORS!):
${this.getStaticBulkPricingRules()}

PRICING CALCULATION RULES:
- 1 pouch Hotto = 295k
- 2+ pouches Hotto = 285k per pouch (so 3 pouches = 285k × 3 = 855k)
- 10+ pouches Hotto = 250k per pouch (so 10 pouches = 2.5jt, 15 pouches = 250k × 15 = 3.75jt)
- NEVER use 295k per pouch for quantities 2 or more
- ALWAYS calculate correctly based on tier pricing
- Examples: 3 pouches = 855k, 5 pouches = 1.425jt, 10 pouches = 2.5jt

IMPORTANT SERVICE BOUNDARIES:
- ONLY serve customers located in Batam
- If customer is outside Batam, politely explain we're a local Batam shop
- Chat/consultation available 24/7 
- Shipping only during business hours
- Always confirm customer is in Batam before processing orders

CONSULTATION APPROACH:
${personalStyle.consultationStyle}

PRODUCT RECOMMENDATION STYLE:
${personalStyle.productRecommendationStyle}

ORDER PROCESSING STYLE:
${personalStyle.orderProcessingStyle}

RESPONSE EXAMPLES TO LEARN FROM:
Health Inquiries: Study these examples of how you should respond to health questions:
${personalStyle.responseExamples.healthInquiry.map(example => `"${example}"`).join('\n')}

Product Questions: Reference these when explaining products:
${personalStyle.responseExamples.productQuestions.map(example => `"${example}"`).join('\n')}

Payment Information: Use these when customers ask about payment:
${personalStyle.responseExamples.payment.map(example => `"${example}"`).join('\n')}

Out-of-Area Customers: Use these when customers are outside Batam:
${personalStyle.responseExamples.outOfArea.map(example => `"${example}"`).join('\n')}

🚨 CRITICAL ANTI-HALLUCINATION RULES:
- NEVER invent product details not in the PRODUCTS section below
- ONLY mention product information explicitly provided in current context
- If unsure about details, say "Let me check that specific detail for you"
- STICK STRICTLY to provided product database information

Your main products:
- HOTTO PURTO/MAME: Multi-benefit health drinks
- Spencer's MealBlend: Weight loss meal replacement
- Mganik MetaFiber & Superfood: Diabetes management, blood sugar control  
- 3Peptide: Hypertension/high blood pressure control
- Flimty Fiber: Digestive health and detox

RESPONSE STYLE EXAMPLES:
User: "halo kak mau tanya tentang hotto purto"
You: "Halo kak! Ada yang bisa dibantu? 😊"

User: "untuk diabetes ada produk apa?"
You: "Baik kak, untuk diabetes kita ada mganik metafiber ya 😊"

User: "harga berapa?"
You: "Mganik metafiber 1 tub 299k gratis ongkir ya kak 😊"

KEEP IT SIMPLE - Match the user's energy and length!

IMPORTANT: Channel your personal expertise and communication style in every response. Be authentically yourself while maintaining professionalism.

DISCLAIMER POLICY: Medical disclaimers will be automatically added only when collecting shipping/order information, not for general product discussions or consultations.`;

    return {
      type: "text",
      text: staticPrompt,
      cache_control: { type: "ephemeral" }
    };
  }

  /**
   * Build dynamic context that changes per conversation
   */
  private buildDynamicContext(
    recommendations: ProductRecommendation[],
    context?: ConversationContext,
    includeRealTime: boolean = true,
    flowContext?: FlowContextSummary
  ): CachedSystemPrompt {
    let dynamicContent = '';

    // Real-time context (time, date, appropriate greetings)
    if (includeRealTime) {
      const currentTimeWIB = this.getCurrentTimeWIB();
      dynamicContent += `\nCURRENT TIME CONTEXT:
🕐 Current Time: ${currentTimeWIB.time} WIB (${currentTimeWIB.date})
🌅 Time of Day: ${currentTimeWIB.period}

APPROPRIATE GREETINGS BY TIME:
- Pagi (06:00-10:59): "Selamat pagi", "Pagi kak"
- Siang (11:00-14:59): "Selamat siang", "Siang kak"  
- Sore (15:00-17:59): "Selamat sore", "Sore kak"
- Malam (18:00-05:59): "Selamat malam", "Malam kak"

ALWAYS use time-appropriate greetings and closings based on current WIB time!\n`;
    }

    // Conversation flow context
    if (flowContext) {
      dynamicContent += this.buildFlowContextForCache(flowContext);
    }

    // Conversation memory context
    if (context?.metadata) {
      dynamicContent += this.buildMemoryContext(context.metadata);
    }

    // Active order context
    if (context?.metadata?.currentOrder && context.metadata.currentOrder.items.length > 0) {
      dynamicContent += '\n\nACTIVE ORDER CONTEXT:\n';
      dynamicContent += `- Customer is in ordering process (Step: ${context.metadata.orderStep || 'cart'})\n`;
      dynamicContent += `- Cart items: ${context.metadata.currentOrder.items.length}\n`;
      dynamicContent += `- Total: Rp ${context.metadata.currentOrder.totalAmount.toLocaleString('id-ID')}\n`;
      
      if (context.metadata.orderStep === 'customer_info') {
        dynamicContent += '- Currently collecting: Name, WhatsApp, Address\n';
      } else if (context.metadata.orderStep === 'shipping') {
        dynamicContent += '- Currently selecting: Shipping & Payment options\n';
      }
      
      dynamicContent += 'Guide customer through the order completion process.\n\n';
    }

    // Product recommendations context
    if (recommendations.length > 0) {
      dynamicContent += '\n\nPRODUK YANG BISA BANTU:\n';
      
      // Show top 2 most relevant products
      const topRecommendations = recommendations.slice(0, 2);
      
      topRecommendations.forEach((rec) => {
        const product = rec.product;
        dynamicContent += `• ${product.name} - Rp ${product.price.toLocaleString('id-ID')}\n`;
        dynamicContent += `  Kenapa cocok: ${rec.reason}\n`;
        if (rec.benefits.length > 0) {
          dynamicContent += `  Manfaat: ${rec.benefits.slice(0, 2).join(' & ')}\n`;
        }
        dynamicContent += `  Cara pakai: ${product.dosage}\n`;
        
        // Add essential product details
        dynamicContent += `  Ingredients: ${product.ingredients.join(', ')}\n`;
        dynamicContent += `  Category: ${product.category}\n`;
        dynamicContent += `  Suitable for: ${product.suitableFor.join(', ')}\n`;
        if (product.warnings && product.warnings.length > 0) {
          dynamicContent += `  Warnings: ${product.warnings.join(', ')}\n`;
        }
        
        // Add key metadata if available
        if (product.metadata) {
          const meta = product.metadata as any;
          if (meta.calories) dynamicContent += `  Calories: ${meta.calories} per serving\n`;
          if (meta.fiber) dynamicContent += `  Fiber: ${meta.fiber} per serving\n`;
          if (meta.protein) dynamicContent += `  Protein: ${meta.protein} per serving\n`;
        }
        dynamicContent += `\n`;
      });
      
      dynamicContent += `
🚨 CRITICAL PRODUCT GUIDELINES:
- ONLY mention details explicitly listed above for each product
- DO NOT invent flavors, colors, ingredients, or features not specified
- If customer asks about details not listed, say "Let me check that specific detail for you"
- NEVER assume product specifications beyond what's provided
- Suggest naturally in conversation, explain benefits for their specific situation\n`;
    } else {
      dynamicContent += '\n\nTidak ada produk yang cocok untuk kebutuhan ini.\n';
      dynamicContent += 'Focus on: Kasih konsultasi umum, tanya lebih detail tentang goalnya, berikan tips diet/lifestyle yang praktis.\n';
      dynamicContent += 'Jangan recommend produk apapun yang tidak ada di database.\n';
    }

    return {
      type: "text",
      text: dynamicContent
    };
  }

  /**
   * Get static bulk pricing rules for caching
   */
  private getStaticBulkPricingRules(): string {
    let rules = '';
    for (const [productKey, pricing] of Object.entries(personalStyle.bulkPricing)) {
      rules += `\n${productKey.toUpperCase()}:\n`;
      for (const rule of pricing.bulkRules) {
        rules += `  • ${rule.description}\n`;
      }
      rules += `  • Regular price per unit: ${formatPrice(pricing.regularPrice)}\n`;
    }
    return rules;
  }

  /**
   * Build memory context for conversation continuity
   */
  private buildMemoryContext(metadata: any): string {
    let context = '';
    
    if (metadata?.mentionedProducts?.length > 0) {
      context += `\nPREVIOUS PRODUCTS: ${metadata.mentionedProducts.slice(-2).join(', ')}`;
    }
    
    if (metadata?.userPreferences?.budget) {
      context += `\nBUDGET: ${metadata.userPreferences.budget}`;
    }
    
    if (metadata?.keyPoints?.length > 0) {
      context += `\nKEY POINTS: ${metadata.keyPoints.slice(-2).join('; ')}`;
    }
    
    return context;
  }

  /**
   * Get current time in Indonesian timezone
   */
  private getCurrentTimeWIB(): { time: string; date: string; period: string } {
    const now = new Date();
    const wibTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    
    const hours = wibTime.getHours();
    const minutes = wibTime.getMinutes();
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    
    const dateString = wibTime.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    let period: string;
    if (hours >= 6 && hours < 11) {
      period = 'Pagi';
    } else if (hours >= 11 && hours < 15) {
      period = 'Siang';
    } else if (hours >= 15 && hours < 18) {
      period = 'Sore';
    } else {
      period = 'Malam';
    }
    
    return {
      time: timeString,
      date: dateString,
      period: period
    };
  }

  /**
   * Estimate tokens for dynamic content
   */
  private estimateDynamicTokens(recommendations: ProductRecommendation[], context?: ConversationContext): number {
    let tokens = this.ESTIMATED_TOKENS.TIME_CONTEXT; // Base time context

    // Memory context
    if (context?.metadata) {
      tokens += this.ESTIMATED_TOKENS.CONVERSATION_MEMORY;
    }

    // Order context
    if (context?.metadata?.currentOrder && context.metadata.currentOrder.items.length > 0) {
      tokens += this.ESTIMATED_TOKENS.ORDER_CONTEXT;
    }

    // Product recommendations
    if (recommendations.length > 0) {
      tokens += Math.min(recommendations.length * 200, this.ESTIMATED_TOKENS.PRODUCT_CONTEXT);
    }

    return tokens;
  }

  /**
   * Record cache usage for metrics
   */
  public recordCacheUsage(isCacheHit: boolean, tokensSaved: number = 0): void {
    this.cacheMetrics.totalCalls++;
    
    if (isCacheHit) {
      this.cacheMetrics.cacheHits++;
      this.cacheMetrics.totalTokensSaved += tokensSaved;
    } else {
      this.cacheMetrics.cacheMisses++;
    }
    
    this.cacheMetrics.cacheHitRate = this.cacheMetrics.cacheHits / this.cacheMetrics.totalCalls;
    this.cacheMetrics.costSavings = this.calculateCostSavings();

    // Log metrics every 10 calls
    if (this.cacheMetrics.totalCalls % 10 === 0) {
      logger.info('Prompt cache metrics update', this.cacheMetrics);
    }
  }

  /**
   * Calculate cost savings from caching
   */
  private calculateCostSavings(): number {
    const regularCost = (this.cacheMetrics.totalTokensSaved / 1_000_000) * this.PRICING.INPUT;
    const cachedCost = (this.cacheMetrics.totalTokensSaved / 1_000_000) * this.PRICING.CACHE_READ;
    return regularCost - cachedCost;
  }

  /**
   * Get current cache metrics
   */
  public getCacheMetrics(): PromptCacheMetrics {
    return { ...this.cacheMetrics };
  }

  /**
   * Reset cache metrics (useful for testing)
   */
  public resetMetrics(): void {
    this.cacheMetrics = {
      totalCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      totalTokensSaved: 0,
      costSavings: 0
    };
  }

  /**
   * Get token usage breakdown for analytics
   */
  public getTokenBreakdown(
    optimizedPrompt: OptimizedSystemPrompt,
    conversationHistoryTokens: number,
    outputTokens: number,
    isCacheHit: boolean
  ): TokenUsageBreakdown {
    return {
      staticPromptTokens: optimizedPrompt.estimatedTokens.static,
      dynamicContextTokens: optimizedPrompt.estimatedTokens.dynamic,
      conversationHistoryTokens,
      productRecommendationTokens: Math.min(optimizedPrompt.estimatedTokens.dynamic, this.ESTIMATED_TOKENS.PRODUCT_CONTEXT),
      totalInputTokens: optimizedPrompt.estimatedTokens.total + conversationHistoryTokens,
      outputTokens,
      isCacheHit
    };
  }

  /**
   * Build flow context for cached prompts (compact version)
   */
  private buildFlowContextForCache(flowContext: FlowContextSummary): string {
    let context = '\n\nCONVERSATION FLOW CONTEXT:\n';
    
    // Compact stage information
    context += `Stage: ${flowContext.stage.current} (${flowContext.stage.progress}%)\n`;
    context += `Summary: ${flowContext.conversationSummary}\n`;
    
    // Customer profile (compact)
    const profile = flowContext.customerProfile;
    if (profile.healthConcerns?.length) {
      context += `Health: ${profile.healthConcerns.join(', ')}\n`;
    }
    if (profile.eatingHabits) {
      context += `Eating: ${profile.eatingHabits.mealsPerDay || 3} meals/day`;
      if (profile.eatingHabits.hasSnacks) context += ', snacks';
      context += '\n';
    }
    
    // Flow-specific instructions (compact)
    switch (flowContext.stage.current) {
      case 'diet_consultation':
        context += 'FOCUS: Nutritionist mode - ask eating habits, provide meal plans\n';
        break;
      case 'order_collection':
        context += 'FOCUS: Collect customer info, generate order summary when complete\n';
        break;
      case 'order_confirmation':
        context += 'FOCUS: Confirm order, end with "Terima kasih sudah order, sehat selalu kakk 😊"\n';
        break;
      case 'conversation_complete':
        context += 'FOCUS: Conversation complete, only respond to new questions\n';
        break;
    }
    
    return context;
  }
}