import { groqService } from '@/ai/groq-service';
import { conversationManager } from '@/ai/conversation-manager';
import { config } from '@/config/environment';
import { logger } from '@/shared/logger';
import type { WhatsAppMessage } from '@/types/whatsapp';
import { BaileysClient } from './baileys-client';

export class WhatsAppService {
  private baileysClient: BaileysClient;
  private processingMessages: Set<string> = new Set();
  private systemPrompt: string = '';

  constructor() {
    this.baileysClient = new BaileysClient();
    void this.initializeSystemPrompt();
  }

  private async initializeSystemPrompt(): Promise<void> {
    try {
      this.systemPrompt = await groqService.generateSystemPrompt(
        config.businessSector,
        config.aiRole,
        config.aiPersonality
      );
      logger.info('System prompt initialized for sector', { 
        sector: config.businessSector,
        role: config.aiRole 
      });
    } catch (error) {
      logger.error('Failed to initialize system prompt', { error });
      this.systemPrompt = `You are a helpful AI assistant for ${config.businessName}. Be professional and helpful.`;
    }
  }

  public async initialize(): Promise<void> {
    try {
      // Start conversation cleanup schedule
      conversationManager.startCleanupSchedule();
      
      // Set up message handler
      this.baileysClient.setMessageHandler(this.processIncomingMessage.bind(this));
      
      // Initialize Baileys client
      await this.baileysClient.initialize();
      
      logger.info('WhatsApp service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp service', { error });
      throw error;
    }
  }

  public async processIncomingMessage(messageData: any): Promise<void> {
    let messageId = '';
    try {
      // Validate message data
      if (!messageData || !messageData.key) {
        logger.warn('Invalid message data received');
        return;
      }

      // Extract message information
      const message: WhatsAppMessage = this.parseMessageData(messageData);
      messageId = message.id;
      
      // Skip if already processing this message
      if (this.processingMessages.has(message.id)) {
        logger.debug('Skipping duplicate message', { messageId: message.id });
        return;
      }
      
      this.processingMessages.add(message.id);

      // Skip messages from self
      if (message.isFromMe) {
        this.processingMessages.delete(message.id);
        return;
      }

      // Skip status broadcast messages
      if (message.from === 'status' || message.from.includes('broadcast')) {
        this.processingMessages.delete(message.id);
        return;
      }

      // Handle non-text messages
      if (message.type !== 'text' || !message.body.trim()) {
        await this.handleNonTextMessage(message);
        this.processingMessages.delete(message.id);
        return;
      }

      // Process with AI
      await this.processWithAI(message);
      
    } catch (error) {
      logger.error('Error processing incoming message', { 
        error: error instanceof Error ? error.message : error,
        messageId 
      });
      
      if (messageId) {
        this.processingMessages.delete(messageId);
      }
      
      // Send error response to user
      try {
        const message = this.parseMessageData(messageData);
        if (message.from && !message.isFromMe) {
          await this.sendErrorResponse(message.from);
        }
      } catch (parseError) {
        logger.error('Failed to send error response', { parseError });
      }
    }
  }

  private async processWithAI(message: WhatsAppMessage): Promise<void> {
    try {
      // Show typing indicator
      await this.sendTypingIndicator(message.from);
      
      // Get conversation context
      const conversation = await conversationManager.addMessage(
        message.from,
        'user',
        message.body
      );

      // Process with GroqCloud
      const response = await groqService.processMessage(
        conversation.messages,
        this.systemPrompt
      );

      // Add AI response to conversation
      await conversationManager.addMessage(
        message.from,
        'assistant',
        response.content
      );

      // Send response
      await this.sendMessage(message.from, response.content);

      logger.info('Message processed successfully', {
        from: message.from,
        messageLength: message.body.length,
        responseLength: response.content.length,
        tokensUsed: response.usage.total_tokens
      });

    } catch (error) {
      logger.error('Error processing with AI', { error, from: message.from });
      await this.sendErrorResponse(message.from);
    } finally {
      this.processingMessages.delete(message.id);
    }
  }

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
    if (!message || message.trim().length === 0) {
      logger.warn('Attempted to send empty message', { to });
      return;
    }

    if (!this.baileysClient.isConnected()) {
      throw new Error('WhatsApp client is not connected');
    }

    try {
      await this.baileysClient.sendMessage(to, message);
      logger.info('Message sent successfully', { 
        to, 
        messageLength: message.length
      });
    } catch (error) {
      logger.error('Failed to send message', { error, to });
      throw error;
    }
  }

  public async getConnectionStatus(): Promise<object> {
    try {
      const baileysStatus = await this.baileysClient.getDetailedStatus();
      
      return {
        connected: this.baileysClient.isConnected(),
        lastConnected: new Date().toISOString(),
        sessionId: this.baileysClient.getSessionId(),
        activeConversations: conversationManager.getActiveConversations(),
        processingMessages: this.processingMessages.size,
        baileys: baileysStatus,
        aiService: 'groqcloud',
        businessSector: config.businessSector
      };
    } catch (error) {
      logger.error('Error getting connection status', { error });
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  public async getQRCode(): Promise<string | null> {
    return await this.baileysClient.getQRCode();
  }

  public async disconnect(): Promise<void> {
    await this.baileysClient.disconnect();
    logger.info('WhatsApp service disconnected');
  }

  private parseMessageData(messageData: any): WhatsAppMessage {
    const from = messageData.key?.remoteJid || '';
    const cleanFrom = from.replace('@s.whatsapp.net', '').replace('@g.us', '');
    
    const messageContent = this.extractMessageContent(messageData.message);
    
    return {
      id: messageData.key?.id || '',
      from: cleanFrom,
      body: messageContent.text,
      timestamp: messageData.messageTimestamp || Date.now(),
      type: messageContent.type,
      isFromMe: messageData.key?.fromMe || false,
      messageInfo: {
        isGroup: from.includes('@g.us'),
        participant: messageData.key?.participant,
        pushName: messageData.pushName,
        quotedMessage: !!messageData.message?.extendedTextMessage?.contextInfo?.quotedMessage,
        hasMedia: messageContent.hasMedia,
        messageType: Object.keys(messageData.message || {})[0] || 'unknown'
      }
    };
  }

  private extractMessageContent(message: any): { text: string; type: 'text' | 'image' | 'audio' | 'video' | 'document'; hasMedia: boolean } {
    if (!message) {
      return { text: '', type: 'text', hasMedia: false };
    }

    if (message.conversation) {
      return { text: message.conversation, type: 'text', hasMedia: false };
    }
    
    if (message.extendedTextMessage) {
      return { text: message.extendedTextMessage.text || '', type: 'text', hasMedia: false };
    }

    if (message.imageMessage) {
      return { 
        text: message.imageMessage.caption || '[Image]', 
        type: 'image', 
        hasMedia: true 
      };
    }

    if (message.videoMessage) {
      return { 
        text: message.videoMessage.caption || '[Video]', 
        type: 'video', 
        hasMedia: true 
      };
    }

    if (message.audioMessage) {
      return { 
        text: '[Audio Message]', 
        type: 'audio', 
        hasMedia: true 
      };
    }

    if (message.documentMessage) {
      const filename = message.documentMessage.fileName || 'document';
      return { 
        text: `[Document: ${filename}]`, 
        type: 'document', 
        hasMedia: true 
      };
    }

    return { text: '[Unknown Message Type]', type: 'text', hasMedia: true };
  }

  private async handleNonTextMessage(message: WhatsAppMessage): Promise<void> {
    try {
      let responseMessage = '';
      
      switch (message.type) {
        case 'image':
          responseMessage = 'Thank you for the image! Currently I can only process text messages. Please describe your inquiry in text.';
          break;
        case 'audio':
          responseMessage = 'Thank you for the voice message! Currently I can only process text messages. Please type your message.';
          break;
        case 'video':
          responseMessage = 'Thank you for the video! For assistance, please send your inquiry as a text message.';
          break;
        case 'document':
          responseMessage = 'Thank you for the document! Please describe your inquiry in a text message.';
          break;
        default:
          responseMessage = 'I can only process text messages at the moment. Please send a text message for assistance.';
      }
      
      await this.sendMessage(message.from, responseMessage);
      
    } catch (error) {
      logger.error('Error handling non-text message', { error, message });
    }
  }

  private async sendErrorResponse(to: string): Promise<void> {
    try {
      const errorMessage = 'Sorry, there was a technical issue processing your message. Please try again or contact us directly.';
      await this.sendMessage(to, errorMessage);
    } catch (error) {
      logger.error('Failed to send error response', { error, to });
    }
  }
}