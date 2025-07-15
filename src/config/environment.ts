import dotenv from 'dotenv';

dotenv.config();

interface Config {
  // Server
  nodeEnv: string;
  port: number;
  apiBaseUrl: string;

  // WhatsApp
  whatsappSessionId: string;
  whatsappQrTimeout: number;

  // Claude AI
  claudeApiKey: string;
  claudeModel: string;
  claudeMaxTokens: number;
  
  // Token Optimization
  enablePromptCaching: boolean;
  conversationCompressionLevel: number;
  orderCompressionLevel: number;
  tokenOptimizationMode: boolean;
  preserveCustomerDetails: boolean;

  // Redis
  redisHost: string;
  redisPort: number;
  redisPassword: string;
  redisDb: number;
  redisTtl: number;

  // Database
  databasePath: string;
  databaseBackupPath: string;

  // Logging
  logLevel: string;
  logFilePath: string;
  logMaxFiles: number;
  logMaxSize: string;

  // Security
  jwtSecret: string;
  encryptionKey: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;

  // Business
  adminGroupJid?: string;
  businessName: string;
  businessPhone: string;
  businessPhone2: string;
  businessAddress: string;
  adminEmail: string;
  adminEmailPassword: string;
}

const config: Config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',

  // WhatsApp
  whatsappSessionId: process.env.WHATSAPP_SESSION_ID || 'health_chatbot_session',
  whatsappQrTimeout: parseInt(process.env.WHATSAPP_QR_TIMEOUT || '60000', 10),

  // Claude AI
  claudeApiKey: process.env.CLAUDE_API_KEY || '',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-3-sonnet-20240229',
  claudeMaxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4000', 10),
  
  // Token Optimization
  enablePromptCaching: process.env.ENABLE_PROMPT_CACHING === 'true' || true, // Default enabled
  conversationCompressionLevel: parseInt(process.env.CONVERSATION_COMPRESSION_LEVEL || '4', 10),
  orderCompressionLevel: parseInt(process.env.ORDER_COMPRESSION_LEVEL || '8', 10), // More history during orders
  tokenOptimizationMode: process.env.TOKEN_OPTIMIZATION_MODE === 'true' || true, // Default enabled
  preserveCustomerDetails: process.env.PRESERVE_CUSTOMER_DETAILS !== 'false', // Default enabled

  // Redis
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  redisPassword: process.env.REDIS_PASSWORD || '',
  redisDb: parseInt(process.env.REDIS_DB || '0', 10),
  redisTtl: parseInt(process.env.REDIS_TTL || '86400', 10),

  // Database
  databasePath: process.env.DATABASE_PATH || './data/chatbot.db',
  databaseBackupPath: process.env.DATABASE_BACKUP_PATH || './data/backups/',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logFilePath: process.env.LOG_FILE_PATH || './logs/',
  logMaxFiles: parseInt(process.env.LOG_MAX_FILES || '5', 10),
  logMaxSize: process.env.LOG_MAX_SIZE || '10m',

  // Security
  jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret_change_this',
  encryptionKey: process.env.ENCRYPTION_KEY || 'default_encryption_key_change_this',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // Business
  adminGroupJid: process.env.ADMIN_GROUP_JID || '',
  businessName: process.env.BUSINESS_NAME || 'Arver ID',
  businessPhone: process.env.BUSINESS_PHONE || '+6289674476111',
  businessPhone2: process.env.BUSINESS_PHONE_2 || '+6281277721866',
  // Admin configuration
  adminEmail: process.env.ADMIN_EMAIL_USER || 'arverid@gmail.com',
  adminEmailPassword: process.env.ADMIN_EMAIL_PASS || '',
  businessAddress: process.env.BUSINESS_ADDRESS || 'Batam, Indonesia',
};

// Validation
const requiredEnvVars = ['CLAUDE_API_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Required environment variable ${envVar} is not set`);
  }
}

export { config };
