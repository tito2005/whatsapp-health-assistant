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
  private maxReconnectAttempts = 10;
  private messageHandler?: (message: any) => Promise<void>;
  private isInitializing = false;
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'qr_required' = 'disconnected';
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private qrTimeout: NodeJS.Timeout | null = null;
  private lastConnectionAttempt = 0;
  private minReconnectDelay = 5000; // 5 seconds
  private maxReconnectDelay = 300000; // 5 minutes

  constructor() {
    this.sessionPath = path.join(process.cwd(), 'session', config.whatsappSessionId);
  }

  public async initialize(): Promise<void> {
    if (this.isInitializing) {
      logger.warn('Initialization already in progress, skipping');
      return;
    }

    try {
      this.isInitializing = true;
      this.connectionState = 'connecting';
      this.lastConnectionAttempt = Date.now();
      
      logger.info('Initializing Baileys WhatsApp client', {
        attempt: this.reconnectAttempts + 1,
        maxAttempts: this.maxReconnectAttempts
      });

      // Clear existing timeouts
      this.clearTimeouts();

      // Ensure session directory exists
      await this.ensureSessionDirectory();

      // Load authentication state
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);

      // Create WhatsApp socket with improved configuration
      this.socket = makeWASocket({
        auth: state,
        logger: createBaileysLogger('error'),
        browser: ['Health Assistant', 'Desktop', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: false,
        printQRInTerminal: false,
        // Enhanced timeout configurations
        keepAliveIntervalMs: 30000,     // 30 seconds  
        connectTimeoutMs: 60000,        // 1 minute
        defaultQueryTimeoutMs: 60000,   // 1 minute
        qrTimeout: config.whatsappQrTimeout,
        // Reduce message sync load
        getMessage: async (_key) => {
          // Return undefined to avoid message sync issues
          return undefined;
        },
        // Improve connection stability
        shouldIgnoreJid: (jid: string) => {
          // Ignore broadcast and status updates
          return jid === 'status@broadcast' || jid.includes('broadcast');
        },
      });

      // Set up event handlers
      this.setupEventHandlers(saveCreds);

      // Set QR timeout
      this.setQRTimeout();

      logger.info('Baileys client initialized, waiting for connection');
    } catch (error) {
      this.connectionState = 'disconnected';
      logger.error('Failed to initialize Baileys client', { error });
      throw error;
    } finally {
      this.isInitializing = false;
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
    try {
      this.clearTimeouts();
      this.connectionState = 'disconnected';
      
      if (this.socket) {
        try {
          await this.socket.logout();
        } catch (error) {
          logger.warn('Error during socket logout', { error });
          // Continue with cleanup even if logout fails
        }
        
        this.socket = null;
      }
      
      this.isConnectedState = false;
      this.qrCodeString = null;
      this.reconnectAttempts = 0;
      this.isInitializing = false;
      
      logger.info('WhatsApp client disconnected successfully');
    } catch (error) {
      logger.error('Error during disconnect', { error });
      throw error;
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
    connectionState: this.connectionState,
    reconnectAttempts: this.reconnectAttempts
  });

  // Enhanced QR code handling
  if (qr) {
    await this.handleQRCode(qr);
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
      this.connectionState = 'connecting';
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
    this.connectionState = 'disconnected';
    this.clearTimeouts();

    const disconnectReason = (lastDisconnect?.error as Boom)?.output?.statusCode;
    const shouldReconnect = disconnectReason !== DisconnectReason.loggedOut;
    
    logger.info('Connection closed', {
      shouldReconnect,
      reconnectAttempts: this.reconnectAttempts,
      reason: lastDisconnect?.error?.message,
      disconnectReason,
      timeSinceLastAttempt: Date.now() - this.lastConnectionAttempt
    });

    // Handle specific disconnect reasons
    switch (disconnectReason) {
      case DisconnectReason.badSession:
        logger.warn('Bad session detected, clearing session data');
        await this.clearSession();
        break;
      case DisconnectReason.connectionClosed:
      case DisconnectReason.connectionLost:
      case DisconnectReason.timedOut:
        // These are recoverable, attempt reconnect
        break;
      case DisconnectReason.loggedOut:
        logger.info('Logged out, stopping reconnection attempts');
        this.reconnectAttempts = 0;
        return;
      default:
        logger.warn('Unknown disconnect reason', { disconnectReason });
    }

    if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      logger.error('Max reconnection attempts reached or logged out');
      this.reconnectAttempts = 0;
    }
  }

  private handleConnectionOpen(): void {
    this.isConnectedState = true;
    this.qrCodeString = null;
    this.reconnectAttempts = 0;
    this.connectionState = 'connected';
    this.clearTimeouts();
    
    logger.info('✅ WhatsApp connected successfully!', {
      sessionId: this.getSessionId(),
      connectedAt: new Date().toISOString()
    });
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ WHATSAPP CONNECTED SUCCESSFULLY!');
    console.log('🚀 Health Assistant is ready to receive messages');
    console.log('='.repeat(50) + '\n');
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
  public setMessageHandler(handler: (message: any) => Promise<void>): void {
    this.messageHandler = handler;
  }

  // Add this method to expose the socket (needed for typing indicator):
  public getSocket(): WASocket | null {
    return this.socket;
  }
  private async processMessage(message: WAMessage): Promise<void> {
    // This will be integrated with the WhatsApp service
    const messageText = message.message?.conversation || 
                      message.message?.extendedTextMessage?.text ||
                      'Non-text message';

    logger.info('Processing message', {
      from: message.key?.remoteJid,
      text: messageText.substring(0, 100), // Log first 100 chars
    });

    // Call the message handler if set
    if (this.messageHandler) {
      await this.messageHandler(message);
    }
  }

  // Helper methods for improved connection management
  private clearTimeouts(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.qrTimeout) {
      clearTimeout(this.qrTimeout);
      this.qrTimeout = null;
    }
  }

  private setQRTimeout(): void {
    this.qrTimeout = setTimeout(() => {
      if (this.connectionState === 'qr_required') {
        logger.warn('QR code expired, will retry connection');
        this.qrCodeString = null;
        this.connectionState = 'disconnected';
        this.scheduleReconnect();
      }
    }, config.whatsappQrTimeout);
  }

  private async handleQRCode(qr: string): Promise<void> {
    try {
      this.connectionState = 'qr_required';
      this.qrCodeString = await qrcode.toDataURL(qr);
      
      // Enhanced QR logging
      logger.info('🔗 QR code generated successfully');
      console.log('\n' + '='.repeat(50));
      console.log('📱 WHATSAPP QR CODE READY');
      console.log('🌐 Available at: http://localhost:' + config.port + '/api/whatsapp/qr');
      console.log('📲 Scan with your WhatsApp mobile app');
      console.log('⏰ QR expires in ' + (config.whatsappQrTimeout / 1000) + ' seconds');
      console.log('='.repeat(50) + '\n');
      
      // Reset QR timeout
      this.setQRTimeout();
      
    } catch (error) {
      logger.error('Failed to generate QR code', { error });
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    
    // Exponential backoff with jitter
    const baseDelay = Math.min(
      this.minReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    const jitter = Math.random() * 0.1 * baseDelay;
    const delay = baseDelay + jitter;
    
    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.initialize();
      } catch (error) {
        logger.error('Reconnection failed', { error, attempt: this.reconnectAttempts });
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          logger.error('All reconnection attempts exhausted');
          this.reconnectAttempts = 0;
        }
      }
    }, delay);
  }

  private async clearSession(): Promise<void> {
    try {
      // Remove session files to force re-authentication
      const sessionFiles = await fs.readdir(this.sessionPath).catch(() => []);
      for (const file of sessionFiles) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.sessionPath, file)).catch(() => {});
        }
      }
      logger.info('Session data cleared');
    } catch (error) {
      logger.error('Failed to clear session', { error });
    }
  }

  // Public methods for status monitoring
  public getConnectionState(): string {
    return this.connectionState;
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  public async getDetailedStatus(): Promise<object> {
    return {
      connected: this.isConnectedState,
      connectionState: this.connectionState,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      hasQR: !!this.qrCodeString,
      sessionId: this.getSessionId(),
      lastConnectionAttempt: this.lastConnectionAttempt,
      isInitializing: this.isInitializing
    };
  }
}