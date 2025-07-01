import { config } from '@/config/environment';
import { HealthAssessment, ProductService, RecommendationContext } from '@/products/product-service';
import { log, logger } from '@/shared/logger';
import { ProductRecommendation } from '@/types/product';
import { OrderCollection } from '@/types/order';
import { OrderService } from '@/orders/order-service';
import { DietPlanningService, DietProfile, DietGoal, PersonalizedRecommendation } from '@/diet/diet-planning-service-simple';
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
    // Order processing
    currentOrder?: OrderCollection;
    orderStep?: 'cart' | 'customer_info' | 'shipping' | 'confirmation';
    // Diet planning
    dietProfile?: DietProfile;
    personalizedPlan?: {
      recommendations: PersonalizedRecommendation[];
      currentWeek?: number;
      progressTracking?: Record<string, any>;
    };
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
  private orderService: OrderService;
  private dietPlanningService: DietPlanningService;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: config.claudeApiKey,
    });
    
    this.productService = new ProductService();
    this.orderService = new OrderService();
    this.dietPlanningService = new DietPlanningService();
    this.baseSystemPrompt = this.loadBaseSystemPrompt();
    log.startup('Claude service initialized with product integration and order processing');
  }

  private loadBaseSystemPrompt(): string {
    return `You are Maya, a caring and knowledgeable diet consultant from ${config.businessName}. You help people achieve their body goals and health objectives through personalized guidance and our specialized health products.

COMMUNICATION STYLE - BE NATURAL & CONVERSATIONAL:
- Talk like a real person, not a chatbot
- Keep responses SHORT (1-3 sentences max) unless detailed explanation is needed
- Use warm, casual Indonesian: "Halo kak!", "Gimana kabarnya?", "Wah bagus nih!"
- Be encouraging: "Pasti bisa!", "Keren goalnya!", "Semangat ya!"
- Show genuine interest: "Cerita dong...", "Oh gitu ya...", "Menarik nih..."
- NO numbered lists, NO menu options, NO "Silakan pilih"
- Make it feel like chatting with a knowledgeable friend

FOCUS: DIET & BODY GOALS CONSULTATION

🚨 CRITICAL ANTI-HALLUCINATION RULES:
- NEVER invent product details (flavors, ingredients, features) not in the PRODUCTS section below
- ONLY mention product information explicitly provided in the current conversation context
- If you don't know a specific detail, say "Let me check the exact details for you" 
- DO NOT assume or guess product specifications, flavors, or features
- STICK STRICTLY to the provided product database information

Your main products and their general purposes:
- HOTTO PURTO/MAME: Multi-benefit health drinks (see PRODUCTS section for exact details)
- Spencer's MealBlend: Weight loss meal replacement
- Mganik MetaFiber & Superfood: Diabetes management, blood sugar control  
- 3Peptide: Hypertension/high blood pressure control
- Flimty Fiber: Digestive health and detox

CONVERSATION APPROACH:
1. Ask about their health/body goals naturally
2. Listen to their challenges and current situation  
3. Suggest products that can help their specific goals
4. Explain how to use products for best results
5. Give practical diet and lifestyle tips
6. Only mention ordering when they show interest

RESPONSE GUIDELINES:
- Start with empathy/understanding
- Give ONE main suggestion per message
- Explain WHY it helps their specific situation
- End with a natural follow-up question
- Be supportive and motivating

DIET & HEALTH GOALS EXPERTISE:
Common goals you help with:
- Weight loss/turun berat badan
- Diabetes/gula darah tinggi  
- Hypertension/darah tinggi
- Digestive issues/masalah pencernaan
- GERD/maag
- General health/kesehatan umum
- Body goals/target badan ideal

NATURAL CONSULTATION FLOW:
- "Goalnya apa nih?" (understand their objectives)
- "Udah coba apa aja?" (learn their current efforts)
- "Kendala utamanya dimana?" (identify main challenges)
- Give specific, practical advice for their situation
- Suggest relevant products naturally in conversation
- Share usage tips and realistic expectations

ORDERING (ONLY when they ask):
Just ask: "Mau order yang mana?" then get:
- Nama lengkap
- Nomor WA aktif  
- Alamat lengkap
- Pilihan pembayaran sesuai daerah

IMPORTANT RULES:
- NEVER list products like a menu
- NEVER use formal language or numbered options
- Only recommend products you actually have
- Give diet/lifestyle tips along with product suggestions
- Be encouraging about their goals
- Keep responses conversational and brief

Remember: You're their supportive diet buddy, not a sales robot! 😊`;
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

  public async generateQuickReply(_state: ConversationState): Promise<string[]> {
    // Disabled for natural conversation flow - Maya guides users naturally through follow-up questions
    return [];
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
        
        case 'add_to_cart':
          // Handle adding products to cart
          if (userIntent.productName) {
            const productRecommendations = await this.getSpecificProductRecommendations(userIntent.productName);
            if (productRecommendations.length > 0 && productRecommendations[0]) {
              this.handleAddToCart(context, productRecommendations[0]);
            }
            return productRecommendations;
          }
          return await this.getAllProductsAsRecommendations();
        
        case 'checkout':
          // Handle checkout process
          return this.handleCheckout(context);
        
        case 'order_info':
          // Handle order information collection
          return this.handleOrderInfoCollection(context, currentMessage || '');
        
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
    
    // Add order context if there's an active order
    if (context?.metadata?.currentOrder && context.metadata.currentOrder.items.length > 0) {
      prompt += '\n\nACTIVE ORDER CONTEXT:\n';
      prompt += `- Customer is in ordering process (Step: ${context.metadata.orderStep || 'cart'})\n`;
      prompt += `- Cart items: ${context.metadata.currentOrder.items.length}\n`;
      prompt += `- Total: Rp ${context.metadata.currentOrder.totalAmount.toLocaleString('id-ID')}\n`;
      
      if (context.metadata.orderStep === 'customer_info') {
        prompt += '- Currently collecting: Name, WhatsApp, Address\n';
      } else if (context.metadata.orderStep === 'shipping') {
        prompt += '- Currently selecting: Shipping & Payment options\n';
      }
      
      prompt += 'Guide customer through the order completion process.\n\n';
    }

    if (recommendations.length > 0) {
      prompt += '\n\nPRODUK YANG BISA BANTU:\n';
      
      // Show top 2 most relevant products
      const topRecommendations = recommendations.slice(0, 2);
      
      topRecommendations.forEach((rec) => {
        const product = rec.product;
        prompt += `• ${product.name} - Rp ${product.price.toLocaleString('id-ID')}\n`;
        prompt += `  Kenapa cocok: ${rec.reason}\n`;
        if (rec.benefits.length > 0) {
          prompt += `  Manfaat: ${rec.benefits.slice(0, 2).join(' & ')}\n`;
        }
        prompt += `  Cara pakai: ${product.dosage}\n`;
        
        // Add complete product details to prevent hallucination
        prompt += `  Ingredients: ${product.ingredients.join(', ')}\n`;
        prompt += `  Category: ${product.category}\n`;
        prompt += `  Suitable for: ${product.suitableFor.join(', ')}\n`;
        if (product.warnings && product.warnings.length > 0) {
          prompt += `  Warnings: ${product.warnings.join(', ')}\n`;
        }
        
        // Add metadata details if available
        if (product.metadata) {
          const meta = product.metadata as any;
          
          // Product specifications (flavor, texture, color, etc.)
          if (meta.productSpecs) {
            const specs = meta.productSpecs;
            if (specs.flavor) prompt += `  Flavor: ${specs.flavor}\n`;
            if (specs.texture) prompt += `  Texture: ${specs.texture}\n`;
            if (specs.color) prompt += `  Color: ${specs.color}\n`;
            if (specs.sweetness) prompt += `  Sweetness: ${specs.sweetness}\n`;
          }
          
          // Nutritional information
          if (meta.calories) prompt += `  Calories: ${meta.calories} per serving\n`;
          if (meta.fiber) prompt += `  Fiber: ${meta.fiber} per serving\n`;
          if (meta.protein) prompt += `  Protein: ${meta.protein} per serving\n`;
          
          // Clinical information
          if (meta.clinicalInfo) {
            const clinical = meta.clinicalInfo;
            if (clinical.proven) prompt += `  Clinical Evidence: ${clinical.proven}\n`;
          }
          
          // Special features
          if (meta.specialFeatures) {
            const features = Object.keys(meta.specialFeatures).filter(key => meta.specialFeatures[key]);
            if (features.length > 0) {
              prompt += `  Features: ${features.join(', ')}\n`;
            }
          }
        }
        prompt += `\n`;
      });
      
      prompt += `
🚨 CRITICAL PRODUCT GUIDELINES:
- ONLY mention details explicitly listed above for each product
- DO NOT invent flavors, colors, ingredients, or features not specified
- If customer asks about details not listed, say "Let me check that specific detail for you"
- NEVER assume product specifications beyond what's provided
- Suggest naturally in conversation, explain benefits for their specific situation\n`;
    } else {
      prompt += '\n\nTidak ada produk yang cocok untuk kebutuhan ini.\n';
      prompt += 'Focus on: Kasih konsultasi umum, tanya lebih detail tentang goalnya, berikan tips diet/lifestyle yang praktis.\n';
      prompt += 'Jangan recommend produk apapun yang tidak ada di database.\n';
    }
    
    return prompt;
  }

  private getOptimizedBasePrompt(isShortResponse: boolean): string {
    const shortPrompt = `Kamu Maya, konsultan diet dan kesehatan dari ${config.businessName}. 
STYLE: Natural, seperti teman yang peduli. Pakai bahasa casual Indonesian. Respon SINGKAT (1-2 kalimat) kecuali butuh penjelasan detail.
APPROACH: Tanya goalnya → Dengar keluhannya → Kasih saran yang relevan → Tawarkan produk yang cocok secara natural
NO: Numbered lists, formal language, menu options, "Silakan pilih"

RULE: Cuma recommend produk dari list PRODUK YANG BISA BANTU di bawah. Never suggest anything else.`;

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
    type: 'specific_product' | 'general_catalog' | 'health_based' | 'ordering' | 'pricing' | 'consultation' | 'add_to_cart' | 'checkout' | 'order_info';
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
    
    // Add to cart patterns
    const addToCartPatterns = [
      'tambah ke keranjang', 'masukkan keranjang', 'add to cart', 'ambil produk',
      'mau ambil', 'pilih produk', 'saya mau', 'oke saya mau'
    ];
    
    if (addToCartPatterns.some(pattern => lowerMessage.includes(pattern))) {
      return {
        type: 'add_to_cart',
        ...(mentionedProduct && { productName: mentionedProduct }),
        confidence: 0.9
      };
    }
    
    // Checkout patterns
    const checkoutPatterns = [
      'checkout', 'pesan sekarang', 'proses pesanan', 'lanjut pesan', 
      'confirm order', 'konfirmasi pesanan', 'bayar sekarang'
    ];
    
    if (checkoutPatterns.some(pattern => lowerMessage.includes(pattern))) {
      return { type: 'checkout', confidence: 0.9 };
    }
    
    // Order information patterns
    const orderInfoPatterns = [
      'nama saya', 'alamat saya', 'nomor saya', 'hp saya', 'whatsapp saya',
      'transfer', 'cod', 'bayar di tempat', 'instant', 'kurir'
    ];
    
    if (orderInfoPatterns.some(pattern => lowerMessage.includes(pattern))) {
      return { type: 'order_info', confidence: 0.8 };
    }
    
    // General ordering patterns
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

  // Order Processing Methods
  private handleAddToCart(context: ConversationContext, product: ProductRecommendation): void {
    if (!context.metadata) {
      context.metadata = {};
    }
    
    if (!context.metadata.currentOrder) {
      context.metadata.currentOrder = this.orderService.createNewOrder();
    }
    
    context.metadata.currentOrder = this.orderService.addItemToOrder(
      context.metadata.currentOrder, 
      product, 
      1
    );
    
    context.metadata.orderStep = 'cart';
    
    logger.info('Product added to cart', {
      userId: context.userId,
      productName: product.product.name,
      cartItemCount: context.metadata.currentOrder.items.length
    });
  }

  private handleCheckout(context: ConversationContext): ProductRecommendation[] {
    if (!context.metadata?.currentOrder || context.metadata.currentOrder.items.length === 0) {
      // No items in cart, return empty to show consultation message
      return [];
    }
    
    context.metadata.orderStep = 'customer_info';
    
    // Return cart items as recommendations for display
    return context.metadata.currentOrder.items.map(item => ({
      product: {
        id: item.productId,
        name: item.productName,
        price: item.price,
        category: 'general_wellness' as const,
        benefits: [],
        description: '',
        ingredients: [],
        suitableFor: [],
        dosage: '',
        images: [],
        inStock: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      },
      relevanceScore: 1.0,
      reason: `${item.quantity}x dalam keranjang`,
      benefits: []
    }));
  }

  private handleOrderInfoCollection(context: ConversationContext, message: string): ProductRecommendation[] {
    if (!context.metadata?.currentOrder) {
      return [];
    }
    
    // Extract information from message
    this.extractOrderInformation(context, message);
    
    // Return current cart items
    return context.metadata.currentOrder.items.map(item => ({
      product: {
        id: item.productId,
        name: item.productName,
        price: item.price,
        category: 'general_wellness' as const,
        benefits: [],
        description: '',
        ingredients: [],
        suitableFor: [],
        dosage: '',
        images: [],
        inStock: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      },
      relevanceScore: 1.0,
      reason: `${item.quantity}x - Rp ${(item.price * item.quantity).toLocaleString('id-ID')}`,
      benefits: []
    }));
  }

  private extractOrderInformation(context: ConversationContext, message: string): void {
    if (!context.metadata?.currentOrder) return;
    
    const lowerMessage = message.toLowerCase();
    
    // Extract name
    const namePatterns = [
      /nama\s*(?:saya)?\s*:?\s*([a-zA-Z\s]+)/i,
      /saya\s+([a-zA-Z\s]+)/i,
      /^([a-zA-Z\s]+)$/i
    ];
    
    if (!context.metadata.currentOrder.customerName) {
      for (const pattern of namePatterns) {
        const match = message.match(pattern);
        if (match && match[1] && match[1].trim().length > 2) {
          context.metadata.currentOrder.customerName = match[1].trim();
          break;
        }
      }
    }
    
    // Extract phone number
    const phonePattern = /(?:hp|wa|whatsapp|nomor)?\s*:?\s*((?:\+62|62|0)[\d\s-]+)/i;
    const phoneMatch = message.match(phonePattern);
    if (phoneMatch && phoneMatch[1]) {
      context.metadata.currentOrder.whatsappNumber = phoneMatch[1].replace(/\s|-/g, '');
    }
    
    // Extract address
    if (lowerMessage.includes('alamat') || 
        (lowerMessage.includes('jl') || lowerMessage.includes('jalan') || 
         lowerMessage.includes('gang') || lowerMessage.includes('blok'))) {
      const addressMatch = message.match(/(?:alamat\s*:?\s*)?(.*)/i);
      if (addressMatch && addressMatch[1] && addressMatch[1].trim().length > 10) {
        context.metadata.currentOrder.address = addressMatch[1].trim();
        
        // Detect shipping zone
        context.metadata.currentOrder.shippingZone = this.orderService.detectShippingZone(
          context.metadata.currentOrder.address
        );
      }
    }
    
    // Extract payment method
    if (lowerMessage.includes('cod') || lowerMessage.includes('bayar di tempat')) {
      context.metadata.currentOrder.paymentMethod = 'cod';
    } else if (lowerMessage.includes('transfer') || lowerMessage.includes('tf')) {
      context.metadata.currentOrder.paymentMethod = 'transfer';
    }
    
    // Extract shipping preference
    if (lowerMessage.includes('kurir') || lowerMessage.includes('gratis')) {
      context.metadata.currentOrder.shippingOption = 'batam_courier';
    } else if (lowerMessage.includes('instant') || lowerMessage.includes('cepat')) {
      context.metadata.currentOrder.shippingOption = 'instant';
    }
  }

  // Diet Planning and Personalized Guidance Methods

  public async createPersonalizedDietPlan(
    context: ConversationContext,
    healthAssessment: HealthAssessment
  ): Promise<{ 
    dietProfile: DietProfile; 
    personalizedPlan: PersonalizedRecommendation[];
    guidanceMessage: string 
  }> {
    try {
      logger.info('Creating personalized diet plan', { 
        userId: context.userId,
        conditions: healthAssessment.conditions,
        goals: healthAssessment.goals
      });

      // Extract or build diet profile from conversation
      const dietProfile = this.buildDietProfileFromContext(context, healthAssessment);
      
      // Create personalized plan
      const planResult = await this.dietPlanningService.createPersonalizedPlan(
        dietProfile, 
        healthAssessment
      );

      // Generate user-friendly guidance message
      const guidanceMessage = this.generateDietPlanGuidanceMessage(
        planResult.recommendations,
        planResult.overallStrategy
      );

      logger.info('Personalized diet plan created successfully', {
        userId: context.userId,
        recommendationsCount: planResult.recommendations.length,
        primaryGoal: dietProfile.goals[0]?.type
      });

      return {
        dietProfile,
        personalizedPlan: planResult.recommendations,
        guidanceMessage
      };

    } catch (error) {
      logger.error('Failed to create personalized diet plan', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: context.userId
      });
      throw error;
    }
  }

  public generateDetailedProductGuidance(
    product: any,
    _userGoals: string[],
    userConditions: string[]
  ): string {
    const metadata = product.metadata as any;
    let guidance = `📋 **PANDUAN LENGKAP ${product.name.toUpperCase()}**\n\n`;

    // Detailed composition
    if (metadata?.detailedComposition) {
      guidance += `🧬 **KOMPOSISI DETAIL (per sajian):**\n`;
      const composition = metadata.detailedComposition;
      
      if (composition.perServing) {
        guidance += `• Kalori: ${composition.perServing.calories}\n`;
        guidance += `• Protein: ${composition.perServing.protein}\n`;
        guidance += `• Serat: ${composition.perServing.dietaryFiber}\n`;
        guidance += `• Karbohidrat: ${composition.perServing.carbohydrates}\n`;
        guidance += `• Lemak: ${composition.perServing.fat}\n\n`;
      }

      if (composition.activeCompounds) {
        guidance += `🌿 **SENYAWA AKTIF:**\n`;
        Object.entries(composition.activeCompounds).forEach(([compound, value]) => {
          guidance += `• ${compound}: ${value}\n`;
        });
        guidance += `\n`;
      }
    }

    // Personalized usage guidance
    if (metadata?.usageGuidance) {
      guidance += `📖 **CARA PAKAI YANG TEPAT:**\n`;
      
      // Find matching condition guidance
      const conditionGuidance = this.findMatchingConditionGuidance(
        metadata.usageGuidance.specificConditions,
        userConditions
      );

      if (conditionGuidance) {
        guidance += `🎯 **Untuk kondisi Anda:**\n`;
        guidance += `• Dosis: ${conditionGuidance.dosage}\n`;
        guidance += `• Waktu: ${conditionGuidance.timing}\n`;
        guidance += `• Cara: ${conditionGuidance.instructions}\n`;
        guidance += `• Target: ${conditionGuidance.expectedResults}\n`;
        guidance += `• Pantau: ${conditionGuidance.monitoring}\n`;
        if (conditionGuidance.notes) {
          guidance += `• Catatan: ${conditionGuidance.notes}\n`;
        }
        guidance += `\n`;
      }

      // Preparation guidance
      if (metadata.usageGuidance.preparation) {
        guidance += `🥤 **CARA PENYAJIAN:**\n`;
        const prep = metadata.usageGuidance.preparation;
        guidance += `• Air: ${prep.waterTemperature}\n`;
        guidance += `• Aduk: ${prep.mixingInstructions}\n`;
        if (prep.additionalTips) {
          guidance += `• Tips: ${prep.additionalTips}\n`;
        }
        guidance += `\n`;
      }
    }

    // Safety and considerations
    guidance += `⚠️ **PERTIMBANGAN KEAMANAN:**\n`;
    if (product.warnings && product.warnings.length > 0) {
      product.warnings.forEach((warning: string) => {
        guidance += `• ${warning}\n`;
      });
    }
    
    if (metadata?.usageGuidance?.dietaryConsiderations) {
      const dietary = metadata.usageGuidance.dietaryConsiderations;
      if (dietary.interactions) {
        guidance += `• Interaksi obat: ${dietary.interactions}\n`;
      }
      if (dietary.allergies) {
        guidance += `• Alergi: ${dietary.allergies}\n`;
      }
    }

    return guidance;
  }

  private buildDietProfileFromContext(
    context: ConversationContext,
    healthAssessment: HealthAssessment
  ): DietProfile {
    // Extract information from conversation messages
    const allText = context.messages
      .map(m => typeof m.content === 'string' ? m.content : '')
      .join(' ')
      .toLowerCase();

    // Extract diet goals from health assessment
    const dietGoals: DietGoal[] = this.extractDietGoals(healthAssessment, allText);

    // Infer activity level
    const activityLevel = this.inferActivityLevel(allText);

    // Extract basic demographics
    const age = this.extractAge(context);
    const weight = this.extractWeight(allText);
    const height = this.extractHeight(allText);

    return {
      userId: context.userId,
      age,
      weight,
      height,
      activityLevel,
      medicalConditions: healthAssessment.conditions,
      currentMedications: this.extractMedications(allText),
      allergies: this.extractAllergies(allText),
      dietaryRestrictions: this.extractDietaryRestrictions(allText),
      goals: dietGoals,
      preferences: {
        mealFrequency: this.inferMealFrequency(allText),
        snackPreference: allText.includes('cemilan') || allText.includes('snack'),
        cookingTime: this.inferCookingTime(allText),
        budgetLevel: this.inferBudgetRange(context)
      }
    };
  }

  private extractDietGoals(assessment: HealthAssessment, _text: string): DietGoal[] {
    const goals: DietGoal[] = [];
    
    // Map assessment goals to diet goals
    assessment.goals.forEach(goal => {
      if (goal.includes('turun berat') || goal.includes('diet') || goal.includes('langsing')) {
        goals.push({ type: 'weight_loss', priority: 'high' });
      } else if (goal.includes('diabetes') || goal.includes('gula darah')) {
        goals.push({ type: 'diabetes_control', priority: 'high' });
      } else if (goal.includes('kolesterol')) {
        goals.push({ type: 'cholesterol_management', priority: 'high' });
      } else if (goal.includes('maag') || goal.includes('gerd')) {
        goals.push({ type: 'gerd_relief', priority: 'high' });
      } else if (goal.includes('otot') || goal.includes('massa')) {
        goals.push({ type: 'muscle_building', priority: 'medium' });
      }
    });

    // Add general wellness if no specific goals
    if (goals.length === 0) {
      goals.push({ type: 'general_wellness', priority: 'medium' });
    }

    return goals;
  }

  private inferActivityLevel(text: string): DietProfile['activityLevel'] {
    if (text.includes('gym') || text.includes('olahraga rutin') || text.includes('aktif')) {
      return 'active';
    } else if (text.includes('jalan') || text.includes('yoga') || text.includes('ringan')) {
      return 'light';
    } else if (text.includes('sedentary') || text.includes('duduk terus') || text.includes('jarang gerak')) {
      return 'sedentary';
    }
    return 'moderate'; // Default
  }

  private extractWeight(text: string): number | undefined {
    const weightMatch = text.match(/(\d{1,3})\s*kg/) || text.match(/berat\s*(\d{1,3})/);
    if (!weightMatch || !weightMatch[1]) return undefined;
    return parseInt(weightMatch[1], 10);
  }

  private extractHeight(text: string): number | undefined {
    const heightMatch = text.match(/(\d{1,3})\s*cm/) || text.match(/tinggi\s*(\d{1,3})/);
    if (!heightMatch || !heightMatch[1]) return undefined;
    return parseInt(heightMatch[1], 10);
  }

  private extractMedications(text: string): string[] {
    const medications: string[] = [];
    
    if (text.includes('metformin')) medications.push('metformin');
    if (text.includes('insulin')) medications.push('insulin');
    if (text.includes('statin')) medications.push('statin');
    if (text.includes('aspirin')) medications.push('aspirin');
    if (text.includes('obat tekanan darah')) medications.push('antihypertensive');
    
    return medications;
  }

  private extractAllergies(text: string): string[] {
    const allergies: string[] = [];
    
    if (text.includes('alergi susu') || text.includes('lactose')) allergies.push('lactose');
    if (text.includes('alergi kacang')) allergies.push('nuts');
    if (text.includes('alergi gluten')) allergies.push('gluten');
    if (text.includes('alergi seafood')) allergies.push('seafood');
    
    return allergies;
  }

  private extractDietaryRestrictions(text: string): string[] {
    const restrictions: string[] = [];
    
    if (text.includes('vegetarian')) restrictions.push('vegetarian');
    if (text.includes('vegan')) restrictions.push('vegan');
    if (text.includes('halal')) restrictions.push('halal');
    if (text.includes('low carb')) restrictions.push('low_carb');
    
    return restrictions;
  }

  private inferMealFrequency(text: string): number {
    if (text.includes('5 kali') || text.includes('6 kali')) return 5;
    if (text.includes('4 kali')) return 4;
    if (text.includes('2 kali')) return 2;
    return 3; // Default 3 meals
  }

  private inferCookingTime(text: string): 'minimal' | 'moderate' | 'extensive' {
    if (text.includes('sibuk') || text.includes('praktis') || text.includes('cepat')) {
      return 'minimal';
    } else if (text.includes('masak') || text.includes('memasak')) {
      return 'extensive';
    }
    return 'moderate';
  }

  private findMatchingConditionGuidance(specificConditions: any, userConditions: string[]): any {
    if (!specificConditions) return null;

    const conditionMap: Record<string, string> = {
      'diabetes': 'diabetes',
      'gula darah tinggi': 'diabetes',
      'kolesterol tinggi': 'cholesterol',
      'GERD': 'gerd',
      'maag': 'gerd',
      'obesitas': 'weightLoss',
      'berat badan berlebih': 'weightLoss'
    };

    for (const condition of userConditions) {
      const guidanceKey = conditionMap[condition.toLowerCase()];
      if (guidanceKey && specificConditions[guidanceKey]) {
        return specificConditions[guidanceKey];
      }
    }

    return null;
  }

  private generateDietPlanGuidanceMessage(
    recommendations: PersonalizedRecommendation[],
    _overallStrategy: string
  ): string {
    let message = `🎯 **RENCANA DIET PERSONAL ANDA**\n\n`;
    
    if (recommendations.length > 0) {
      const primary = recommendations[0];
      if (!primary) return message + `💡 **Konsultasi lebih detail untuk rencana yang tepat.**`;
      
      message += `**PRODUK UTAMA: ${primary.product.name}**\n`;
      message += `📅 **Jadwal:** ${primary.personalizedDosage.frequency}\n`;
      message += `⏰ **Waktu:** ${primary.personalizedDosage.timing.join(', ')}\n`;
      message += `📝 **Cara:** ${primary.personalizedDosage.instructions}\n\n`;

      message += `🎯 **TARGET HASIL:**\n`;
      message += `• 1-2 minggu: ${primary.expectedResults.shortTerm}\n`;
      message += `• 4-8 minggu: ${primary.expectedResults.mediumTerm}\n`;
      message += `• 3+ bulan: ${primary.expectedResults.longTerm}\n\n`;

      message += `📊 **PANTAU:**\n`;
      primary.monitoringPlan.metrics.forEach(metric => {
        message += `• ${metric}\n`;
      });
      message += `\n`;

      message += `🥗 **DUKUNGAN DIET:**\n`;
      message += `**Perbanyak:** ${primary.dietarySupport.foodsToEmphasize.slice(0, 3).join(', ')}\n`;
      message += `**Batasi:** ${primary.dietarySupport.foodsToLimit.slice(0, 3).join(', ')}\n\n`;
    }

    message += `💡 **Mau konsultasi lebih detail tentang rencana diet ini?**`;
    
    return message;
  }
}