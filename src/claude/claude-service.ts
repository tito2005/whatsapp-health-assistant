import { config } from '@/config/environment';
import { log, logger } from '@/shared/logger';
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
  };
}

export enum ConversationState {
  GREETING = 'greeting',
  HEALTH_INQUIRY = 'health_inquiry',
  PRODUCT_RECOMMENDATION = 'product_recommendation',
  ORDER_COLLECTION = 'order_collection',
  ORDER_CONFIRMATION = 'order_confirmation',
  GENERAL_SUPPORT = 'general_support',
}

export class ClaudeService {
  private anthropic: Anthropic;
  private systemPrompt: string;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: config.claudeApiKey,
    });
    
    this.systemPrompt = this.loadSystemPrompt();
    log.startup('Claude service initialized');
  }

  private loadSystemPrompt(): string {
    // For now, hardcoded. Later can move to config file or database
    return `You are Maya, a warm and caring Indonesian health consultant working for ${config.businessName}, a premium health product store. You specialize in helping customers find the right health solutions based on their specific needs.

PERSONALITY & COMMUNICATION STYLE:
- Speak in warm, empathetic Indonesian
- Use caring greetings: "Halo Kak!", "Selamat datang!"
- Show genuine concern: "Saya paham kekhawatiran Anda..."
- Ask follow-up health questions
- Use encouraging language: "Senang sekali Anda peduli dengan kesehatan!"
- End conversations with care: "Jaga kesehatan ya, Kak!"
- Use emojis sparingly but warmly: 😊, ❤️, ✅

AVAILABLE PRODUCTS:
1. HOTTO PURTO - Jahe Merah Premium
   - Untuk: masuk angin, perut kembung, mual
   - Harga: Rp 75.000
   
2. HOTTO MAME PROTEIN
   - Untuk: gaya hidup aktif, kebutuhan protein
   - Harga: Rp 150.000
   
3. mGANIK METAFIBER
   - Untuk: diabetes, kontrol gula darah
   - Harga: Rp 250.000

4. mGANIK SUPERFOOD
   - Untuk: kesehatan pankreas, sensitivitas insulin
   - Harga: Rp 300.000

5. FLIMTY FIBER
   - Untuk: diet, detox pencernaan
   - Harga: Rp 200.000

CONVERSATION GUIDELINES:
- Always greet warmly when conversation starts
- Ask about specific health concerns before recommending
- Explain product benefits in context of their needs
- Be helpful but not pushy
- If asked about order, collect: Name, Address, Phone, Products
- Always confirm order details before finalizing

Remember: You are a health consultant first, salesperson second.`;
  }

  public async processMessage(
    message: string,
    context: ConversationContext
  ): Promise<{ response: string; newState: ConversationState }> {
    const startTime = Date.now();
    
    try {
      log.api.request('claude', 'POST', '/v1/messages');
      
      // Build conversation history
      const messages: MessageParam[] = [
        ...context.messages,
        { role: 'user', content: message }
      ];

      // Call Claude API
      const completion = await this.anthropic.messages.create({
        model: config.claudeModel,
        max_tokens: config.claudeMaxTokens,
        temperature: 0.7,
        system: this.systemPrompt,
        messages: messages,
      });

      const duration = Date.now() - startTime;
      log.api.response('claude', 200, duration);
      log.perf('claude-api-call', duration, { 
        inputTokens: completion.usage.input_tokens,
        outputTokens: completion.usage.output_tokens 
      });

      // Extract response text
      const responseText = completion.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      // Determine new conversation state based on response
      const newState = this.detectConversationState(message, responseText, context.state);

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
}