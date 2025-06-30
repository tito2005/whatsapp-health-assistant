import { config } from '@/config/environment';
import { maskForLogging } from '@/shared/encryption';
import fs from 'fs';
import path from 'path';
import pino from 'pino';

// Ensure logs directory exists
const logDir = path.resolve(config.logFilePath);
fs.mkdirSync(logDir, { recursive: true });

// Sensitive field patterns for data masking
const SENSITIVE_FIELDS = [
  'password', 'pwd', 'secret', 'token', 'key', 'api_key', 'apikey',
  'authorization', 'auth', 'credential', 'session', 'cookie',
  'phone', 'phoneNumber', 'whatsappNumber', 'mobile', 'email',
  'address', 'location', 'jid', 'customerId', 'orderId',
  'name', 'fullName', 'firstName', 'lastName', 'customerName'
];

const SENSITIVE_PATTERNS = [
  /\b\d{10,15}\b/g, // Phone numbers
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card-like numbers
  /\bORD-\d{8}-\d{6}-[A-Z0-9]{4}\b/g, // Order IDs
  /\bCUST-\d{8}-[A-Z0-9]{6}\b/g, // Customer IDs
  /\b62\d{9,12}\b/g, // Indonesian phone numbers
];

/**
 * Recursively mask sensitive data in objects
 */
function maskSensitiveData(obj: any, depth: number = 0): any {
  // Prevent infinite recursion
  if (depth > 10) return '[Max Depth Reached]';
  
  if (obj === null || obj === undefined) return obj;
  
  // Handle primitive types
  if (typeof obj === 'string') {
    return maskStringContent(obj);
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveData(item, depth + 1));
  }
  
  // Handle objects
  if (typeof obj === 'object') {
    const masked: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Check if this field should be masked
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
        if (typeof value === 'string') {
          masked[key] = maskForLogging(value);
        } else {
          masked[key] = '[MASKED]';
        }
      } else {
        masked[key] = maskSensitiveData(value, depth + 1);
      }
    }
    
    return masked;
  }
  
  return obj;
}

/**
 * Mask sensitive patterns in string content
 */
function maskStringContent(str: string): string {
  if (!str || typeof str !== 'string') return str;
  
  let maskedStr = str;
  
  // Apply pattern-based masking
  SENSITIVE_PATTERNS.forEach(pattern => {
    maskedStr = maskedStr.replace(pattern, (match) => {
      if (match.length <= 4) return '*'.repeat(4);
      return match.substring(0, 2) + '*'.repeat(Math.max(match.length - 4, 1)) + match.substring(match.length - 2);
    });
  });
  
  return maskedStr;
}

/**
 * Custom serializer for secure logging
 */
const secureSerializer = {
  ...pino.stdSerializers,
  err: (err: any) => {
    const serialized = pino.stdSerializers.err(err);
    return maskSensitiveData(serialized);
  },
  error: (err: any) => {
    const serialized = pino.stdSerializers.err(err);
    return maskSensitiveData(serialized);
  },
  req: (req: any) => {
    const serialized = pino.stdSerializers.req(req);
    return maskSensitiveData(serialized);
  },
  res: (res: any) => {
    const serialized = pino.stdSerializers.res(res);
    return maskSensitiveData(serialized);
  },
  // Custom serializers for common objects
  user: (user: any) => maskSensitiveData(user),
  customer: (customer: any) => maskSensitiveData(customer),
  order: (order: any) => maskSensitiveData(order),
  message: (message: any) => maskSensitiveData(message)
};

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
    serializers: secureSerializer,
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
  
  // WhatsApp events with secure logging
  whatsapp: {
    connected: (jid: string) => 
      logger.info({ component: 'whatsapp', event: 'connected', jid: maskForLogging(jid, 'general') }, 'WhatsApp connected'),
    
    disconnected: (reason?: string) => 
      logger.warn({ component: 'whatsapp', event: 'disconnected', reason }, 'WhatsApp disconnected'),
    
    message: (from: string, messageId: string, type: string, messageContent?: string) =>
      logger.info({ 
        component: 'whatsapp', 
        event: 'message', 
        from: maskForLogging(from, 'phone'), 
        messageId: maskForLogging(messageId, 'general'),
        type,
        contentLength: messageContent?.length || 0
      }, 'Message received'),
    
    qr: (attempt: number) =>
      logger.info({ component: 'whatsapp', event: 'qr', attempt }, 'QR code generated'),

    error: (error: any, context?: string) =>
      logger.error({ component: 'whatsapp', context, err: error }, 'WhatsApp error occurred'),
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
  
  // Business events with secure logging
  order: {
    created: (orderId: string, customerId: string, total: number, items?: any[]) =>
      logger.info({ 
        component: 'order', 
        event: 'created', 
        orderId: maskForLogging(orderId, 'general'), 
        customerId: maskForLogging(customerId, 'general'), 
        total,
        itemCount: items?.length || 0
      }, 'Order created'),
    
    updated: (orderId: string, status: string, updates?: any) =>
      logger.info({ 
        component: 'order', 
        event: 'updated', 
        orderId: maskForLogging(orderId, 'general'), 
        status,
        updateFields: updates ? Object.keys(updates) : []
      }, 'Order updated'),
    
    error: (orderId: string, error: any, context?: string) =>
      logger.error({ 
        component: 'order', 
        event: 'error', 
        orderId: maskForLogging(orderId, 'general'), 
        context,
        err: error 
      }, 'Order error'),
  },

  // Customer events with secure logging
  customer: {
    created: (customerId: string, phone: string) =>
      logger.info({ 
        component: 'customer', 
        event: 'created', 
        customerId: maskForLogging(customerId, 'general'),
        phone: maskForLogging(phone, 'phone')
      }, 'Customer created'),
    
    updated: (customerId: string, updates: any) =>
      logger.info({ 
        component: 'customer', 
        event: 'updated', 
        customerId: maskForLogging(customerId, 'general'),
        updateFields: Object.keys(updates)
      }, 'Customer updated'),
    
    interaction: (customerId: string, type: string, metadata?: any) =>
      logger.info({ 
        component: 'customer', 
        event: 'interaction', 
        customerId: maskForLogging(customerId, 'general'),
        interactionType: type,
        metadata: maskSensitiveData(metadata)
      }, 'Customer interaction'),
  },

  // Claude API events with secure logging
  claude: {
    request: (userId: string, promptLength: number, model: string) =>
      logger.info({ 
        component: 'claude', 
        event: 'request', 
        userId: maskForLogging(userId, 'general'),
        promptLength,
        model
      }, 'Claude API request'),
    
    response: (userId: string, responseLength: number, tokensUsed?: number, duration?: number) =>
      logger.info({ 
        component: 'claude', 
        event: 'response', 
        userId: maskForLogging(userId, 'general'),
        responseLength,
        tokensUsed,
        duration
      }, 'Claude API response'),
    
    error: (userId: string, error: any, retryAttempt?: number) =>
      logger.error({ 
        component: 'claude', 
        event: 'error', 
        userId: maskForLogging(userId, 'general'),
        retryAttempt,
        err: error 
      }, 'Claude API error'),
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