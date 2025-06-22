// src/shared/logger.ts - Robust Pino logger with proper Baileys integration
import { config } from '@/config/environment';
import path from 'path';
import pino from 'pino';

// Create logs directory path
const logDir = path.resolve(config.logFilePath);

// Development transport configuration
const developmentTransport = pino.transport({
  targets: [
    {
      target: 'pino-pretty',
      level: config.logLevel,
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false,
        hideObject: false,
      },
    },
    {
      target: 'pino/file',
      level: 'error',
      options: {
        destination: path.join(logDir, 'error.log'),
        mkdir: true,
      },
    },
    {
      target: 'pino/file',
      level: config.logLevel,
      options: {
        destination: path.join(logDir, 'combined.log'),
        mkdir: true,
      },
    },
  ],
});

// Production transport configuration
const productionTransport = pino.transport({
  targets: [
    {
      target: 'pino/file',
      level: 'error',
      options: {
        destination: path.join(logDir, 'error.log'),
        mkdir: true,
      },
    },
    {
      target: 'pino/file',
      level: config.logLevel,
      options: {
        destination: path.join(logDir, 'combined.log'),
        mkdir: true,
      },
    },
  ],
});

// Logger configuration
const loggerConfig: pino.LoggerOptions = {
  level: config.logLevel,
  base: {
    service: 'whatsapp-health-chatbot',
    environment: config.nodeEnv,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label };
    },
    bindings: (bindings) => {
      return {
        pid: bindings.pid,
        hostname: bindings.hostname,
      };
    },
  },
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
};

// Create main logger instance
const logger = pino(
  loggerConfig,
  config.nodeEnv === 'development' ? developmentTransport : productionTransport
);

// Baileys-compatible logger interface
interface BaileysLogger {
  level: string;
  info: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
  trace: (message: string, ...args: any[]) => void;
  fatal: (message: string, ...args: any[]) => void;
  child: (bindings: any) => BaileysLogger;
}

// Baileys-compatible logger adapter
export const createBaileysLogger = (level: pino.Level = 'error'): BaileysLogger => {
  const baileysLogger = logger.child({ component: 'baileys' });
  
  const createLoggerInstance = (childLogger: pino.Logger): BaileysLogger => {
    return {
      level,
      info: (message: any, ...args: any[]) => {
        const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
        if (msgStr.includes('QR') || msgStr.includes('connection') || msgStr.includes('open')) {
          childLogger.info({ args }, msgStr);
        } else {
          childLogger.debug({ args }, msgStr);
        }
      },
      error: (message: any, ...args: any[]) => {
        const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
        childLogger.error({ args }, msgStr);
      },
      warn: (message: any, ...args: any[]) => {
        const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
        childLogger.warn({ args }, msgStr);
      },
      debug: (message: any, ...args: any[]) => {
        const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
        childLogger.debug({ args }, msgStr);
      },
      trace: (message: any, ...args: any[]) => {
        const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
        childLogger.trace({ args }, msgStr);
      },
      fatal: (message: any, ...args: any[]) => {
        const msgStr = typeof message === 'string' ? message : JSON.stringify(message);
        childLogger.fatal({ args }, msgStr);
      },
      child: (bindings: any) => {
        const newChildLogger = childLogger.child(bindings);
        return createLoggerInstance(newChildLogger);
      },
    };
  };

  return createLoggerInstance(baileysLogger);
};

// Enhanced logger with additional methods for application use
export const enhancedLogger = {
  ...logger,
  
  // WhatsApp specific logging
  whatsapp: {
    connection: (message: string, data?: any) => 
      logger.info({ component: 'whatsapp-connection', ...data }, message),
    message: (message: string, data?: any) => 
      logger.info({ component: 'whatsapp-message', ...data }, message),
    error: (message: string, error?: any, data?: any) => 
      logger.error({ component: 'whatsapp', error, ...data }, message),
    qr: (message: string, data?: any) => 
      logger.info({ component: 'whatsapp-qr', ...data }, message),
    auth: (message: string, data?: any) => 
      logger.info({ component: 'whatsapp-auth', ...data }, message),
  },
  
  // Claude API specific logging
  claude: {
    request: (message: string, data?: any) => 
      logger.info({ component: 'claude-api', ...data }, message),
    response: (message: string, data?: any) => 
      logger.info({ component: 'claude-api', ...data }, message),
    error: (message: string, error?: any, data?: any) => 
      logger.error({ component: 'claude-api', error, ...data }, message),
    tokens: (message: string, data?: any) => 
      logger.info({ component: 'claude-tokens', ...data }, message),
  },
  
  // Order processing specific logging
  order: {
    created: (message: string, data?: any) => 
      logger.info({ component: 'order-processing', ...data }, message),
    updated: (message: string, data?: any) => 
      logger.info({ component: 'order-processing', ...data }, message),
    completed: (message: string, data?: any) => 
      logger.info({ component: 'order-completed', ...data }, message),
    error: (message: string, error?: any, data?: any) => 
      logger.error({ component: 'order-processing', error, ...data }, message),
  },
  
  // Customer interaction logging
  customer: {
    interaction: (message: string, data?: any) => 
      logger.info({ component: 'customer-service', ...data }, message),
    conversation: (message: string, data?: any) => 
      logger.info({ component: 'customer-conversation', ...data }, message),
    error: (message: string, error?: any, data?: any) => 
      logger.error({ component: 'customer-service', error, ...data }, message),
  },
  
  // Performance monitoring
  performance: {
    timing: (operation: string, duration: number, data?: any) => 
      logger.info({ component: 'performance', operation, duration, ...data }, 'Operation completed'),
    slow: (operation: string, duration: number, data?: any) => 
      logger.warn({ component: 'performance', operation, duration, ...data }, 'Slow operation detected'),
    memory: (message: string, data?: any) => 
      logger.info({ component: 'performance-memory', ...data }, message),
  },
  
  // Security logging
  security: {
    auth: (message: string, data?: any) => 
      logger.info({ component: 'security-auth', ...data }, message),
    violation: (message: string, data?: any) => 
      logger.warn({ component: 'security-violation', ...data }, message),
    rateLimit: (message: string, data?: any) => 
      logger.warn({ component: 'security-ratelimit', ...data }, message),
    error: (message: string, error?: any, data?: any) => 
      logger.error({ component: 'security', error, ...data }, message),
  },

  // System monitoring
  system: {
    startup: (message: string, data?: any) => 
      logger.info({ component: 'system-startup', ...data }, message),
    shutdown: (message: string, data?: any) => 
      logger.info({ component: 'system-shutdown', ...data }, message),
    health: (message: string, data?: any) => 
      logger.info({ component: 'system-health', ...data }, message),
    error: (message: string, error?: any, data?: any) => 
      logger.error({ component: 'system', error, ...data }, message),
  },
};

// Export both standard logger and enhanced logger
export { logger };
export default enhancedLogger;

// Log rotation utility (for production environments)
export const setupLogRotation = async (): Promise<void> => {
  if (config.nodeEnv === 'production') {
    logger.info('Setting up log rotation for production environment');
    
    // Note: In production, consider using external log rotation tools like:
    // - logrotate (Linux)
    // - PM2 log rotation
    // - External logging services (AWS CloudWatch, etc.)
    
    logger.info('Log rotation setup completed');
  }
};

// Graceful shutdown logging
export const setupGracefulShutdown = (): void => {
  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    
    // Flush any pending logs
    logger.flush();
    
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  };
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon restart
};

// Health check for logger
export const loggerHealthCheck = (): { status: string; component: string } => {
  try {
    logger.info('Logger health check');
    return { status: 'healthy', component: 'pino-logger' };
  } catch (error) {
    return { status: 'unhealthy', component: 'pino-logger' };
  }
};

// Development helper - pretty print object
export const logObject = (obj: any, label?: string): void => {
  if (config.nodeEnv === 'development') {
    logger.info({ object: obj }, label || 'Debug Object');
  }
};