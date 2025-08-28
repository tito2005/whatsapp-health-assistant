import { config } from '@/config/environment';
import fs from 'fs';
import path from 'path';
import pino from 'pino';

// Ensure logs directory exists
const logDir = path.resolve(config.logFilePath);
fs.mkdirSync(logDir, { recursive: true });

const createLogger = (): pino.Logger => {
  const streams: pino.StreamEntry[] = [];

  // Console output in development
  if (config.nodeEnv === 'development') {
    streams.push({
      level: config.logLevel as pino.Level,
      stream: pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          messageFormat: '{component} | {msg}',
        }
      })
    });
  }

  // File streams
  streams.push(
    {
      level: 'error',
      stream: pino.destination({
        dest: path.join(logDir, 'error.log'),
        sync: false,
      })
    },
    {
      level: config.logLevel as pino.Level,
      stream: pino.destination({
        dest: path.join(logDir, 'combined.log'),
        sync: false,
      })
    }
  );

  return pino({
    level: config.logLevel,
    base: {
      service: 'whatsapp-ai-assistant',
      env: config.nodeEnv,
      business: config.businessName,
      sector: config.businessSector
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
    },
  }, pino.multistream(streams));
};

export const logger = createLogger();

// Structured logging helpers
export const log = {
  startup: (message: string, meta?: any) => 
    logger.info({ component: 'system', phase: 'startup', ...meta }, message),
  
  shutdown: (message: string, meta?: any) => 
    logger.info({ component: 'system', phase: 'shutdown', ...meta }, message),
  
  whatsapp: {
    connected: (jid: string) => 
      logger.info({ component: 'whatsapp', event: 'connected', jid }, 'WhatsApp connected'),
    
    disconnected: (reason?: string) => 
      logger.warn({ component: 'whatsapp', event: 'disconnected', reason }, 'WhatsApp disconnected'),
    
    message: (from: string, messageId: string, type: string) =>
      logger.info({ 
        component: 'whatsapp', 
        event: 'message', 
        from, 
        messageId,
        type
      }, 'Message received'),
    
    qr: (attempt: number) =>
      logger.info({ component: 'whatsapp', event: 'qr', attempt }, 'QR code generated'),

    error: (error: any, context?: string) =>
      logger.error({ component: 'whatsapp', context, err: error }, 'WhatsApp error occurred'),
  },
  
  ai: {
    request: (userId: string, model: string, tokens?: number) =>
      logger.info({ 
        component: 'ai', 
        event: 'request', 
        userId,
        model,
        tokens
      }, 'AI request'),
    
    response: (userId: string, responseLength: number, tokensUsed?: number, duration?: number) =>
      logger.info({ 
        component: 'ai', 
        event: 'response', 
        userId,
        responseLength,
        tokensUsed,
        duration
      }, 'AI response'),
    
    error: (userId: string, error: any) =>
      logger.error({ 
        component: 'ai', 
        event: 'error', 
        userId,
        err: error 
      }, 'AI error'),
  }
};

export default logger;