import { databaseManager } from '@/config/database';
import { config } from '@/config/environment';
import { errorHandler, notFoundHandler } from '@/shared/error-handler';
import { log, logger } from '@/shared/logger';
import { whatsappRoutes } from '@/whatsapp/routes';
import { WhatsAppService } from '@/whatsapp/whatsapp-service';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

const app = express();

// Global services
let whatsappService: WhatsAppService;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint with safe error handling
app.get('/health', async (_req, res) => {
  try {
    // Check WhatsApp service status safely
    let whatsappStatus: any = { connected: false, error: 'Service not initialized' };
    
    if (whatsappService) {
      try {
        whatsappStatus = await whatsappService.getConnectionStatus();
        
        // Ensure connected is a boolean
        if (typeof whatsappStatus.connected !== 'boolean') {
          whatsappStatus.connected = false;
        }
        
      } catch (whatsappError) {
        logger.warn('WhatsApp status check failed', whatsappError);
        whatsappStatus = { 
          connected: false, 
          error: whatsappError instanceof Error ? whatsappError.message : 'WhatsApp not ready' 
        };
      }
    }

    // Check database status safely
    let databaseStatus: any;
    try {
      databaseStatus = await databaseManager.healthCheck();
    } catch (dbError) {
      logger.error('Database health check failed', dbError);
      databaseStatus = {
        healthy: false,
        message: 'Database health check failed',
        details: { error: dbError instanceof Error ? dbError.message : 'Unknown error' }
      };
    }

    // Safely determine overall health status
    const isWhatsAppHealthy = Boolean(whatsappStatus?.connected);
    const isDatabaseHealthy = Boolean(databaseStatus?.healthy);
    const overallStatus = isDatabaseHealthy ? (isWhatsAppHealthy ? 'healthy' : 'partial') : 'degraded';

    const health = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      services: {
        whatsapp: {
          connected: isWhatsAppHealthy,
          ...whatsappStatus
        },
        database: {
          healthy: isDatabaseHealthy,
          ...databaseStatus
        }
      },
      version: '1.0.0'
    };
    
    // Return 200 if database is healthy (core functionality)
    const statusCode = isDatabaseHealthy ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error) {
    logger.error('Health check endpoint failed', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API routes
app.use('/api/whatsapp', whatsappRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

const initializeServices = async (): Promise<void> => {
  try {
    log.startup('Initializing services...');
    
    // STEP 1: Initialize database FIRST (critical for operations)
    log.startup('🗄️  Initializing database...');
    await databaseManager.waitForInitialization();
    
    if (!databaseManager.isConnected()) {
      throw new Error('Database initialization failed - cannot proceed');
    }
    log.startup('✅ Database initialized successfully');

    // STEP 2: Initialize WhatsApp service (non-blocking for database operations)
    log.startup('📱 Initializing WhatsApp service...');
    try {
      whatsappService = new WhatsAppService();
      
      // Initialize WhatsApp with timeout to prevent hanging
      const initTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('WhatsApp initialization timeout')), 30000);
      });
      
      await Promise.race([
        whatsappService.initialize(),
        initTimeout
      ]);
      
      // Make service available globally for routes
      app.locals.whatsappService = whatsappService;
      
      // Set up message handler safely
      try {
        const baileysClient = (whatsappService as any).baileysClient;
        if (baileysClient && typeof baileysClient.setMessageHandler === 'function') {
          baileysClient.setMessageHandler(async (message: any) => {
            try {
              await whatsappService.processIncomingMessage(message);
            } catch (error) {
              logger.error('Error processing message in handler', error);
            }
          });
        }
      } catch (handlerError) {
        logger.warn('Failed to set up message handler', handlerError);
      }
      
      log.startup('✅ WhatsApp service initialized successfully');
      
    } catch (whatsappError) {
      // WhatsApp initialization failed - continue with database-only mode
      logger.warn('WhatsApp service initialization failed, continuing in database-only mode', {
        error: whatsappError instanceof Error ? whatsappError.message : 'Unknown WhatsApp error'
      });
      
      // Create a dummy service for routes
      whatsappService = null as any;
    }
    
    log.startup('🎉 Service initialization completed');
    
  } catch (error) {
    logger.error('Critical service initialization failed', error);
    throw error;
  }
};

const startServer = async (): Promise<void> => {
  try {
    // Initialize services with proper error handling
    await initializeServices();

    app.listen(config.port, () => {
      log.startup(`🚀 Server running on port ${config.port}`, {
        environment: config.nodeEnv,
        port: config.port,
        databasePath: config.databasePath,
        businessName: config.businessName,
        whatsappEnabled: !!whatsappService
      });
      
      // Log service status
      logger.info('Service Status Summary', {
        database: databaseManager.isConnected(),
        whatsapp: !!whatsappService,
        port: config.port
      });
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    
    // If it's a database error, exit
    if (error instanceof Error && error.message.includes('Database')) {
      logger.error('Database is required for operation, exiting...');
      process.exit(1);
    }
    
    // For other errors, try to start with limited functionality
    logger.warn('Starting server with limited functionality...');
    
    app.listen(config.port, () => {
      log.startup(`⚠️  Server running with limited functionality on port ${config.port}`);
    });
  }
};

// Graceful shutdown with safe cleanup
const gracefulShutdown = async (signal: string): Promise<void> => {
  log.shutdown(`${signal} received, shutting down gracefully`);
  
  try {
    // Close WhatsApp service safely
    if (whatsappService) {
      try {
        log.shutdown('Closing WhatsApp service...');
        await whatsappService.disconnect();
      } catch (error) {
        logger.warn('Error closing WhatsApp service', error);
      }
    }

    // Close database connection safely
    if (databaseManager?.isConnected()) {
      try {
        log.shutdown('Closing database connection...');
        await databaseManager.close();
      } catch (error) {
        logger.warn('Error closing database connection', error);
      }
    }

    log.shutdown('Graceful shutdown completed');
    process.exit(0);

  } catch (error) {
    logger.error('Error during graceful shutdown', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions with better error info
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception - this should not happen in production', {
    error: error.message,
    stack: error.stack,
    name: error.name
  });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection - this should not happen in production', { 
    reason: reason instanceof Error ? reason.message : reason,
    promise: String(promise)
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
if (require.main === module) {
  void startServer();
}

export { app, whatsappService };
