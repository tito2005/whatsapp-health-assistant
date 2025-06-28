import { ClaudeService, ConversationState } from '@/claude/claude-service';
import { ConversationManager } from '@/claude/conversation-manager';
import { config } from '@/config/environment';
import { productService } from '@/products/product-service';
import { log, logger } from '@/shared/logger';
import type { WhatsAppMessage } from '@/types/whatsapp';
import { BaileysClient } from './baileys-client';

export interface EnhancedConversationContext {
  userId: string;
  state: ConversationState;
  healthConcerns: string[];
  symptoms: string[];
  recommendedProducts: any[];
  customerData: {
    name?: string;
    address?: string;
    phone?: string;
    orderInProgress?: any;
  };
  lastActivity: Date;
  messageCount: number;
}

export class EnhancedWhatsAppService {
  private baileysClient: BaileysClient;
  private claudeService: ClaudeService;
  private conversationManager: ConversationManager;
  private processingMessages: Set<string> = new Set();
  private conversations: Map<string, EnhancedConversationContext> = new Map();

  constructor() {
    this.baileysClient = new BaileysClient();
    this.claudeService = new ClaudeService();
    this.conversationManager = new ConversationManager();
  }

  public async initialize(): Promise<void> {
    try {
      // Initialize all services
      await this.baileysClient.initialize();
      await this.conversationManager.initialize();
      
      // Set up periodic cleanup
      this.setupPeriodicCleanup();
      
      log.startup('Enhanced WhatsApp service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Enhanced WhatsApp service', error);
      throw error;
    }
  }

  public async processIncomingMessage(messageData: any): Promise<void> {
    try {
      // Extract message information
      const message: WhatsAppMessage = this.parseMessageData(messageData);
      
      // Skip if already processing this message
      if (this.processingMessages.has(message.id)) {
        logger.debug('Skipping duplicate message', { messageId: message.id });
        return;
      }
      
      this.processingMessages.add(message.id);
      
      log.whatsapp.message(message.from, message.id, message.type);

      // Skip messages from self
      if (message.isFromMe) {
        this.processingMessages.delete(message.id);
        return;
      }

      // Skip non-text messages for now
      if (message.type !== 'text' || !message.body) {
        await this.sendMessage(
          message.from,
          'Maaf, saat ini saya hanya bisa memproses pesan teks. Silakan kirim pesan teks untuk konsultasi kesehatan. 😊'
        );
        this.processingMessages.delete(message.id);
        return;
      }

      // Process with enhanced logic
      await this.processWithEnhancedLogic(message);
      
    } catch (error) {
      logger.error('Error processing incoming message', error);
      this.processingMessages.delete(messageData.key?.id || '');
      
      // Send error message to user
      try {
        const message: WhatsAppMessage = this.parseMessageData(messageData);
        await this.sendMessage(
          message.from,
          'Maaf, ada kendala saat memproses pesan Anda. Tim teknis kami sedang menangani masalah ini. Silakan coba lagi dalam beberapa menit. 🙏'
        );
      } catch (sendError) {
        logger.error('Failed to send error message to user', sendError);
      }
    }
  }

  private async processWithEnhancedLogic(message: WhatsAppMessage): Promise<void> {
    try {
      // Show typing indicator
      await this.sendTypingIndicator(message.from);
      
      // Get or create enhanced conversation context
      let conversation = this.conversations.get(message.from);
      if (!conversation) {
        conversation = this.createNewConversation(message.from);
        this.conversations.set(message.from, conversation);
      }

      // Update conversation context
      await this.updateConversationContext(conversation, message.body);

      // Analyze message for health concerns and product needs
      const healthConcerns = await this.extractHealthConcerns(message.body);
      const symptoms = await this.extractSymptoms(message.body);
      
      conversation.healthConcerns = [...new Set([...conversation.healthConcerns, ...healthConcerns])];
      conversation.symptoms = [...new Set([...conversation.symptoms, ...symptoms])];
      conversation.lastActivity = new Date();
      conversation.messageCount++;

      // Generate product recommendations if health concerns exist
      if ((conversation.healthConcerns.length > 0 || conversation.symptoms.length > 0) && 
          conversation.recommendedProducts.length === 0) {
        
        try {
          const recommendations = await productService.getProductRecommendations({
            symptoms: conversation.symptoms,
            conditions: conversation.healthConcerns,
            severity: this.assessSeverity(message.body),
            duration: this.assessDuration(message.body),
            goals: await this.extractHealthGoals(message.body)
          });

          conversation.recommendedProducts = recommendations.map(rec => ({
            ...rec.product,
            relevanceScore: rec.relevanceScore,
            recommendationReason: rec.reason
          }));

          logger.info('Generated product recommendations', {
            userId: message.from,
            healthConcerns: conversation.healthConcerns,
            recommendationCount: conversation.recommendedProducts.length
          });

        } catch (error) {
          logger.error('Failed to generate product recommendations', { 
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: message.from 
          });
          // Continue without recommendations
        }
      }

      // Get conversation context from Redis-based manager
      const redisConversation = await this.conversationManager.addMessage(
        message.from,
        'user',
        message.body
      );

      // Enhance the prompt with product information
      const enhancedPrompt = await this.buildEnhancedPrompt(conversation, message.body);

      // Process with Claude using enhanced context
      const { response, newState } = await this.claudeService.processMessage(
        enhancedPrompt,
        redisConversation
      );

      // Update conversation states
      await this.conversationManager.addMessage(message.from, 'assistant', response);
      await this.conversationManager.updateState(message.from, newState);
      conversation.state = newState;

      // Send response
      await this.sendMessage(message.from, response);

      // Send product recommendations if appropriate
      if (this.shouldSendProductRecommendations(conversation, newState)) {
        await this.sendProductRecommendations(message.from, conversation);
      }

      // Extract customer data for order processing
      this.extractCustomerData(conversation, message.body);

      logger.info('Enhanced message processed successfully', {
        from: message.from,
        state: newState,
        healthConcerns: conversation.healthConcerns.length,
        recommendedProducts: conversation.recommendedProducts.length,
        messageCount: conversation.messageCount
      });

    } catch (error) {
      logger.error('Error in enhanced processing', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        from: message.from 
      });
      
      // Fallback to basic service
      await this.fallbackToBasicService(message);
      
    } finally {
      this.processingMessages.delete(message.id);
    }
  }

  private async buildEnhancedPrompt(conversation: EnhancedConversationContext, userMessage: string): Promise<string> {
    let prompt = userMessage;

    // Add health context if available
    if (conversation.healthConcerns.length > 0 || conversation.symptoms.length > 0) {
      prompt += `\n\n[HEALTH CONTEXT: Customer has mentioned ${conversation.healthConcerns.join(', ')} and symptoms: ${conversation.symptoms.join(', ')}]`;
    }

    // Add product recommendations context
    if (conversation.recommendedProducts.length > 0) {
      const productInfo = conversation.recommendedProducts.slice(0, 3).map(product => 
        `- ${product.name}: Rp ${product.price.toLocaleString()} - ${product.recommendationReason}`
      ).join('\n');
      
      prompt += `\n\n[RECOMMENDED PRODUCTS:\n${productInfo}]`;
    }

    // Add conversation state context
    prompt += `\n\n[CONVERSATION STATE: ${conversation.state}, Message Count: ${conversation.messageCount}]`;

    return prompt;
  }

  private async extractHealthConcerns(message: string): Promise<string[]> {
    const concerns: string[] = [];
    const lowerMessage = message.toLowerCase();

    const healthPatterns = {
      'diabetes': ['diabetes', 'gula darah', 'kencing manis'],
      'hipertensi': ['darah tinggi', 'hipertensi', 'tekanan darah'],
      'kolesterol': ['kolesterol', 'lemak darah'],
      'maag': ['maag', 'lambung', 'perut perih', 'heartburn'],
      'asam lambung': ['asam lambung', 'gerd', 'refluks'],
      'obesitas': ['gemuk', 'kegemukan', 'berat badan berlebih'],
      'kelelahan': ['lelah', 'capek', 'lemas', 'tidak berenergi'],
      'pencernaan': ['susah bab', 'sembelit', 'diare', 'perut kembung'],
      'jantung': ['jantung', 'kardiovaskular', 'sesak napas'],
      'imunitas': ['imun lemah', 'sering sakit', 'daya tahan tubuh']
    };

    Object.entries(healthPatterns).forEach(([concern, patterns]) => {
      if (patterns.some(pattern => lowerMessage.includes(pattern))) {
        concerns.push(concern);
      }
    });

    return concerns;
  }

  private async extractSymptoms(message: string): Promise<string[]> {
    const symptoms: string[] = [];
    const lowerMessage = message.toLowerCase();

    const symptomPatterns = [
      'sakit kepala', 'pusing', 'mual', 'muntah', 'diare', 'sembelit',
      'kembung', 'sesak', 'batuk', 'demam', 'lelah', 'lemas', 'pegal',
      'nyeri', 'perih', 'panas dalam', 'sariawan'
    ];

    symptomPatterns.forEach(symptom => {
      if (lowerMessage.includes(symptom)) {
        symptoms.push(symptom);
      }
    });

    return symptoms;
  }

  private async extractHealthGoals(message: string): Promise<string[]> {
    const goals: string[] = [];
    const lowerMessage = message.toLowerCase();

    const goalPatterns = {
      'turun berat badan': ['turun berat badan', 'kurus', 'diet', 'langsing'],
      'sehat jantung': ['jantung sehat', 'kardiovaskular'],
      'kontrol gula darah': ['kontrol gula', 'diabetes', 'gula darah stabil'],
      'pencernaan sehat': ['pencernaan sehat', 'lambung sehat', 'bab lancar'],
      'imunitas kuat': ['imun kuat', 'daya tahan', 'tidak mudah sakit'],
      'energi lebih': ['energi', 'stamina', 'tidak lelah']
    };

    Object.entries(goalPatterns).forEach(([goal, patterns]) => {
      if (patterns.some(pattern => lowerMessage.includes(pattern))) {
        goals.push(goal);
      }
    });

    return goals;
  }

  private assessSeverity(message: string): 'mild' | 'moderate' | 'severe' {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('sangat') || lowerMessage.includes('parah') || 
        lowerMessage.includes('berat') || lowerMessage.includes('susah sekali')) {
      return 'severe';
    } else if (lowerMessage.includes('sedang') || lowerMessage.includes('cukup') ||
               lowerMessage.includes('lumayan')) {
      return 'moderate';
    }
    return 'mild';
  }

  private assessDuration(message: string): 'acute' | 'chronic' {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('lama') || lowerMessage.includes('bertahun') || 
        lowerMessage.includes('kronis') || lowerMessage.includes('sudah lama')) {
      return 'chronic';
    }
    return 'acute';
  }

  private shouldSendProductRecommendations(
    conversation: EnhancedConversationContext, 
    state: ConversationState
  ): boolean {
    return state === ConversationState.PRODUCT_RECOMMENDATION && 
           conversation.recommendedProducts.length > 0 &&
           conversation.messageCount >= 2; // Only after some conversation
  }

  private async sendProductRecommendations(
    userId: string, 
    conversation: EnhancedConversationContext
  ): Promise<void> {
    try {
      if (conversation.recommendedProducts.length === 0) return;

      const topProducts = conversation.recommendedProducts.slice(0, 3);
      
      let recommendationMessage = '🌿 *Rekomendasi Produk Kesehatan untuk Anda:*\n\n';
      
      topProducts.forEach((product, index) => {
        const bundleInfo = product.name === 'HOTTO PURTO OAT' 
          ? '\n💰 *Bundle 2 pouch: Rp 570.000* (hemat Rp 20.000!)' 
          : '';
          
        recommendationMessage += `*${index + 1}. ${product.name}*\n`;
        recommendationMessage += `💰 Harga: Rp ${product.price.toLocaleString()}${bundleInfo}\n`;
        recommendationMessage += `✨ ${product.recommendationReason}\n`;
        recommendationMessage += `📋 Dosis: ${product.dosage}\n\n`;
      });

      recommendationMessage += '💬 Mau tahu lebih detail tentang produk mana, Kak? Atau ada yang ingin langsung dipesan? 😊';

      await this.sendMessage(userId, recommendationMessage);

    } catch (error) {
      logger.error('Failed to send product recommendations', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId 
      });
    }
  }

  private extractCustomerData(conversation: EnhancedConversationContext, message: string): void {
    if (conversation.state === ConversationState.ORDER_COLLECTION) {
      // Extract name
      if (!conversation.customerData.name) {
        const namePatterns = /nama saya ([\w\s]+)|saya ([\w\s]+)|panggil saya ([\w\s]+)/i;
        const nameMatch = message.match(namePatterns);
        if (nameMatch) {
          const extractedName = nameMatch[1] || nameMatch[2] || nameMatch[3];
          if (extractedName) {
            conversation.customerData.name = extractedName.trim();
          }
        }
      }

      // Extract phone number
      if (!conversation.customerData.phone) {
        const phonePattern = /(\+62|62|0)[\d\s-]{9,15}/;
        const phoneMatch = message.match(phonePattern);
        if (phoneMatch) {
          conversation.customerData.phone = phoneMatch[0].replace(/\s/g, '');
        }
      }

      // Extract address
      if (!conversation.customerData.address && message.length > 20) {
        const addressKeywords = ['alamat', 'tinggal', 'rumah', 'jalan', 'gang', 'komplek'];
        if (addressKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
          conversation.customerData.address = message.trim();
        }
      }
    }
  }

  private async fallbackToBasicService(message: WhatsAppMessage): Promise<void> {
    try {
      logger.info('Falling back to basic service', { userId: message.from });
      
      // Get conversation from Redis
      const conversation = await this.conversationManager.addMessage(
        message.from,
        'user',
        message.body
      );

      // Process with basic Claude service
      const { response, newState } = await this.claudeService.processMessage(
        message.body,
        conversation
      );

      // Update conversation
      await this.conversationManager.addMessage(message.from, 'assistant', response);
      await this.conversationManager.updateState(message.from, newState);

      // Send response
      await this.sendMessage(message.from, response);

    } catch (fallbackError) {
      logger.error('Fallback service also failed', { 
        error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
        userId: message.from 
      });
      
      // Final fallback message
      await this.sendMessage(
        message.from,
        'Maaf Kak, saat ini sistem sedang mengalami gangguan. Tim teknis kami sedang memperbaiki. Silakan coba lagi dalam beberapa menit atau hubungi langsung ke ' + config.businessPhone + ' 🙏'
      );
    }
  }

  private createNewConversation(userId: string): EnhancedConversationContext {
    return {
      userId,
      state: ConversationState.GREETING,
      healthConcerns: [],
      symptoms: [],
      recommendedProducts: [],
      customerData: {},
      lastActivity: new Date(),
      messageCount: 0
    };
  }

  private async updateConversationContext(
    conversation: EnhancedConversationContext,
    message: string
  ): Promise<void> {
    const lowerMessage = message.toLowerCase();

    // Update state based on message content
    if (lowerMessage.includes('pesan') || lowerMessage.includes('beli') || lowerMessage.includes('order')) {
      conversation.state = ConversationState.ORDER_COLLECTION;
    } else if (conversation.healthConcerns.length > 0 && conversation.recommendedProducts.length > 0) {
      conversation.state = ConversationState.PRODUCT_RECOMMENDATION;
    } else if (conversation.healthConcerns.length > 0) {
      conversation.state = ConversationState.HEALTH_INQUIRY;
    }
  }

  private setupPeriodicCleanup(): void {
    // Clean up old conversations every hour
    setInterval(() => {
      this.cleanupOldConversations();
    }, 60 * 60 * 1000); // 1 hour
  }

  private cleanupOldConversations(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    let cleaned = 0;

    for (const [userId, conversation] of this.conversations.entries()) {
      if (conversation.lastActivity < cutoff) {
        this.conversations.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up old conversations', { 
        cleaned,
        remaining: this.conversations.size 
      });
    }
  }

  // Standard WhatsApp service methods
  private async sendTypingIndicator(to: string): Promise<void> {
    try {
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      await this.baileysClient.getSocket()?.presenceSubscribe(jid);
      await this.baileysClient.getSocket()?.sendPresenceUpdate('composing', jid);
      
      setTimeout(async () => {
        await this.baileysClient.getSocket()?.sendPresenceUpdate('paused', jid);
      }, 1000);
    } catch (error) {
      logger.debug('Error sending typing indicator', { error });
    }
  }

  public async sendMessage(to: string, message: string): Promise<void> {
    try {
      await this.baileysClient.sendMessage(to, message);
      logger.info('Message sent successfully', { to, messageLength: message.length });
    } catch (error) {
      logger.error('Failed to send message', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        to 
      });
      throw error;
    }
  }

  public async getConnectionStatus(): Promise<object> {
    const enhancedStatus = {
      connected: this.baileysClient.isConnected(),
      lastConnected: new Date().toISOString(),
      sessionId: this.baileysClient.getSessionId(),
      activeConversations: this.conversations.size,
      processingMessages: this.processingMessages.size,
      features: {
        healthAssessment: true,
        productRecommendations: true,
        enhancedConversationFlow: true
      }
    };

    return enhancedStatus;
  }

  public async getQRCode(): Promise<string | null> {
    return await this.baileysClient.getQRCode();
  }

  public async disconnect(): Promise<void> {
    // Clear conversations
    this.conversations.clear();
    this.processingMessages.clear();

    // Disconnect services
    await this.baileysClient.disconnect();
    await this.conversationManager.disconnect();
    
    logger.info('Enhanced WhatsApp service disconnected');
  }

  public getConversationSummary(userId: string): EnhancedConversationContext | null {
    return this.conversations.get(userId) || null;
  }

  public resetConversation(userId: string): void {
    this.conversations.delete(userId);
    logger.info('Conversation reset', { userId });
  }

  private parseMessageData(messageData: any): WhatsAppMessage {
    const from = messageData.key?.remoteJid || '';
    const cleanFrom = from.replace('@s.whatsapp.net', '').replace('@g.us', '');
    
    return {
      id: messageData.key?.id || '',
      from: cleanFrom,
      body: messageData.message?.conversation || 
            messageData.message?.extendedTextMessage?.text || '',
      timestamp: messageData.messageTimestamp || Date.now(),
      type: this.getSafeMessageType(this.detectMessageType(messageData.message)),
      isFromMe: messageData.key?.fromMe || false,
    };
  }

  private detectMessageType(message: any): string {
    if (message?.conversation) return 'text';
    if (message?.extendedTextMessage) return 'text';
    if (message?.imageMessage) return 'image';
    if (message?.videoMessage) return 'video';
    if (message?.audioMessage) return 'audio';
    if (message?.documentMessage) return 'document';
    return 'unknown';
  }

  private getSafeMessageType(type: string): 'text' | 'image' | 'video' | 'audio' | 'document' {
    const validTypes = ['text', 'image', 'video', 'audio', 'document'] as const;
    return validTypes.includes(type as any) ? (type as any) : 'text';
  }
}

export const enhancedWhatsAppService = new EnhancedWhatsAppService();