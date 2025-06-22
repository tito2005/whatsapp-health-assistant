import { config } from '@/config/environment';
import { createBaileysLogger, logger } from '@/shared/logger';
import type { WhatsAppClient } from '@/types/whatsapp';
import { Boom } from '@hapi/boom';
import {
  ConnectionState,
  DisconnectReason,
  default as makeWASocket,
  useMultiFileAuthState,
  WAMessage,
  WASocket
} from '@whiskeysockets/baileys';
import fs from 'fs/promises';
import path from 'path';
import qrcode from 'qrcode';

export class BaileysClient implements WhatsAppClient {
  private socket: WASocket | null = null;
  private qrCodeString: string | null = null;
  private isConnectedState = false;
  private sessionPath: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.sessionPath = path.join(process.cwd(), 'session', config.whatsappSessionId);
  }

  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing Baileys WhatsApp client');

      // Ensure session directory exists
      await this.ensureSessionDirectory();

      // Load authentication state
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);

      // Create WhatsApp socket
      this.socket = makeWASocket({
        auth: state,
        logger: createBaileysLogger('error'),
        browser: ['Health Chatbot', 'Desktop', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        // Add timeout configurations:
        keepAliveIntervalMs: 60000,    // 60 seconds (default 30)
        connectTimeoutMs: 120000,      // 2 minutes (default 60)
        defaultQueryTimeoutMs: 120000, // 2 minutes (default 60)
        // Reduce message sync load:
        getMessage: async (_key) => {
          // Return undefined to avoid message sync issues
          return undefined;
        },
      });

      // Set up event handlers
      this.setupEventHandlers(saveCreds);

      logger.info('Baileys client initialized, waiting for connection');
    } catch (error) {
      logger.error('Failed to initialize Baileys client', { error });
      throw error;
    }
  }

  public async sendMessage(to: string, message: string): Promise<void> {
    if (!this.socket || !this.isConnectedState) {
      throw new Error('WhatsApp client is not connected');
    }

    try {
      // Ensure the JID format is correct
      const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
      
      await this.socket.sendMessage(jid, { text: message });
      
      logger.info('Message sent successfully', {
        to: jid,
        messageLength: message.length,
      });
    } catch (error) {
      logger.error('Failed to send message', { error, to });
      throw error;
    }
  }

  public isConnected(): boolean {
    return this.isConnectedState && this.socket !== null;
  }

  public async getQRCode(): Promise<string | null> {
    return this.qrCodeString;
  }

  public getSessionId(): string {
    return config.whatsappSessionId;
  }

  public async disconnect(): Promise<void> {
    if (this.socket) {
      try {
        await this.socket.logout();
        this.socket = null;
        this.isConnectedState = false;
        this.qrCodeString = null;
        
        logger.info('WhatsApp client disconnected successfully');
      } catch (error) {
        logger.error('Error during disconnect', { error });
        throw error;
      }
    }
  }

  private async ensureSessionDirectory(): Promise<void> {
    try {
      await fs.access(this.sessionPath);
    } catch {
      await fs.mkdir(this.sessionPath, { recursive: true });
      logger.info('Created session directory', { path: this.sessionPath });
    }
  }

  private setupEventHandlers(saveCreds: () => Promise<void>): void {
    if (!this.socket) return;

    // Connection state updates
    this.socket.ev.on('connection.update', async (update) => {
      await this.handleConnectionUpdate(update);
    });

    // Authentication updates
    this.socket.ev.on('creds.update', saveCreds);

    // Incoming messages
    this.socket.ev.on('messages.upsert', async (messageUpdate) => {
      await this.handleIncomingMessages(messageUpdate);
    });

    // Message updates (read receipts, etc.)
    this.socket.ev.on('messages.update', (messageUpdates) => {
      this.handleMessageUpdates(messageUpdates);
    });

    // Presence updates
    this.socket.ev.on('presence.update', (presenceUpdate) => {
      logger.debug('Presence update', { presenceUpdate });
    });
}

private async handleConnectionUpdate(update: Partial<ConnectionState>): Promise<void> {
  const { connection, lastDisconnect, qr } = update;

  logger.info('Connection update', {
    connection,
    hasQR: !!qr,
    lastDisconnectReason: lastDisconnect?.error?.message,
  });

  // Enhanced QR code handling
  if (qr) {
    try {
      this.qrCodeString = await qrcode.toDataURL(qr);
      
      // Enhanced QR logging
      logger.info('🔗 QR code generated successfully');
      console.log('\n' + '='.repeat(50));
      console.log('📱 WHATSAPP QR CODE READY');
      console.log('🌐 Available at: http://localhost:3000/api/whatsapp/qr');
      console.log('📲 Scan with your WhatsApp mobile app');
      console.log('='.repeat(50) + '\n');
      
      // Optional: Display QR in terminal using qrcode-terminal
      // You can install: yarn add qrcode-terminal
      // const qrTerminal = require('qrcode-terminal');
      // qrTerminal.generate(qr, { small: true });
      
    } catch (error) {
      logger.error('Failed to generate QR code', { error });
    }
  }

  // Handle connection states
  switch (connection) {
    case 'close':
      await this.handleConnectionClose(lastDisconnect);
      break;
    
    case 'open':
      this.handleConnectionOpen();
      break;
    
    case 'connecting':
      logger.info('🔄 Connecting to WhatsApp...');
      console.log('🔄 Connecting to WhatsApp...');
      break;
    
    default:
      logger.debug('Unknown connection state', { connection });
  }
}
  private async handleConnectionClose(lastDisconnect: any): Promise<void> {
    this.isConnectedState = false;
    this.qrCodeString = null;

    const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
    
    logger.info('Connection closed', {
      shouldReconnect,
      reconnectAttempts: this.reconnectAttempts,
      reason: lastDisconnect?.error?.message,
    });

    if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        await this.initialize();
      } catch (error) {
        logger.error('Reconnection failed', { error });
      }
    } else {
      logger.error('Max reconnection attempts reached or logged out');
      this.reconnectAttempts = 0;
    }
  }

  private handleConnectionOpen(): void {
    this.isConnectedState = true;
    this.qrCodeString = null;
    this.reconnectAttempts = 0;
    
    logger.info('✅ WhatsApp connected successfully!');
  }

  private async handleIncomingMessages(messageUpdate: any): Promise<void> {
    const { messages, type } = messageUpdate;

    if (type !== 'notify') return;

    for (const message of messages) {
      try {
        // Skip messages from self or status updates
        if (message.key?.fromMe || message.key?.remoteJid === 'status@broadcast') {
          continue;
        }

        logger.info('Received message', {
          from: message.key?.remoteJid,
          messageId: message.key?.id,
          hasText: !!message.message?.conversation,
        });

        // Process message through the service layer
        await this.processMessage(message);
      } catch (error) {
        logger.error('Error processing incoming message', { error, message });
      }
    }
  }

  private handleMessageUpdates(messageUpdates: any[]): void {
    for (const update of messageUpdates) {
      logger.debug('Message update', { update });
      // Handle read receipts, delivery confirmations, etc.
    }
  }

  private async processMessage(message: WAMessage): Promise<void> {
    // This will be integrated with the WhatsApp service
    // For now, just log the message
    const messageText = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text ||
                       'Non-text message';

    logger.info('Processing message', {
      from: message.key?.remoteJid,
      text: messageText.substring(0, 100), // Log first 100 chars
    });

    // TODO: Integrate with WhatsAppService.processIncomingMessage()
    // This is where we'll call the service to handle the message
  }
}