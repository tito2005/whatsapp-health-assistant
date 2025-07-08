import { logger } from '@/shared/logger';
import { config } from '@/config/environment';
import { MessageParam } from '@anthropic-ai/sdk/resources';
import { ConversationContext } from './claude-service';

export interface ConversationSummary {
  keyPoints: string[];
  healthConcerns: string[];
  mentionedProducts: string[];
  orderStatus?: string;
  customerDetails?: {
    name?: string;
    phone?: string;
    address?: string;
    paymentMethod?: string;
    shippingOption?: string;
  };
  customerPreferences?: {
    budget?: string;
    communicationStyle?: string;
  };
  lastInteractionSummary: string;
}

export class ConversationSummarizer {
  private static instance: ConversationSummarizer;
  
  public static getInstance(): ConversationSummarizer {
    if (!ConversationSummarizer.instance) {
      ConversationSummarizer.instance = new ConversationSummarizer();
    }
    return ConversationSummarizer.instance;
  }

  /**
   * Compress conversation history intelligently with state awareness
   */
  public compressConversationHistory(
    messages: MessageParam[],
    context: ConversationContext,
    compressionLevel: number = 4
  ): MessageParam[] {
    // Check if we should preserve customer details and avoid compression
    if (config.preserveCustomerDetails && this.hasIncompleteCustomerInfo(context)) {
      logger.info('Skipping compression to preserve incomplete customer information', {
        userId: context.userId,
        currentOrder: !!context.metadata?.currentOrder
      });
      return messages; // Don't compress when customer info is incomplete
    }

    // Adjust compression based on conversation state - be less aggressive during orders
    const adjustedLevel = this.getStateAwareCompressionLevel(context, compressionLevel);
    const maxMessages = adjustedLevel * 2; // Each level allows 2 more message pairs
    
    if (messages.length <= maxMessages) {
      return messages;
    }

    logger.info('Compressing conversation history', {
      originalLength: messages.length,
      targetLength: maxMessages,
      compressionLevel
    });

    // Strategy: Keep priority messages and summarize the rest
    const priorityMessages = this.extractPriorityMessages(messages, context);
    const recentMessages = messages.slice(-maxMessages + priorityMessages.length);
    
    // Create summary of compressed messages
    const compressedMessages = messages.slice(0, -(maxMessages - priorityMessages.length));
    const summary = this.createConversationSummary(compressedMessages, context);
    
    const summaryMessage: MessageParam = {
      role: 'assistant',
      content: this.formatSummaryMessage(summary)
    };

    const finalMessages = [
      ...priorityMessages,
      summaryMessage,
      ...recentMessages
    ];

    logger.info('Conversation history compressed', {
      originalMessages: messages.length,
      finalMessages: finalMessages.length,
      tokenSavingEstimate: (messages.length - finalMessages.length) * 50 // Rough estimate
    });

    return finalMessages;
  }

  /**
   * Get compression level adjusted for conversation state
   */
  private getStateAwareCompressionLevel(context: ConversationContext, baseLevel: number): number {
    // Import ConversationState for type checking
    const { ConversationState } = require('./claude-service');
    
    // Use configuration-based order compression level
    if (context.state === ConversationState.ORDER_COLLECTION || 
        context.state === ConversationState.ORDER_CONFIRMATION) {
      return config.orderCompressionLevel; // Use configured order compression level
    }
    
    // If there's an active incomplete order, use order compression level
    if (context.metadata?.currentOrder && 
        (!context.metadata.currentOrder.customerName || 
         !context.metadata.currentOrder.address || 
         !context.metadata.currentOrder.whatsappNumber)) {
      return Math.max(config.orderCompressionLevel * 0.75, 6); // Slightly lower but still preserve more
    }
    
    return baseLevel;
  }

  /**
   * Extract high-priority messages that should be preserved
   */
  private extractPriorityMessages(
    messages: MessageParam[],
    _context: ConversationContext
  ): MessageParam[] {
    const priorityMessages: MessageParam[] = [];
    
    // Always keep the first greeting exchange if it exists
    if (messages.length >= 2) {
      const firstUser = messages[0];
      const firstAssistant = messages[1];
      
      if (firstUser?.role === 'user' && firstAssistant?.role === 'assistant') {
        priorityMessages.push(firstUser, firstAssistant);
      }
    }

    // Extract messages containing critical information
    for (let i = 2; i < messages.length - 6; i++) { // Don't process recent messages
      const message = messages[i];
      if (!message || typeof message.content !== 'string') continue;
      
      const content = message.content.toLowerCase();
      
      // Health condition mentions
      if (this.containsHealthInformation(content)) {
        priorityMessages.push(message);
        // Also include the assistant's response if available
        if (i + 1 < messages.length && messages[i + 1]?.role === 'assistant') {
          priorityMessages.push(messages[i + 1]!);
        }
      }
      
      // Order information - especially customer details
      if (this.containsOrderInformation(content) || this.containsCustomerDetails(content)) {
        priorityMessages.push(message);
        // Also include the assistant's response if available
        if (i + 1 < messages.length && messages[i + 1]?.role === 'assistant') {
          priorityMessages.push(messages[i + 1]!);
        }
      }
    }

    return priorityMessages.slice(0, 6); // Limit priority messages to avoid bloat
  }

  /**
   * Check if message contains health-related information
   */
  private containsHealthInformation(content: string): boolean {
    const healthKeywords = [
      'diabetes', 'kolesterol', 'darah tinggi', 'hipertensi', 'asam lambung',
      'maag', 'diet', 'berat badan', 'obesitas', 'jantung', 'stroke',
      'sakit', 'keluhan', 'gejala', 'penyakit', 'kondisi', 'riwayat'
    ];
    
    return healthKeywords.some(keyword => content.includes(keyword));
  }

  /**
   * Check if message contains order-related information
   */
  private containsOrderInformation(content: string): boolean {
    const orderKeywords = [
      'pesan', 'order', 'beli', 'alamat', 'transfer', 'cod', 'bayar',
      'pengiriman', 'ongkir', 'nama', 'nomor', 'whatsapp', 'hp'
    ];
    
    return orderKeywords.some(keyword => content.includes(keyword));
  }

  /**
   * Check if message contains customer details (name, address, phone)
   */
  private containsCustomerDetails(content: string): boolean {
    // Check for name patterns
    const namePatterns = [
      /nama\s*(?:saya)?\s*:?\s*([a-zA-Z\s]+)/i,
      /saya\s+([a-zA-Z\s]{3,})/i,
      /^([a-zA-Z\s]{3,})$/i
    ];
    
    // Check for address patterns
    const addressPatterns = [
      /alamat/i,
      /jl\.|jalan/i,
      /gang|gg\./i,
      /blok|rt|rw/i,
      /kecamatan|kelurahan/i
    ];
    
    // Check for phone patterns
    const phonePatterns = [
      /\b(?:\+62|62|0)[\d\s-]{9,15}\b/,
      /nomor\s*(?:hp|wa|whatsapp)/i,
      /telepon|telp/i
    ];
    
    return namePatterns.some(pattern => pattern.test(content)) ||
           addressPatterns.some(pattern => pattern.test(content)) ||
           phonePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Create a comprehensive summary of conversation history
   */
  private createConversationSummary(
    messages: MessageParam[],
    context: ConversationContext
  ): ConversationSummary {
    const summary: ConversationSummary = {
      keyPoints: [],
      healthConcerns: [],
      mentionedProducts: [],
      lastInteractionSummary: ''
    };

    // Extract information from messages
    const conversationText = messages
      .map(m => typeof m.content === 'string' ? m.content : '')
      .join(' ')
      .toLowerCase();

    // Extract health concerns
    summary.healthConcerns = this.extractHealthConcerns(conversationText);
    
    // Extract mentioned products
    summary.mentionedProducts = this.extractMentionedProducts(conversationText);
    
    // Extract key conversation points
    summary.keyPoints = this.extractKeyPoints(messages);
    
    // Extract customer details from conversation and current order
    summary.customerDetails = this.extractCustomerDetails(messages, context);
    
    // Order status
    if (context.metadata?.currentOrder) {
      summary.orderStatus = `Order in progress with ${context.metadata.currentOrder.items.length} items`;
    }
    
    // Customer preferences
    if (context.metadata?.userPreferences) {
      summary.customerPreferences = {};
      if (context.metadata.userPreferences.budget) {
        summary.customerPreferences.budget = context.metadata.userPreferences.budget;
      }
      if (context.metadata.userPreferences.communicationStyle) {
        summary.customerPreferences.communicationStyle = context.metadata.userPreferences.communicationStyle;
      }
    }
    
    // Last interaction summary
    if (messages.length >= 2) {
      const lastMessages = messages.slice(-2);
      summary.lastInteractionSummary = this.summarizeLastInteraction(lastMessages);
    }

    return summary;
  }

  /**
   * Extract health concerns from conversation text
   */
  private extractHealthConcerns(text: string): string[] {
    const concerns: Set<string> = new Set();
    
    const healthPatterns = {
      'diabetes': ['diabetes', 'diabates', 'gula darah', 'kencing manis'],
      'hipertensi': ['hipertensi', 'darah tinggi', 'tensi tinggi'],
      'kolesterol': ['kolesterol', 'kolestrol'],
      'asam lambung': ['asam lambung', 'maag', 'gerd', 'heartburn'],
      'obesitas': ['obesitas', 'kegemukan', 'berat badan berlebih', 'diet'],
      'pencernaan': ['sembelit', 'diare', 'pencernaan', 'perut', 'kembung']
    };

    for (const [concern, keywords] of Object.entries(healthPatterns)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        concerns.add(concern);
      }
    }

    return Array.from(concerns);
  }

  /**
   * Extract mentioned products from conversation
   */
  private extractMentionedProducts(text: string): string[] {
    const products: Set<string> = new Set();
    
    const productNames = [
      'hotto purto', 'hotto mame', 'mganik metafiber', 'mganik superfood',
      'mganik 3peptide', 'spencers mealblend', 'flimty fiber'
    ];

    for (const product of productNames) {
      if (text.includes(product.toLowerCase())) {
        products.add(product);
      }
    }

    return Array.from(products);
  }

  /**
   * Extract customer details from messages and context
   */
  private extractCustomerDetails(messages: MessageParam[], context: ConversationContext): {
    name?: string;
    phone?: string;
    address?: string;
    paymentMethod?: string;
    shippingOption?: string;
  } {
    const details: {
      name?: string;
      phone?: string;
      address?: string;
      paymentMethod?: string;
      shippingOption?: string;
    } = {};

    // First check current order metadata
    if (context.metadata?.currentOrder) {
      const order = context.metadata.currentOrder;
      if (order.customerName) details.name = order.customerName;
      if (order.whatsappNumber) details.phone = order.whatsappNumber;
      if (order.address) details.address = order.address;
      if (order.paymentMethod) details.paymentMethod = order.paymentMethod;
      if (order.shippingOption) details.shippingOption = order.shippingOption;
    }

    // Extract from conversation messages
    const conversationText = messages
      .filter(m => typeof m.content === 'string')
      .map(m => m.content as string)
      .join(' ');

    // Extract name if not already found
    if (!details.name) {
      const namePatterns = [
        /nama\s*(?:saya)?\s*:?\s*([a-zA-Z\s]+)/i,
        /saya\s+([a-zA-Z\s]{3,20})/i
      ];
      
      for (const pattern of namePatterns) {
        const match = conversationText.match(pattern);
        if (match && match[1] && match[1].trim().length > 2) {
          details.name = match[1].trim();
          break;
        }
      }
    }

    // Extract phone if not already found
    if (!details.phone) {
      const phonePattern = /(?:nomor|hp|wa|whatsapp)?\s*:?\s*((?:\+62|62|0)[\d\s-]{9,15})/i;
      const phoneMatch = conversationText.match(phonePattern);
      if (phoneMatch && phoneMatch[1]) {
        details.phone = phoneMatch[1].replace(/\s|-/g, '');
      }
    }

    // Extract address if not already found
    if (!details.address) {
      const addressPattern = /alamat\s*:?\s*([^.!?]*(?:jl|jalan|gang|gg|blok|rt|rw)[^.!?]*)/i;
      const addressMatch = conversationText.match(addressPattern);
      if (addressMatch && addressMatch[1] && addressMatch[1].trim().length > 10) {
        details.address = addressMatch[1].trim();
      }
    }

    // Extract payment method if not already found
    if (!details.paymentMethod) {
      if (conversationText.toLowerCase().includes('cod') || 
          conversationText.toLowerCase().includes('bayar di tempat')) {
        details.paymentMethod = 'cod';
      } else if (conversationText.toLowerCase().includes('transfer') || 
                 conversationText.toLowerCase().includes('tf')) {
        details.paymentMethod = 'transfer';
      }
    }

    // Extract shipping option if not already found
    if (!details.shippingOption) {
      if (conversationText.toLowerCase().includes('kurir') || 
          conversationText.toLowerCase().includes('gratis')) {
        details.shippingOption = 'batam_courier';
      } else if (conversationText.toLowerCase().includes('instant') || 
                 conversationText.toLowerCase().includes('cepat')) {
        details.shippingOption = 'instant';
      }
    }

    return details;
  }

  /**
   * Extract key conversation points
   */
  private extractKeyPoints(messages: MessageParam[]): string[] {
    const keyPoints: string[] = [];
    
    for (const message of messages) {
      if (typeof message.content !== 'string') continue;
      
      const content = message.content.toLowerCase();
      
      // Product recommendations
      if (message.role === 'assistant' && content.includes('rekomendasikan')) {
        const productMatch = content.match(/(\w+(?:\s+\w+)*)\s+(?:cocok|bagus|recommended)/i);
        if (productMatch) {
          keyPoints.push(`Recommended: ${productMatch[1]}`);
        }
      }
      
      // Health goals mentioned
      if (content.includes('tujuan') || content.includes('goal') || content.includes('target')) {
        keyPoints.push('Health goals discussed');
      }
      
      // Budget discussions
      if (content.includes('budget') || content.includes('harga') || content.includes('murah')) {
        keyPoints.push('Budget considerations mentioned');
      }
    }

    return keyPoints.slice(0, 5); // Limit to most important points
  }

  /**
   * Summarize the last interaction for context
   */
  private summarizeLastInteraction(messages: MessageParam[]): string {
    if (messages.length === 0) return '';
    
    const lastUserMessage = messages.find(m => m.role === 'user');
    
    if (!lastUserMessage || typeof lastUserMessage.content !== 'string') {
      return 'Recent interaction about health consultation';
    }
    
    const userContent = lastUserMessage.content.toLowerCase();
    
    // Categorize the interaction
    if (userContent.includes('harga') || userContent.includes('berapa')) {
      return 'Customer asked about pricing';
    } else if (userContent.includes('order') || userContent.includes('pesan')) {
      return 'Customer interested in ordering';
    } else if (userContent.includes('manfaat') || userContent.includes('fungsi')) {
      return 'Customer asked about product benefits';
    } else if (this.containsHealthInformation(userContent)) {
      return 'Customer discussed health concerns';
    } else {
      return 'General product inquiry';
    }
  }

  /**
   * Format summary into a concise message for conversation history
   */
  private formatSummaryMessage(summary: ConversationSummary): string {
    const parts: string[] = ['[Previous conversation summary]'];
    
    if (summary.healthConcerns.length > 0) {
      parts.push(`Health concerns: ${summary.healthConcerns.join(', ')}`);
    }
    
    if (summary.mentionedProducts.length > 0) {
      parts.push(`Products discussed: ${summary.mentionedProducts.join(', ')}`);
    }
    
    // Include customer details in summary - CRITICAL for order processing
    if (summary.customerDetails) {
      const customerInfo: string[] = [];
      if (summary.customerDetails.name) {
        customerInfo.push(`Name: ${summary.customerDetails.name}`);
      }
      if (summary.customerDetails.phone) {
        customerInfo.push(`Phone: ${summary.customerDetails.phone}`);
      }
      if (summary.customerDetails.address) {
        customerInfo.push(`Address: ${summary.customerDetails.address}`);
      }
      if (summary.customerDetails.paymentMethod) {
        customerInfo.push(`Payment: ${summary.customerDetails.paymentMethod}`);
      }
      if (summary.customerDetails.shippingOption) {
        customerInfo.push(`Shipping: ${summary.customerDetails.shippingOption}`);
      }
      
      if (customerInfo.length > 0) {
        parts.push(`Customer: ${customerInfo.join(', ')}`);
      }
    }
    
    if (summary.keyPoints.length > 0) {
      parts.push(`Key points: ${summary.keyPoints.join('; ')}`);
    }
    
    if (summary.orderStatus) {
      parts.push(summary.orderStatus);
    }
    
    if (summary.customerPreferences?.budget) {
      parts.push(`Budget preference: ${summary.customerPreferences.budget}`);
    }
    
    parts.push(`Last: ${summary.lastInteractionSummary}`);
    
    return parts.join(' | ');
  }

  /**
   * Check if current order has incomplete customer information
   * This prevents compression when critical customer details are missing
   */
  private hasIncompleteCustomerInfo(context: ConversationContext): boolean {
    // If no current order, customer info is not being collected
    if (!context.metadata?.currentOrder) {
      return false;
    }

    const order = context.metadata.currentOrder;
    
    // Check if we're in order collection phase and missing essential info
    const isOrderCollectionPhase = context.state === 'order_collection' || 
                                  context.state === 'order_confirmation' ||
                                  context.metadata?.orderStep === 'customer_info';

    if (!isOrderCollectionPhase) {
      return false;
    }

    // Check for missing essential customer details
    const missingName = !order.customerName || order.customerName.trim().length < 2;
    const missingPhone = !order.whatsappNumber || order.whatsappNumber.trim().length < 10;
    const missingAddress = !order.address || order.address.trim().length < 10;

    // If any essential info is missing during order collection, avoid compression
    const hasIncompleteInfo = missingName || missingPhone || missingAddress;

    if (hasIncompleteInfo) {
      logger.info('Customer information incomplete, preventing compression', {
        userId: context.userId,
        missingName,
        missingPhone,
        missingAddress,
        currentStep: context.metadata?.orderStep
      });
    }

    return hasIncompleteInfo;
  }

  /**
   * Get compression statistics
   */
  public getCompressionStats(
    originalLength: number,
    compressedLength: number
  ): {
    compressionRatio: number;
    tokensSaved: number;
    efficiencyGain: number;
  } {
    const compressionRatio = compressedLength / originalLength;
    const tokensSaved = (originalLength - compressedLength) * 50; // Estimate 50 tokens per message
    const efficiencyGain = 1 - compressionRatio;
    
    return {
      compressionRatio,
      tokensSaved,
      efficiencyGain
    };
  }
}