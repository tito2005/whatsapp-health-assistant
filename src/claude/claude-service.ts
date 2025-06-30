import { config } from '@/config/environment';
import { HealthAssessment, ProductService, RecommendationContext } from '@/products/product-service';
import { log, logger } from '@/shared/logger';
import { ProductRecommendation } from '@/types/product';
import Anthropic from '@anthropic-ai/sdk';
import { MessageParam } from '@anthropic-ai/sdk/resources';

export interface ConversationContext {
  userId: string;
  messages: MessageParam[];
  state: ConversationState;
  metadata?: {
    customerName?: string;
    lastOrderId?: string;
    productInquiry?: string;
    // Phase 3: Enhanced memory fields
    mentionedProducts?: string[];
    lastRecommendations?: ProductRecommendation[];
    userPreferences?: {
      budget?: 'low' | 'medium' | 'high';
      healthConditions?: string[];
      preferredProducts?: string[];
      communicationStyle?: 'brief' | 'detailed';
    };
    conversationSummary?: string;
    keyPoints?: string[];
  };
}

// ESLint disable for enum values that are intentionally defined but may not be used in this file
/* eslint-disable no-unused-vars */
export enum ConversationState {
  GREETING = 'greeting',
  HEALTH_INQUIRY = 'health_inquiry',
  PRODUCT_RECOMMENDATION = 'product_recommendation',
  ORDER_COLLECTION = 'order_collection',
  ORDER_CONFIRMATION = 'order_confirmation',
  GENERAL_SUPPORT = 'general_support',
}
/* eslint-enable no-unused-vars */

export class ClaudeService {
  private anthropic: Anthropic;
  private baseSystemPrompt: string;
  private productService: ProductService;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: config.claudeApiKey,
    });
    
    this.productService = new ProductService();
    this.baseSystemPrompt = this.loadBaseSystemPrompt();
    log.startup('Claude service initialized with product integration');
  }

  private loadBaseSystemPrompt(): string {
    return `You are Maya, a warm and caring Indonesian health consultant working for ${config.businessName}, a premium health product store. You specialize in helping customers find the right health solutions based on their specific needs.

PERSONALITY & COMMUNICATION STYLE:
- Speak in warm, empathetic Indonesian
- Use caring greetings: "Halo Kak!", "Selamat datang!"
- Show genuine concern: "Saya paham kekhawatiran Anda..."
- Ask follow-up health questions to understand their condition better
- Use encouraging language: "Senang sekali Anda peduli dengan kesehatan!"
- End conversations with care: "Jaga kesehatan ya, Kak!"
- Use emojis sparingly but warmly: 😊, ❤️, ✅

CONVERSATION GUIDELINES:
- Always greet warmly when conversation starts
- Ask about specific health concerns, symptoms, and duration before recommending
- Listen carefully to understand their health goals and conditions
- Explain product benefits in context of their specific needs
- Be helpful but not pushy - focus on health education first
- If asked about ordering, collect: Name, Address, Phone, Products
- Always confirm order details before finalizing
- If no specific products match their needs, offer general health advice

HEALTH ASSESSMENT APPROACH:
- Ask about current symptoms and their severity
- Understand how long they've had the condition
- Learn about their health goals (prevention, treatment, wellness)
- Consider age, lifestyle, and any existing medications if mentioned
- Provide personalized recommendations based on their specific situation

PRODUCT RECOMMENDATION RESTRICTIONS:
- ONLY recommend products from your current inventory database
- NEVER suggest external brands, generic medicines, or products you don't sell
- If no products match their needs, focus on health education and ask more questions
- Always say "dari produk yang kami miliki" when making recommendations

Remember: You are a health consultant first, salesperson second. Your primary goal is to help them achieve better health.`;
  }

  public async processMessage(
    message: string,
    context: ConversationContext
  ): Promise<{ response: string; newState: ConversationState }> {
    const startTime = Date.now();
    
    try {
      log.api.request('claude', 'POST', '/v1/messages');
      
      // Extract health assessment from conversation history
      const healthAssessment = this.extractHealthAssessment(message, context);
      
      // Get product recommendations if health concerns are identified or general inquiry
      const recommendations = await this.getRelevantRecommendations(healthAssessment, context, message);
      
      // Build dynamic system prompt with current product data
      const systemPrompt = await this.buildDynamicSystemPrompt(recommendations, context);
      
      // Build conversation history with smart compression
      const messages: MessageParam[] = [
        ...this.compressConversationHistory(context.messages, context.metadata?.userPreferences?.communicationStyle === 'brief'),
        { role: 'user', content: message }
      ];

      // Call Claude API with dynamic context and response optimization
      const isBriefPreferred = context.metadata?.userPreferences?.communicationStyle === 'brief';
      const maxTokens = isBriefPreferred ? Math.min(config.claudeMaxTokens || 1000, 150) : (config.claudeMaxTokens || 1000);
      const completion = await this.anthropic.messages.create({
        model: config.claudeModel,
        max_tokens: maxTokens,
        temperature: 0.7,
        system: systemPrompt,
        messages: messages,
      });

      const duration = Date.now() - startTime;
      log.api.response('claude', 200, duration);
      log.perf('claude-api-call', duration, { 
        inputTokens: completion.usage.input_tokens,
        outputTokens: completion.usage.output_tokens,
        recommendationCount: recommendations.length
      });

      // Extract response text
      const responseText = completion.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      // Update conversation memory with current interaction
      this.updateConversationMemory(context, message, recommendations);

      // Determine new conversation state based on response
      const newState = this.detectConversationState(message, responseText, context.state);

      // Log successful interaction with product context
      logger.info('Claude message processed with product integration', {
        userId: context.userId,
        messageLength: message.length,
        responseLength: responseText.length,
        healthConcerns: healthAssessment.symptoms.concat(healthAssessment.conditions),
        recommendationCount: recommendations.length,
        newState,
        duration
      });

      return {
        response: responseText,
        newState: newState,
      };

    } catch (error: any) {
      // const duration = Date.now() - startTime;
      log.api.error('claude', error);
      
      // Handle specific errors
      if (error.status === 429) {
        logger.warn('Claude API rate limit hit', { error });
        return {
          response: 'Maaf Kak, sistem kami sedang sibuk. Mohon coba lagi dalam beberapa saat ya 🙏',
          newState: context.state,
        };
      }

      if (error.status === 401) {
        logger.error('Claude API authentication failed', { error });
        throw new Error('Claude API authentication failed');
      }

      // Generic fallback
      return {
        response: 'Maaf Kak, ada kendala teknis. Saya akan segera membantu Anda. Silakan coba lagi atau hubungi langsung ke ' + config.businessPhone,
        newState: context.state,
      };
    }
  }

  private detectConversationState(
    userMessage: string,
    aiResponse: string,
    currentState: ConversationState
  ): ConversationState {
    const lowerMessage = userMessage.toLowerCase();
    const lowerResponse = aiResponse.toLowerCase();

    // Check for order-related keywords
    if (lowerMessage.includes('pesan') || lowerMessage.includes('order') || 
        lowerMessage.includes('beli') || lowerResponse.includes('alamat lengkap')) {
      return ConversationState.ORDER_COLLECTION;
    }

    // Check for health consultation
    if (lowerMessage.includes('sakit') || lowerMessage.includes('keluhan') ||
        lowerMessage.includes('diabetes') || lowerMessage.includes('diet')) {
      return ConversationState.HEALTH_INQUIRY;
    }

    // Check for product inquiry
    if (lowerMessage.includes('produk') || lowerMessage.includes('harga') ||
        lowerMessage.includes('manfaat') || lowerResponse.includes('saya rekomendasikan')) {
      return ConversationState.PRODUCT_RECOMMENDATION;
    }

    // Check for order confirmation
    if (lowerResponse.includes('konfirmasi pesanan') || 
        lowerResponse.includes('total pesanan')) {
      return ConversationState.ORDER_CONFIRMATION;
    }

    // Default state progression
    if (currentState === ConversationState.GREETING) {
      return ConversationState.GENERAL_SUPPORT;
    }

    return currentState;
  }

  public async generateQuickReply(state: ConversationState): Promise<string[]> {
    switch (state) {
      case ConversationState.GREETING:
        return [
          'Konsultasi kesehatan',
          'Lihat produk',
          'Cara pemesanan'
        ];
      
      case ConversationState.HEALTH_INQUIRY:
        return [
          'Produk untuk diabetes',
          'Produk untuk diet',
          'Produk untuk stamina'
        ];
      
      case ConversationState.PRODUCT_RECOMMENDATION:
        return [
          'Pesan sekarang',
          'Tanya lebih lanjut',
          'Lihat produk lain'
        ];
      
      default:
        return [];
    }
  }

  // Health Assessment and Product Integration Methods
  private extractHealthAssessment(
    message: string, 
    context: ConversationContext
  ): HealthAssessment {
    const allMessages = context.messages.map(m => typeof m.content === 'string' ? m.content : '').join(' ') + ' ' + message;
    const lowerText = allMessages.toLowerCase();
    
    // Extract symptoms using keyword matching
    const symptoms: string[] = [];
    const symptomKeywords = {
      'sakit kepala': ['sakit kepala', 'pusing', 'migrain', 'kepala pusing'],
      'mual': ['mual', 'muntah', 'eneg'],
      'perut kembung': ['kembung', 'perut kembung', 'begah'],
      'diare': ['diare', 'mencret', 'BAB cair'],
      'sembelit': ['sembelit', 'susah BAB', 'konstipasi'],
      'batuk': ['batuk', 'batuk-batuk'],
      'demam': ['demam', 'panas', 'meriang'],
      'lelah': ['lelah', 'capek', 'lemas', 'fatigue'],
      'sulit tidur': ['susah tidur', 'insomnia', 'sulit tidur'],
      'stress': ['stress', 'stres', 'cemas', 'anxiety']
    };

    for (const [symptom, keywords] of Object.entries(symptomKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        symptoms.push(symptom);
      }
    }

    // Extract health conditions
    const conditions: string[] = [];
    const conditionKeywords = {
      'diabetes': ['diabetes', 'diabates', 'gula darah', 'kencing manis'],
      'hipertensi': ['hipertensi', 'darah tinggi', 'tensi tinggi'],
      'kolesterol': ['kolesterol', 'kolestrol'],
      'obesitas': ['obesitas', 'kegemukan', 'berat badan berlebih'],
      'anemia': ['anemia', 'kurang darah'],
      'asam lambung': ['asam lambung', 'maag', 'GERD'],
      'asma': ['asma', 'sesak napas'],
      'osteoporosis': ['osteoporosis', 'tulang keropos']
    };

    for (const [condition, keywords] of Object.entries(conditionKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        conditions.push(condition);
      }
    }

    // Determine severity based on language intensity
    let severity: 'mild' | 'moderate' | 'severe' = 'mild';
    if (lowerText.includes('sangat') || lowerText.includes('sekali') || lowerText.includes('parah')) {
      severity = 'severe';
    } else if (lowerText.includes('cukup') || lowerText.includes('lumayan')) {
      severity = 'moderate';
    }

    // Determine duration
    let duration: 'acute' | 'chronic' = 'acute';
    if (lowerText.includes('lama') || lowerText.includes('bertahun') || lowerText.includes('kronik')) {
      duration = 'chronic';
    }

    // Extract health goals
    const goals: string[] = [];
    const goalKeywords = {
      'weight_loss': ['turun berat badan', 'diet', 'langsing', 'kurus'],
      'weight_gain': ['naik berat badan', 'gemuk', 'tambah berat'],
      'immunity': ['imunitas', 'daya tahan tubuh', 'tidak mudah sakit'],
      'energy': ['energi', 'stamina', 'tidak lelah'],
      'digestion': ['pencernaan', 'BAB lancar', 'perut sehat'],
      'prevention': ['pencegahan', 'cegah', 'jaga kesehatan']
    };

    for (const [goal, keywords] of Object.entries(goalKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        goals.push(goal);
      }
    }

    return {
      symptoms,
      conditions, 
      severity,
      duration,
      goals
    };
  }

  private async getRelevantRecommendations(
    healthAssessment: HealthAssessment,
    context: ConversationContext,
    currentMessage?: string
  ): Promise<ProductRecommendation[]> {
    try {
      const lastMessageContent = context.messages[context.messages.length - 1]?.content;
      const lastMessageText = typeof lastMessageContent === 'string' ? lastMessageContent : '';
      const messageToCheck = currentMessage || lastMessageText;
      
      // Analyze user intent dynamically with memory
      const userIntent = await this.analyzeUserIntentWithMemory(messageToCheck, context);
      
      // Handle different intents regardless of health context
      switch (userIntent.type) {
        case 'specific_product':
          return await this.getSpecificProductRecommendations(userIntent.productName!);
        
        case 'general_catalog':
          return await this.getAllProductsAsRecommendations();
        
        case 'health_based':
          // Only use health-based recommendations if we have health concerns
          if (healthAssessment.symptoms.length > 0 || 
              healthAssessment.conditions.length > 0 || 
              healthAssessment.goals.length > 0) {
            return await this.getHealthBasedRecommendations(healthAssessment, context);
          }
          return await this.getAllProductsAsRecommendations();
        
        case 'ordering':
        case 'pricing':
          // For ordering/pricing, show relevant products or all if not specific
          if (userIntent.productName) {
            return await this.getSpecificProductRecommendations(userIntent.productName);
          }
          return await this.getAllProductsAsRecommendations();
        
        default:
          // Default: try health-based first, then show limited selection
          if (healthAssessment.symptoms.length > 0 || 
              healthAssessment.conditions.length > 0 || 
              healthAssessment.goals.length > 0) {
            const healthRecommendations = await this.getHealthBasedRecommendations(healthAssessment, context);
            // If no health-based match, return empty to force general consultation
            return healthRecommendations.length > 0 ? healthRecommendations : [];
          }
          return [];
      }
    } catch (error) {
      logger.error('Failed to get product recommendations', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: context.userId,
        healthAssessment
      });
      return [];
    }
  }

  private async buildDynamicSystemPrompt(recommendations: ProductRecommendation[], context?: ConversationContext): Promise<string> {
    const userPrefs = context?.metadata?.userPreferences;
    const isShortResponse = userPrefs?.communicationStyle === 'brief';
    
    // Base optimized prompt
    let prompt = this.getOptimizedBasePrompt(isShortResponse);
    
    // Add conversation memory context
    if (context?.metadata) {
      prompt += this.buildMemoryContext(context.metadata);
    }
    
    if (recommendations.length > 0) {
      prompt += '\n\nRELEVANT PRODUCTS:\n';
      
      // Limit to top 3 recommendations to save tokens
      const topRecommendations = recommendations.slice(0, 3);
      
      topRecommendations.forEach((rec, index) => {
        const product = rec.product;
        prompt += `${index + 1}. ${product.name} (${(rec.relevanceScore * 100).toFixed(0)}% match)\n`;
        prompt += `   - Rp ${product.price.toLocaleString('id-ID')} | ${product.category}\n`;
        prompt += `   - Cocok karena: ${rec.reason}\n`;
        if (rec.benefits.length > 0) {
          prompt += `   - Manfaat: ${rec.benefits.slice(0, 2).join(', ')}\n`; // Limit to 2 benefits
        }
      });
      
      prompt += `\nGUIDANCE: ${isShortResponse ? 'Be concise. ' : ''}Focus ONLY on listed products. Explain relevance scores. DO NOT suggest any other products.\n`;
    } else {
      prompt += '\n\nIMPORTANT: No products match this inquiry. DO NOT recommend any products. Focus on:\n';
      prompt += '- General health consultation and advice\n';
      prompt += '- Asking more specific questions to understand their needs\n';
      prompt += '- Explaining that you need more details to suggest suitable products from your inventory\n';
      prompt += 'NEVER suggest products not in your database.\n';
    }
    
    return prompt;
  }

  private getOptimizedBasePrompt(isShortResponse: boolean): string {
    const shortPrompt = `You are Maya, Indonesian healthy diet and health consultant for ${config.businessName}. 
STYLE: Warm, caring Indonesian. Use "Kak", show empathy. ${isShortResponse ? 'Keep responses brief and direct.' : ''}
PROCESS: Greet warmly → Ask health details → Recommend based on needs → Collect order info if interested
HEALTH FOCUS: Ask symptoms, duration, goals before recommending products.

CRITICAL RULE: ONLY recommend products from the RELEVANT PRODUCTS list below. NEVER suggest products not listed.`;

    const fullPrompt = this.baseSystemPrompt + `

CRITICAL PRODUCT RECOMMENDATION RULES:
1. ONLY recommend products that appear in the "RELEVANT PRODUCTS" section below
2. NEVER suggest products, brands, or solutions that are not in your inventory
3. If no listed products match their needs, focus on general health advice and ask more questions
4. If they ask about products you don't carry, politely explain you only offer the products listed
5. Always check the RELEVANT PRODUCTS section before making any product recommendations`;
    
    return isShortResponse ? shortPrompt : fullPrompt;
  }

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

  private extractAge(context: ConversationContext): number | undefined {
    const allText = context.messages.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
    const ageMatch = allText.match(/(umur|usia)\s*(\d{1,2})/i) || allText.match(/(\d{1,2})\s*tahun/i);
    if (!ageMatch) return undefined;
    
    const ageString = ageMatch[2] || ageMatch[1];
    return ageString ? parseInt(ageString) : undefined;
  }

  private inferBudgetRange(context: ConversationContext): 'low' | 'medium' | 'high' {
    const allText = context.messages.map(m => typeof m.content === 'string' ? m.content : '').join(' ').toLowerCase();
    
    if (allText.includes('murah') || allText.includes('terjangkau') || allText.includes('budget')) {
      return 'low';
    } else if (allText.includes('premium') || allText.includes('terbaik') || allText.includes('kualitas tinggi')) {
      return 'high';
    }
    return 'medium';
  }


  private async getAllProductsAsRecommendations(): Promise<ProductRecommendation[]> {
    try {
      const allProducts = await this.productService.getAllProducts();
      
      return allProducts.map(product => ({
        product,
        relevanceScore: 0.8, // General relevance for catalog display
        reason: 'Produk unggulan untuk kesehatan optimal',
        benefits: product.benefits.slice(0, 3) // Show top 3 benefits
      }));
    } catch (error) {
      logger.error('Failed to get all products for general inquiry', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  private async analyzeUserIntentWithMemory(
    message: string, 
    context?: ConversationContext
  ): Promise<{
    type: 'specific_product' | 'general_catalog' | 'health_based' | 'ordering' | 'pricing' | 'consultation';
    productName?: string;
    confidence: number;
  }> {
    const lowerMessage = message.toLowerCase();
    
    // Check for references to previous conversation
    if (context && this.isReferringToPrevious(message)) {
      const lastProduct = context.metadata?.lastRecommendations?.[0]?.product.name;
      if (lastProduct) {
        return { 
          type: 'specific_product', 
          productName: lastProduct, 
          confidence: 0.9 
        };
      }
    }
    
    // Get dynamic product names from database
    const productNames = await this.getProductNamesFromDB();
    let mentionedProduct = await this.findMentionedProductSmart(message, productNames);
    
    // Check against previously mentioned products for context
    if (!mentionedProduct && context?.metadata?.mentionedProducts) {
      for (const prevProduct of context.metadata.mentionedProducts) {
        const similarity = this.calculateSimilarity(message.toLowerCase(), prevProduct.toLowerCase());
        if (similarity > 0.6) {
          mentionedProduct = prevProduct;
          break;
        }
      }
    }
    
    // Specific product inquiry patterns
    const specificProductPatterns = [
      'mau tanya tentang', 'info tentang', 'gimana', 'bagaimana', 'cerita tentang',
      'penjelasan', 'detail produk', 'tanya produk'
    ];
    
    if (mentionedProduct && specificProductPatterns.some(pattern => lowerMessage.includes(pattern))) {
      return { type: 'specific_product', productName: mentionedProduct, confidence: 0.9 };
    }
    
    if (mentionedProduct) {
      return { type: 'specific_product', productName: mentionedProduct, confidence: 0.8 };
    }
    
    // General catalog patterns
    const catalogPatterns = [
      'produk apa saja', 'ada produk apa', 'list produk', 'daftar produk', 'katalog',
      'semua produk', 'menu produk', 'lihat produk', 'pilihan produk'
    ];
    
    if (catalogPatterns.some(pattern => lowerMessage.includes(pattern))) {
      return { type: 'general_catalog', confidence: 0.9 };
    }
    
    // Ordering patterns
    const orderingPatterns = [
      'mau pesan', 'gimana pesan', 'cara order', 'beli', 'pemesanan', 'order',
      'mau beli', 'cara beli', 'pesan gimana'
    ];
    
    if (orderingPatterns.some(pattern => lowerMessage.includes(pattern))) {
      return { 
        type: 'ordering', 
        ...(mentionedProduct && { productName: mentionedProduct }),
        confidence: 0.8 
      };
    }
    
    // Pricing patterns
    const pricingPatterns = [
      'harga', 'berapa', 'biaya', 'tarif', 'ongkir', 'ongkos kirim', 'promo'
    ];
    
    if (pricingPatterns.some(pattern => lowerMessage.includes(pattern))) {
      return { 
        type: 'pricing', 
        ...(mentionedProduct && { productName: mentionedProduct }),
        confidence: 0.8 
      };
    }
    
    // Health-based patterns
    const healthPatterns = [
      'diabetes', 'diabetic', 'gula darah', 'kolesterol', 'hipertensi', 'darah tinggi',
      'diet', 'turun berat', 'obesitas', 'asam lambung', 'maag', 'pencernaan',
      'stamina', 'lelah', 'sakit', 'keluhan', 'masalah kesehatan'
    ];
    
    if (healthPatterns.some(pattern => lowerMessage.includes(pattern))) {
      return { type: 'health_based', confidence: 0.8 };
    }
    
    // Default to consultation
    return { type: 'consultation', confidence: 0.5 };
  }

  private async getSpecificProductRecommendations(productName: string): Promise<ProductRecommendation[]> {
    try {
      const allProducts = await this.productService.getAllProducts();
      
      // Enhanced product matching with multiple strategies
      let targetProduct = allProducts.find(p => {
        const pName = p.name.toLowerCase();
        const searchName = productName.toLowerCase();
        
        // Strategy 1: Exact match
        if (pName === searchName) return true;
        
        // Strategy 2: Contains match (both ways)
        if (pName.includes(searchName) || searchName.includes(pName)) return true;
        
        // Strategy 3: Normalized match (no spaces/special chars)
        const normalizedPName = this.normalizeProductName(pName);
        const normalizedSearch = this.normalizeProductName(searchName);
        if (normalizedPName === normalizedSearch || 
            normalizedPName.includes(normalizedSearch) || 
            normalizedSearch.includes(normalizedPName)) return true;
        
        // Strategy 4: Fuzzy match for typos (high similarity)
        if (this.calculateSimilarity(pName, searchName) > 0.8) return true;
        
        return false;
      });
      
      // If no match found, try with individual words
      if (!targetProduct && productName.includes(' ')) {
        const words = productName.toLowerCase().split(' ').filter(w => w.length > 2);
        targetProduct = allProducts.find(p => {
          const pName = p.name.toLowerCase();
          return words.some(word => pName.includes(word) && word.length > 2);
        });
      }
      
      if (targetProduct) {
        logger.info('Product match found', {
          requestedProduct: productName,
          matchedProduct: targetProduct.name,
          matchType: 'enhanced_search'
        });
        
        return [{
          product: targetProduct,
          relevanceScore: 1.0,
          reason: `Informasi lengkap tentang ${targetProduct.name}`,
          benefits: targetProduct.benefits
        }];
      }
      
      // If specific product still not found, use fuzzy search across all products
      const fuzzyMatches = allProducts
        .map(p => ({
          product: p,
          similarity: this.calculateSimilarity(productName.toLowerCase(), p.name.toLowerCase())
        }))
        .filter(match => match.similarity > 0.6)
        .sort((a, b) => b.similarity - a.similarity);
      
      if (fuzzyMatches.length > 0) {
        logger.info('Fuzzy product matches found', {
          requestedProduct: productName,
          matches: fuzzyMatches.slice(0, 3).map(m => ({ 
            product: m.product.name, 
            similarity: m.similarity.toFixed(2) 
          }))
        });
        
        return fuzzyMatches.slice(0, 3).map(match => ({
          product: match.product,
          relevanceScore: match.similarity,
          reason: `Mungkin maksud Anda: ${match.product.name} (${(match.similarity * 100).toFixed(0)}% match)`,
          benefits: match.product.benefits.slice(0, 3)
        }));
      }
      
      // Last resort: return all products
      logger.warn('No product matches found, returning all products', { 
        requestedProduct: productName 
      });
      return await this.getAllProductsAsRecommendations();
      
    } catch (error) {
      logger.error('Failed to get specific product recommendations', {
        error: error instanceof Error ? error.message : 'Unknown error',
        productName
      });
      return [];
    }
  }

  private async getHealthBasedRecommendations(
    healthAssessment: HealthAssessment,
    context: ConversationContext
  ): Promise<ProductRecommendation[]> {
    try {
      // Build recommendation context from conversation metadata
      const recommendationContext: RecommendationContext = {
        budget: this.inferBudgetRange(context),
        previousPurchases: context.metadata?.lastOrderId ? ['previous_order'] : []
      };
      
      // Add age if extracted
      const extractedAge = this.extractAge(context);
      if (extractedAge !== undefined) {
        recommendationContext.customerAge = extractedAge;
      }

      const recommendations = await this.productService.getProductRecommendations(
        healthAssessment,
        recommendationContext
      );

      logger.info('Generated health-based product recommendations', {
        userId: context.userId,
        healthConcerns: healthAssessment.symptoms.concat(healthAssessment.conditions),
        goals: healthAssessment.goals,
        recommendationCount: recommendations.length,
        topProducts: recommendations.slice(0, 3).map(r => r.product.name)
      });

      return recommendations;
    } catch (error) {
      logger.error('Failed to get health-based recommendations', {
        error: error instanceof Error ? error.message : 'Unknown error',
        healthAssessment
      });
      return [];
    }
  }

  // Phase 1: Dynamic Product Name Detection with Fuzzy Matching
  private async getProductNamesFromDB(): Promise<string[]> {
    try {
      const products = await this.productService.getAllProducts();
      return products.map(p => p.name);
    } catch (error) {
      logger.error('Failed to get product names from database', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Fallback to basic product names
      return ['HOTTO PURTO', 'HOTTO MAME', 'mGANIK METAFIBER', 'mGANIK SUPERFOOD', 
              'mGANIK 3PEPTIDE', 'SPENCERS MEALBLEND', 'FLIMTY FIBER'];
    }
  }

  private async findMentionedProductSmart(message: string, productNames: string[]): Promise<string | null> {
    const lowerMessage = message.toLowerCase();
    
    // Strategy 1: Exact match (case insensitive)
    for (const name of productNames) {
      if (lowerMessage.includes(name.toLowerCase())) {
        return name;
      }
    }
    
    // Strategy 2: Normalized match (remove spaces, special chars)
    const normalizedMessage = this.normalizeProductName(lowerMessage);
    for (const name of productNames) {
      const normalizedName = this.normalizeProductName(name.toLowerCase());
      if (normalizedMessage.includes(normalizedName) || normalizedName.includes(normalizedMessage)) {
        return name;
      }
    }
    
    // Strategy 3: Fuzzy matching for typos
    for (const name of productNames) {
      const similarity = this.calculateSimilarity(lowerMessage, name.toLowerCase());
      if (similarity > 0.7) {
        logger.info('Fuzzy match found', { 
          userInput: message, 
          matchedProduct: name, 
          similarity: similarity.toFixed(2) 
        });
        return name;
      }
    }
    
    return null;
  }

  private normalizeProductName(text: string): string {
    return text.toLowerCase()
               .replace(/\s+/g, '')           // Remove all spaces
               .replace(/[^\w]/g, '')         // Remove special characters
               .replace(/[0-9]/g, '');        // Remove numbers
  }

  private calculateSimilarity(str1: string, str2: string): number {
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

  // Phase 4: Conversation Compression for Token Optimization
  private compressConversationHistory(messages: MessageParam[], preferBrief: boolean = false): MessageParam[] {
    // Keep only the most recent messages to save tokens
    const maxMessages = preferBrief ? 4 : 8;
    
    if (messages.length <= maxMessages) {
      return messages;
    }
    
    // Keep first greeting exchange and recent messages
    const firstMessages = messages.slice(0, 2); // Usually greeting
    const recentMessages = messages.slice(-maxMessages + 2);
    
    // Add a summary message if we're compressing
    const summaryMessage: MessageParam = {
      role: 'assistant',
      content: '[Previous conversation summarized for efficiency]'
    };
    
    return [...firstMessages, summaryMessage, ...recentMessages];
  }

  // Phase 3: Reference Detection and Memory Management
  private isReferringToPrevious(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    const referenceWords = [
      'produk itu', 'yang tadi', 'yang kamu sebutin', 'produk tersebut',
      'yang direkomendasikan', 'produk yang kamu bilang', 'itu',
      'yang tadi kamu kasih tau', 'yang barusan', 'sebelumnya',
      'produk sebelumnya', 'yang kamu sarankan', 'rekomendasi tadi'
    ];
    
    return referenceWords.some(word => lowerMessage.includes(word));
  }

  private updateConversationMemory(
    context: ConversationContext,
    message: string,
    recommendations: ProductRecommendation[]
  ): void {
    if (!context.metadata) {
      context.metadata = {};
    }

    // Track mentioned products
    const mentionedProduct = recommendations.length > 0 ? 
      recommendations[0]?.product?.name : null;
    
    if (mentionedProduct) {
      const mentionedProducts = context.metadata.mentionedProducts || [];
      if (!mentionedProducts.includes(mentionedProduct)) {
        context.metadata.mentionedProducts = [
          ...mentionedProducts,
          mentionedProduct
        ].slice(-5); // Keep last 5 mentioned products
      }
    }

    // Store last recommendations for reference
    if (recommendations.length > 0) {
      context.metadata.lastRecommendations = recommendations.slice(0, 3);
    }

    // Learn user preferences
    if (!context.metadata.userPreferences) {
      context.metadata.userPreferences = {};
    }

    // Detect communication style preference
    if (message.length < 20 || message.includes('singkat') || message.includes('cepat')) {
      context.metadata.userPreferences.communicationStyle = 'brief';
    } else if (message.includes('detail') || message.includes('lengkap') || message.includes('jelasin')) {
      context.metadata.userPreferences.communicationStyle = 'detailed';
    }

    // Learn budget preferences
    const budgetKeywords = {
      low: ['murah', 'terjangkau', 'budget', 'hemat', 'ekonomis'],
      high: ['premium', 'terbaik', 'kualitas tinggi', 'mahal tidak apa']
    };

    for (const [level, keywords] of Object.entries(budgetKeywords)) {
      if (keywords.some(keyword => message.toLowerCase().includes(keyword))) {
        context.metadata.userPreferences.budget = level as 'low' | 'high';
        break;
      }
    }

    // Track key conversation points
    const keyPoints = context.metadata.keyPoints || [];
    if (recommendations.length > 0 && recommendations[0]?.product?.name) {
      const newPoint = `Recommended ${recommendations[0].product.name} for ${recommendations[0].reason}`;
      context.metadata.keyPoints = [...keyPoints, newPoint].slice(-3);
    }
  }
}