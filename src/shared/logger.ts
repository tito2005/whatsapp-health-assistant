import { config } from '@/config/environment';
import fs from 'fs';
import path from 'path';
import pino from 'pino';

// Ensure logs directory exists
const logDir = path.resolve(config.logFilePath);
fs.mkdirSync(logDir, { recursive: true });

// Create logger based on environment
const createLogger = (): pino.Logger => {
  const streams: pino.StreamEntry[] = [];

  // Always log to console in development
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

  // File streams for both dev and production
  streams.push(
    {
      level: 'error',
      stream: pino.destination({
        dest: path.join(logDir, 'error.log'),
        sync: false, // Async for better performance
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
      service: 'whatsapp-health-chatbot',
      env: config.nodeEnv,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: (req) => ({
        method: req.method,
        url: req.url,
        path: req.path,
        parameters: req.parameters,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },
  }, pino.multistream(streams));
};

// Create the main logger instance
export const logger = createLogger();

// Baileys-compatible logger interface
interface BaileysLogger {
  level: string;
  info: (_message: string, ..._args: any[]) => void;
  error: (_message: string, ..._args: any[]) => void;
  warn: (_message: string, ..._args: any[]) => void;
  debug: (_message: string, ..._args: any[]) => void;
  trace: (_message: string, ..._args: any[]) => void;
  fatal: (_message: string, ..._args: any[]) => void;
  child: (_bindings: any) => BaileysLogger;
}

export const createBaileysLogger = (level: pino.Level = 'error'): BaileysLogger => {
  const baileysLogger = logger.child({ component: 'baileys' });
  
  // Messages to ignore from Baileys (too noisy)
  const ignorePatterns = [
    'recv msgtype',
    'sending ack',
    'recv ack',
    'handleReceipt',
    'proto message',
    'binMessage',
  ];

  // Error patterns to downgrade to warnings
  const downgradeErrors = [
    'PreKeyError',
    'failed to decrypt message',
    'message unavailable',
    'waiting for message',
  ];
  
  const shouldLog = (message: string, logLevel: string): boolean => {
    // Always log errors and warnings unless they're known noise
    if (logLevel === 'error' || logLevel === 'warn') {
      // Check if it's a known non-critical error
      if (downgradeErrors.some(pattern => message.includes(pattern))) {
        return false; // Skip these common errors
      }
      return true;
    }
    
    // Log important connection events
    if (message.includes('QR') || 
        message.includes('connection') || 
        message.includes('open') ||
        message.includes('close') ||
        message.includes('authenticated')) {
      return true;
    }
    
    // Skip noisy messages
    return !ignorePatterns.some(pattern => message.toLowerCase().includes(pattern.toLowerCase()));
  };

  const createLoggerInstance = (childLogger: pino.Logger): BaileysLogger => {
    return {
      level,
      info: (message: any, ...args: any[]) => {
        const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
        if (shouldLog(msgStr, 'info')) {
          childLogger.info({ baileys: args }, msgStr);
        }
      },
      error: (message: any, ...args: any[]) => {
        const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
        
        // Downgrade known non-critical errors to debug
        if (msgStr.includes('PreKeyError') || msgStr.includes('failed to decrypt')) {
          childLogger.debug({ baileys: args }, `[Known Issue] ${msgStr}`);
          return;
        }
        
        childLogger.error({ baileys: args, stack: new Error().stack }, msgStr);
      },
      warn: (message: any, ...args: any[]) => {
        const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
        if (shouldLog(msgStr, 'warn')) {
          childLogger.warn({ baileys: args }, msgStr);
        }
      },
      debug: (message: any, ...args: any[]) => {
        const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
        if (shouldLog(msgStr, 'debug')) {
          childLogger.debug({ baileys: args }, msgStr);
        }
      },
      trace: (message: any, ...args: any[]) => {
        // Trace is too verbose, only in development
        if (config.nodeEnv === 'development') {
          const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
          childLogger.trace({ baileys: args }, msgStr);
        }
      },
      fatal: (message: any, ...args: any[]) => {
        const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
        childLogger.fatal({ baileys: args }, msgStr);
      },
      child: (bindings: any) => createLoggerInstance(childLogger.child(bindings)),
    };
  };

  return createLoggerInstance(baileysLogger);
};

// Structured logging helpers - keep it simple but useful
export const log = {
  // System lifecycle
  startup: (message: string, meta?: any) => 
    logger.info({ component: 'system', phase: 'startup', ...meta }, message),
  
  shutdown: (message: string, meta?: any) => 
    logger.info({ component: 'system', phase: 'shutdown', ...meta }, message),
  
  // WhatsApp events
  whatsapp: {
    connected: (jid: string) => 
      logger.info({ component: 'whatsapp', event: 'connected', jid }, 'WhatsApp connected'),
    
    disconnected: (reason?: string) => 
      logger.warn({ component: 'whatsapp', event: 'disconnected', reason }, 'WhatsApp disconnected'),
    
    message: (from: string, messageId: string, type: string) =>
      logger.info({ component: 'whatsapp', event: 'message', from, messageId, type }, 'Message received'),
    
    qr: (attempt: number) =>
      logger.info({ component: 'whatsapp', event: 'qr', attempt }, 'QR code generated'),
  },
  
  // API calls
  api: {
    request: (service: string, method: string, endpoint: string) =>
      logger.info({ component: 'api', service, method, endpoint }, 'API request'),
    
    response: (service: string, status: number, duration: number) =>
      logger.info({ component: 'api', service, status, duration }, 'API response'),
    
    error: (service: string, error: any) =>
      logger.error({ component: 'api', service, err: error }, 'API error'),
  },
  
  // Business events
  order: {
    created: (orderId: string, customerId: string, total: number) =>
      logger.info({ component: 'order', event: 'created', orderId, customerId, total }, 'Order created'),
    
    error: (orderId: string, error: any) =>
      logger.error({ component: 'order', event: 'error', orderId, err: error }, 'Order error'),
  },
  
  // Performance metrics
  perf: (operation: string, duration: number, meta?: any) => {
    const level = duration > 3000 ? 'warn' : 'info';
    logger[level]({ component: 'performance', operation, duration, ...meta }, 
      `Operation completed in ${duration}ms`);
  },
  
  // Generic error logging with context
  error: (message: string, error: any, context?: any) =>
    logger.error({ err: error, context }, message),
};

// Graceful shutdown with log flushing
export const setupGracefulShutdown = (): void => {
  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
  
  signals.forEach(signal => {
    process.once(signal, async () => {
      log.shutdown(`Received ${signal}, shutting down gracefully`);
      
      // Give logs time to flush
      await new Promise(resolve => setTimeout(resolve, 100));
      
      process.exit(0);
    });
  });
};

// Initialize graceful shutdown
setupGracefulShutdown();

// Export for backward compatibility
export default logger;