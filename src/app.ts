import { databaseManager } from '@/config/database';
import { config } from '@/config/environment';
import { errorHandler, notFoundHandler } from '@/shared/error-handler';
import { logger } from '@/shared/logger';
import { whatsappRoutes } from '@/whatsapp/routes';
import { WhatsAppService } from '@/whatsapp/whatsapp-service';
import { groqService } from '@/ai/groq-service';
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

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    let whatsappStatus: any = { connected: false, error: 'Service not initialized' };
    
    if (whatsappService) {
      try {
        whatsappStatus = await whatsappService.getConnectionStatus();
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

    // Test AI service
    let aiStatus: any;
    try {
      const aiConnected = await groqService.testConnection();
      aiStatus = {
        connected: aiConnected,
        service: 'groqcloud',
        model: config.groqModel
      };
    } catch (aiError) {
      aiStatus = {
        connected: false,
        error: aiError instanceof Error ? aiError.message : 'AI service error'
      };
    }

    const isWhatsAppHealthy = Boolean(whatsappStatus?.connected);
    const isDatabaseHealthy = Boolean(databaseStatus?.healthy);
    const isAIHealthy = Boolean(aiStatus?.connected);
    
    const overallStatus = isDatabaseHealthy && isAIHealthy ? 
      (isWhatsAppHealthy ? 'healthy' : 'partial') : 'degraded';

    const health = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      business: {
        name: config.businessName,
        sector: config.businessSector,
        aiRole: config.aiRole
      },
      services: {
        whatsapp: {
          connected: isWhatsAppHealthy,
          ...whatsappStatus
        },
        database: {
          healthy: isDatabaseHealthy,
          ...databaseStatus
        },
        ai: {
          healthy: isAIHealthy,
          ...aiStatus
        }
      },
      version: '2.0.0'
    };
    
    const statusCode = isDatabaseHealthy && isAIHealthy ? 200 : 503;
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
    logger.info('Initializing services...');
    
    // Initialize database first
    logger.info('🗄️  Initializing database...');
    await databaseManager.waitForInitialization();
    
    if (!databaseManager.isConnected()) {
      throw new Error('Database initialization failed');
    }
    logger.info('✅ Database initialized successfully');

    // Test AI service
    logger.info('🤖 Testing AI service...');
    const aiConnected = await groqService.testConnection();
    if (!aiConnected) {
      throw new Error('AI service connection failed');
    }
    logger.info('✅ AI service connected successfully');

    // Initialize WhatsApp service
    logger.info('📱 Initializing WhatsApp service...');
    try {
      whatsappService = new WhatsAppService();
      
      const initTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('WhatsApp initialization timeout')), 30000);
      });
      
      await Promise.race([
        whatsappService.initialize(),
        initTimeout
      ]);
      
      app.locals.whatsappService = whatsappService;
      logger.info('✅ WhatsApp service initialized successfully');
      
    } catch (whatsappError) {
      logger.warn('WhatsApp service initialization failed, continuing without WhatsApp', {
        error: whatsappError instanceof Error ? whatsappError.message : 'Unknown WhatsApp error'
      });
      whatsappService = null as any;
    }
    
    logger.info('🎉 Service initialization completed');
    
  } catch (error) {
    logger.error('Critical service initialization failed', error);
    throw error;
  }
};

const startServer = async (): Promise<void> => {
  try {
    await initializeServices();

    app.listen(config.port, () => {
      logger.info(`🚀 Multi-Sector AI Assistant running on port ${config.port}`, {
        environment: config.nodeEnv,
        port: config.port,
        businessName: config.businessName,
        businessSector: config.businessSector,
        aiService: 'groqcloud',
        whatsappEnabled: !!whatsappService
      });
      
      console.log('\n' + '='.repeat(60));
      console.log('🤖 MULTI-SECTOR AI ASSISTANT READY');
      console.log('='.repeat(60));
      console.log(`📊 Business: ${config.businessName}`);
      console.log(`🏢 Sector: ${config.businessSector}`);
      console.log(`🤖 AI Role: ${config.aiRole}`);
      console.log(`🌐 Server: http://localhost:${config.port}`);
      console.log(`📱 WhatsApp: ${whatsappService ? 'Ready' : 'Disabled'}`);
      console.log('='.repeat(60) + '\n');
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    
    if (error instanceof Error && error.message.includes('Database')) {
      logger.error('Database is required for operation, exiting...');
      process.exit(1);
    }
    
    logger.warn('Starting server with limited functionality...');
    
    app.listen(config.port, () => {
      logger.info(`⚠️  Server running with limited functionality on port ${config.port}`);
    });
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  try {
    if (whatsappService) {
      try {
        await whatsappService.disconnect();
      } catch (error) {
        logger.warn('Error closing WhatsApp service', error);
      }
    }

    if (databaseManager?.isConnected()) {
      try {
        await databaseManager.close();
      } catch (error) {
        logger.warn('Error closing database connection', error);
      }
    }

    logger.info('Graceful shutdown completed');
    process.exit(0);

  } catch (error) {
    logger.error('Error during graceful shutdown', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { 
    reason: reason instanceof Error ? reason.message : reason,
    promise: String(promise)
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});

if (require.main === module) {
  void startServer();
}

export { app, whatsappService };