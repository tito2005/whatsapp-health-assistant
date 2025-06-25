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

// Health check endpoint
app.get('/health', async (_req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    services: {
      whatsapp: whatsappService ? await whatsappService.getConnectionStatus() : { connected: false },
    },
  };
  
  res.status(200).json(health);
});

// API routes
app.use('/api/whatsapp', whatsappRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

const initializeServices = async (): Promise<void> => {
  try {
    log.startup('Initializing services...');
    
    // Initialize WhatsApp service
    whatsappService = new WhatsAppService();
    await whatsappService.initialize();
    
    // Make service available globally for routes
    app.locals.whatsappService = whatsappService;
    
    // Set up message handler in Baileys client
    const baileysClient = (whatsappService as any).baileysClient;
    baileysClient.setMessageHandler(async (message: any) => {
      await whatsappService.processIncomingMessage(message);
    });
    
    log.startup('All services initialized successfully');
    
  } catch (error) {
    logger.error('Failed to initialize services', error);
    throw error;
  }
};

const startServer = async (): Promise<void> => {
  try {
    // Initialize all services
    await initializeServices();

    app.listen(config.port, () => {
      log.startup(`🚀 Server running on port ${config.port}`, {
        environment: config.nodeEnv,
        port: config.port,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  log.shutdown('SIGTERM received, shutting down gracefully');
  
  try {
    if (whatsappService) {
      await whatsappService.disconnect();
    }
  } catch (error) {
    logger.error('Error during shutdown', error);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  log.shutdown('SIGINT received, shutting down gracefully');
  
  try {
    if (whatsappService) {
      await whatsappService.disconnect();
    }
  } catch (error) {
    logger.error('Error during shutdown', error);
  }
  
  process.exit(0);
});

// Start the server
if (require.main === module) {
  void startServer();
}

export { app, whatsappService };
