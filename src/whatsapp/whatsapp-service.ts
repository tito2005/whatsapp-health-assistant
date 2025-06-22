import { logger } from '@/shared/logger';
import type { WhatsAppMessage } from '@/types/whatsapp';
import { BaileysClient } from './baileys-client';

export class WhatsAppService {
  private baileysClient: BaileysClient;

  constructor() {
    this.baileysClient = new BaileysClient();
  }

  public async initialize(): Promise<void> {
    try {
      await this.baileysClient.initialize();
      logger.info('WhatsApp service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp service', { error });
      throw error;
    }
  }

  public async processIncomingMessage(messageData: any): Promise<void> {
    try {
      // Extract message information
      const message: WhatsAppMessage = this.parseMessageData(messageData);
      
      logger.info('Processing incoming message', {
        from: message.from,
        type: message.type,
        messageId: message.id,
      });

      // Skip messages from self
      if (message.isFromMe) {
        logger.debug('Skipping message from self');
        return;
      }

      // Skip non-text messages for now
      if (message.type !== 'text') {
        logger.debug('Skipping non-text message', { type: message.type });
        await this.sendMessage(
          message.from,
          'Maaf, saat ini saya hanya bisa memproses pesan teks. Silakan kirim pesan teks untuk konsultasi kesehatan.'
        );
        return;
      }

      // TODO: Process with Claude AI
      // For now, send a simple response
      await this.sendSimpleResponse(message);

    } catch (error) {
      logger.error('Error processing incoming message', { error });
      throw error;
    }
  }

  public async sendMessage(to: string, message: string): Promise<void> {
    try {
      await this.baileysClient.sendMessage(to, message);
      logger.info('Message sent successfully', { to, messageLength: message.length });
    } catch (error) {
      logger.error('Failed to send message', { error, to });
      throw error;
    }
  }

  public async getConnectionStatus(): Promise<object> {
    return {
      connected: this.baileysClient.isConnected(),
      lastConnected: new Date().toISOString(),
      sessionId: this.baileysClient.getSessionId(),
    };
  }

  public async getQRCode(): Promise<string | null> {
    await this.initialize();
    
    return await this.baileysClient.getQRCode();
  }

  public async disconnect(): Promise<void> {
    await this.baileysClient.disconnect();
    logger.info('WhatsApp client disconnected');
  }

  private parseMessageData(messageData: any): WhatsAppMessage {
    // Parse Baileys message format
    return {
      id: messageData.key?.id || '',
      from: messageData.key?.remoteJid || '',
      body: messageData.message?.conversation || 
            messageData.message?.extendedTextMessage?.text || '',
      timestamp: messageData.messageTimestamp || Date.now(),
      type: 'text', // Simplified for now
      isFromMe: messageData.key?.fromMe || false,
    };
  }

  private async sendSimpleResponse(message: WhatsAppMessage): Promise<void> {
    // Simple response for testing
    const response = `Halo! Terima kasih sudah menghubungi toko kesehatan kami. 

Pesan Anda: "${message.body}"

Saya Maya, asisten kesehatan Anda. Saat ini sistem sedang dalam pengembangan, tapi saya akan segera siap membantu Anda dengan konsultasi kesehatan dan rekomendasi produk!

Silakan tunggu update selanjutnya. 😊`;

    await this.sendMessage(message.from, response);
  }
}