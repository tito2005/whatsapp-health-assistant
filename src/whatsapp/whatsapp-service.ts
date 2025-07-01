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
      // Initialize conversation manager first
      await this.conversationManager.initialize();
      
      // Set up message handler before initializing Baileys
      this.baileysClient.setMessageHandler(this.processIncomingMessage.bind(this));
      
      // Initialize Baileys client
      await this.baileysClient.initialize();
      
      log.startup('WhatsApp service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp service', error);
      throw error;
    }
  }

  public async processIncomingMessage(messageData: any): Promise<void> {
    let messageId = '';
    try {
      // Validate message data
      if (!messageData || !messageData.key) {
        logger.warn('Invalid message data received', { messageData });
        return;
      }

      // Extract message information
      const message: WhatsAppMessage = this.parseMessageData(messageData);
      messageId = message.id;
      
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

      // Skip status broadcast messages
      if (message.from === 'status' || message.from.includes('broadcast')) {
        logger.debug('Skipping broadcast message');
        this.processingMessages.delete(message.id);
        return;
      }

      // Skip group messages for now (optional - can be configured)
      if (message.messageInfo?.isGroup) {
        logger.debug('Skipping group message', { from: message.from });
        this.processingMessages.delete(message.id);
        return;
      }

      // Handle non-text messages
      if (message.type !== 'text' || !message.body.trim()) {
        await this.handleNonTextMessage(message);
        this.processingMessages.delete(message.id);
        return;
      }

      // Process with Claude AI
      await this.processWithClaude(message);
      
    } catch (error) {
      logger.error('Error processing incoming message', { 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        messageId 
      });
      
      // Always clean up processing state
      if (messageId) {
        this.processingMessages.delete(messageId);
      }
      
      // Send error response to user if we have message info
      try {
        const message = this.parseMessageData(messageData);
        if (message.from && !message.isFromMe) {
          await this.sendErrorResponse(message.from, 'processing');
        }
      } catch (parseError) {
        logger.error('Failed to send error response', { parseError });
      }
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
    if (!message || message.trim().length === 0) {
      logger.warn('Attempted to send empty message', { to });
      return;
    }

    if (!this.baileysClient.isConnected()) {
      const error = new Error('WhatsApp client is not connected');
      logger.error('Cannot send message - client disconnected', { to, error });
      throw error;
    }

    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        await this.baileysClient.sendMessage(to, message);
        logger.info('Message sent successfully', { 
          to, 
          messageLength: message.length,
          retryCount 
        });
        return;
      } catch (error) {
        retryCount++;
        logger.warn(`Failed to send message (attempt ${retryCount}/${maxRetries})`, { 
          error: error instanceof Error ? error.message : error,
          to,
          retryCount
        });

        if (retryCount >= maxRetries) {
          logger.error('Failed to send message after all retries', { error, to });
          throw error;
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }

  public async getConnectionStatus(): Promise<object> {
    try {
      const baileysStatus = await this.baileysClient.getDetailedStatus();
      const conversationStatus = { status: 'operational' }; // TODO: Add getStatus method to ConversationManager
      
      return {
        connected: this.baileysClient.isConnected(),
        lastConnected: new Date().toISOString(),
        sessionId: this.baileysClient.getSessionId(),
        activeConversations: this.processingMessages.size,
        baileys: baileysStatus,
        conversations: conversationStatus,
        processingMessages: Array.from(this.processingMessages)
      };
    } catch (error) {
      logger.error('Error getting connection status', { error });
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastConnected: new Date().toISOString()
      };
    }
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
    
    // Enhanced message content extraction
    const messageContent = this.extractMessageContent(messageData.message);
    
    return {
      id: messageData.key?.id || '',
      from: cleanFrom,
      body: messageContent.text,
      timestamp: messageData.messageTimestamp || Date.now(),
      type: messageContent.type,
      isFromMe: messageData.key?.fromMe || false,
      // Additional metadata
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

    // Text messages
    if (message.conversation) {
      return { text: message.conversation, type: 'text', hasMedia: false };
    }
    
    if (message.extendedTextMessage) {
      return { text: message.extendedTextMessage.text || '', type: 'text', hasMedia: false };
    }

    // Media messages with captions
    if (message.imageMessage) {
      return { 
        text: message.imageMessage.caption || '[Gambar]', 
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
      const isVoiceNote = message.audioMessage.ptt;
      return { 
        text: isVoiceNote ? '[Voice Note]' : '[Audio]', 
        type: 'audio', 
        hasMedia: true 
      };
    }

    if (message.documentMessage) {
      const filename = message.documentMessage.fileName || 'document';
      return { 
        text: `[Dokumen: ${filename}]`, 
        type: 'document', 
        hasMedia: true 
      };
    }

    // Special message types
    if (message.contactMessage) {
      const contact = message.contactMessage.displayName || 'Contact';
      return { text: `[Kontak: ${contact}]`, type: 'text', hasMedia: false };
    }

    if (message.locationMessage) {
      return { text: '[Lokasi]', type: 'text', hasMedia: false };
    }

    if (message.liveLocationMessage) {
      return { text: '[Live Location]', type: 'text', hasMedia: false };
    }

    if (message.stickerMessage) {
      return { text: '[Stiker]', type: 'image', hasMedia: true };
    }

    // Fallback for unknown message types
    const messageType = Object.keys(message)[0] || 'unknown';
    return { text: `[${messageType}]`, type: 'text', hasMedia: true };
  }

  // Helper methods for error handling and non-text messages
  private async handleNonTextMessage(message: WhatsAppMessage): Promise<void> {
    try {
      let responseMessage = '';
      
      switch (message.type) {
        case 'image':
          responseMessage = 'Terima kasih telah mengirim gambar! Saat ini saya hanya bisa memproses pesan teks untuk konsultasi kesehatan. Silakan jelaskan keluhan Anda dengan kata-kata. 😊';
          break;
        case 'audio':
          responseMessage = 'Terima kasih telah mengirim pesan suara! Saat ini saya hanya bisa memproses pesan teks. Silakan ketik keluhan atau pertanyaan kesehatan Anda. 🎤';
          break;
        case 'video':
          responseMessage = 'Terima kasih telah mengirim video! Untuk konsultasi kesehatan, silakan jelaskan keluhan Anda dengan pesan teks. 🎥';
          break;
        case 'document':
          responseMessage = 'Terima kasih telah mengirim dokumen! Untuk konsultasi awal, silakan ceritakan keluhan Anda dengan pesan teks terlebih dahulu. 📄';
          break;
        default:
          responseMessage = 'Maaf, saat ini saya hanya bisa memproses pesan teks. Silakan kirim pesan teks untuk konsultasi kesehatan. 😊';
      }
      
      await this.sendMessage(message.from, responseMessage);
      
      logger.info('Handled non-text message', {
        from: message.from,
        type: message.type,
        hasMedia: message.messageInfo?.hasMedia
      });
    } catch (error) {
      logger.error('Error handling non-text message', { error, message });
    }
  }

  private async sendErrorResponse(to: string, errorType: 'processing' | 'claude' | 'connection'): Promise<void> {
    try {
      let errorMessage = '';
      
      switch (errorType) {
        case 'processing':
          errorMessage = 'Maaf, ada kendala saat memproses pesan Anda. Silakan coba lagi dalam beberapa saat. 🙏';
          break;
        case 'claude':
          errorMessage = 'Maaf, layanan konsultasi sedang mengalami gangguan. Silakan coba lagi atau hubungi kami langsung. 🙏';
          break;
        case 'connection':
          errorMessage = 'Maaf, koneksi sedang tidak stabil. Pesan Anda akan diproses segera setelah koneksi pulih. 🙏';
          break;
        default:
          errorMessage = 'Maaf, terjadi kesalahan teknis. Silakan coba lagi. 🙏';
      }
      
      await this.sendMessage(to, errorMessage);
    } catch (error) {
      logger.error('Failed to send error response', { error, to, errorType });
    }
  }

  // Enhanced admin notification with error handling
  public async notifyAdmin(message: string, priority: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
    if (!config.adminGroupJid) {
      logger.debug('Admin group JID not configured, skipping notification');
      return;
    }

    try {
      const emoji = priority === 'error' ? '⚠️' : priority === 'warning' ? '🔴' : 'ℹ️';
      const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      const adminMessage = `${emoji} [${priority.toUpperCase()}] ${timestamp}\n${message}`;
      
      if (config.adminGroupJid) {
        await this.sendMessage(config.adminGroupJid, adminMessage);
      }
      logger.info('Admin notification sent', { priority, messageLength: message.length });
    } catch (error) {
      logger.error('Failed to notify admin', { error, priority, message: message.substring(0, 100) });
    }
  }

  // Health check and recovery methods
  public async performHealthCheck(): Promise<boolean> {
    try {
      const isConnected = this.baileysClient.isConnected();
      
      if (!isConnected) {
        logger.warn('WhatsApp client not connected during health check');
        await this.notifyAdmin('WhatsApp connection lost, attempting recovery', 'warning');
        
        // Attempt automatic recovery
        try {
          await this.baileysClient.initialize();
          logger.info('WhatsApp connection recovered successfully');
          await this.notifyAdmin('WhatsApp connection recovered', 'info');
          return true;
        } catch (recoveryError) {
          logger.error('Failed to recover WhatsApp connection', { recoveryError });
          await this.notifyAdmin('WhatsApp connection recovery failed', 'error');
          return false;
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Health check failed', { error });
      return false;
    }
  }

  // Graceful cleanup
  public async cleanup(): Promise<void> {
    try {
      logger.info('Starting WhatsApp service cleanup');
      
      // Clear processing messages
      this.processingMessages.clear();
      
      // Disconnect services
      await Promise.allSettled([
        this.baileysClient.disconnect(),
        this.conversationManager.disconnect()
      ]);
      
      logger.info('WhatsApp service cleanup completed');
    } catch (error) {
      logger.error('Error during cleanup', { error });
      throw error;
    }
  }
}