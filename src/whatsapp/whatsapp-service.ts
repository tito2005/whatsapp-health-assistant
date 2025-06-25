import { ClaudeService } from '@/claude/claude-service';
import { ConversationManager } from '@/claude/conversation-manager';
import { config } from '@/config/environment';
import { log, logger } from '@/shared/logger';
import type { WhatsAppMessage } from '@/types/whatsapp';
import { BaileysClient } from './baileys-client';

export class WhatsAppService {
  private baileysClient: BaileysClient;
  private claudeService: ClaudeService;
  private conversationManager: ConversationManager;
  private processingMessages: Set<string> = new Set();

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
      
      log.startup('WhatsApp service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp service', error);
      throw error;
    }
  }

  public async processIncomingMessage(messageData: any): Promise<void> {
    try {
      // Extract message information
      const message: WhatsAppMessage = this.parseMessageData(messageData);
      
      // Skip if already processing this message (prevent duplicates)
      if (this.processingMessages.has(message.id)) {
        logger.debug('Skipping duplicate message', { messageId: message.id });
        return;
      }
      
      this.processingMessages.add(message.id);
      
      log.whatsapp.message(message.from, message.id, message.type);

      // Skip messages from self
      if (message.isFromMe) {
        logger.debug('Skipping message from self');
        this.processingMessages.delete(message.id);
        return;
      }

      // Skip non-text messages for now
      if (message.type !== 'text' || !message.body) {
        logger.debug('Skipping non-text message', { type: message.type });
        await this.sendMessage(
          message.from,
          'Maaf, saat ini saya hanya bisa memproses pesan teks. Silakan kirim pesan teks untuk konsultasi kesehatan. 😊'
        );
        this.processingMessages.delete(message.id);
        return;
      }

      // Process with Claude AI
      await this.processWithClaude(message);
      
    } catch (error) {
      logger.error('Error processing incoming message', error);
      this.processingMessages.delete(messageData.key?.id || '');
      throw error;
    }
  }

  private async processWithClaude(message: WhatsAppMessage): Promise<void> {
    try {
      // Show typing indicator
      await this.sendTypingIndicator(message.from);
      
      // Get or create conversation context
      const conversation = await this.conversationManager.addMessage(
        message.from,
        'user',
        message.body
      );

      // Process with Claude
      const { response, newState } = await this.claudeService.processMessage(
        message.body,
        conversation
      );

      // Update conversation with response
      await this.conversationManager.addMessage(message.from, 'assistant', response);
      await this.conversationManager.updateState(message.from, newState);

      // Send response
      await this.sendMessage(message.from, response);

      // Send quick replies if applicable
      const quickReplies = await this.claudeService.generateQuickReply(newState);
      if (quickReplies.length > 0) {
        // Note: Baileys doesn't support buttons in regular WhatsApp
        // We'll send them as a numbered list for now
        const quickReplyText = '\n\nPilihan cepat:\n' + 
          quickReplies.map((reply: string, index: number) => `${index + 1}. ${reply}`).join('\n');
        
        await this.sendMessage(message.from, quickReplyText);
      }

      // Log successful interaction
      logger.info('Message processed successfully', {
        from: message.from,
        messageLength: message.body.length,
        responseLength: response.length,
        state: newState,
      });

    } catch (error) {
      logger.error('Error processing with Claude', error, { from: message.from });
      
      // Send fallback message
      await this.sendMessage(
        message.from,
        'Maaf, ada kendala saat memproses pesan Anda. Silakan coba lagi atau hubungi kami langsung. 🙏'
      );
    } finally {
      this.processingMessages.delete(message.id);
    }
  }

  private async sendTypingIndicator(to: string): Promise<void> {
    try {
      // Baileys typing indicator
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      await this.baileysClient.getSocket()?.presenceSubscribe(jid);
      await this.baileysClient.getSocket()?.sendPresenceUpdate('composing', jid);
      
      // Clear typing after sending message
      setTimeout(async () => {
        await this.baileysClient.getSocket()?.sendPresenceUpdate('paused', jid);
      }, 1000);
    } catch (error) {
      logger.debug('Error sending typing indicator', { error });
      // Non-critical, continue
    }
  }

  public async sendMessage(to: string, message: string): Promise<void> {
    try {
      await this.baileysClient.sendMessage(to, message);
      logger.info('Message sent successfully', { to, messageLength: message.length });
    } catch (error) {
      logger.error('Failed to send message', error, { to });
      throw error;
    }
  }

  public async getConnectionStatus(): Promise<object> {
    return {
      connected: this.baileysClient.isConnected(),
      lastConnected: new Date().toISOString(),
      sessionId: this.baileysClient.getSessionId(),
      activeConversations: this.processingMessages.size,
    };
  }

  public async getQRCode(): Promise<string | null> {
    return await this.baileysClient.getQRCode();
  }

  public async disconnect(): Promise<void> {
    await this.baileysClient.disconnect();
    await this.conversationManager.disconnect();
    logger.info('WhatsApp service disconnected');
  }

  private parseMessageData(messageData: any): WhatsAppMessage {
    // Parse Baileys message format
    const from = messageData.key?.remoteJid || '';
    const cleanFrom = from.replace('@s.whatsapp.net', '').replace('@g.us', '');
    
    return {
      id: messageData.key?.id || '',
      from: cleanFrom,
      body: messageData.message?.conversation || 
            messageData.message?.extendedTextMessage?.text || '',
      timestamp: messageData.messageTimestamp || Date.now(),
      type: this.mapToValidMessageType(this.detectMessageType(messageData.message)),
      isFromMe: messageData.key?.fromMe || false,
    };
  }

  private detectMessageType(message: any): 'text' | 'image' | 'audio' | 'video' | 'document' | 'unknown' {
    if (message?.conversation || message?.extendedTextMessage) return 'text';
    if (message?.imageMessage) return 'image';
    if (message?.audioMessage) return 'audio';
    if (message?.videoMessage) return 'video';
    if (message?.documentMessage) return 'document';
    return 'unknown';
  }

  private mapToValidMessageType(type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'unknown'): 'text' | 'image' | 'audio' | 'video' | 'document' {
    // Fallback to 'text' if unknown, or handle as needed
    if (type === 'unknown') {
      return 'text';
    }
    return type;
  }

  // Admin notification helper
  public async notifyAdmin(message: string): Promise<void> {
    if (config.adminGroupJid) {
      try {
        await this.sendMessage(config.adminGroupJid, `[Admin Notification]\n${message}`);
      } catch (error) {
        logger.error('Failed to notify admin', error);
      }
    }
  }
}