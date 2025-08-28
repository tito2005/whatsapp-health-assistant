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

  // GroqCloud AI
  groqApiKey: string;
  groqModel: string;
  groqMaxTokens: number;
  
  // Database
  databasePath: string;

  // Logging
  logLevel: string;
  logFilePath: string;

  // Security
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;

  // Business Configuration (Customizable)
  businessName: string;
  businessPhone: string;
  businessAddress: string;
  businessSector: string;
  aiPersonality: string;
  aiRole: string;
  customPrompt: string;
}

const config: Config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',

  // WhatsApp
  whatsappSessionId: process.env.WHATSAPP_SESSION_ID || 'ai_assistant_session',
  whatsappQrTimeout: parseInt(process.env.WHATSAPP_QR_TIMEOUT || '60000', 10),

  // GroqCloud AI
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
  groqMaxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '4000', 10),
  
  // Database
  databasePath: process.env.DATABASE_PATH || './data/assistant.db',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logFilePath: process.env.LOG_FILE_PATH || './logs/',

  // Security
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // Business Configuration (Customizable for any sector)
  businessName: process.env.BUSINESS_NAME || 'AI Assistant',
  businessPhone: process.env.BUSINESS_PHONE || '+1234567890',
  businessAddress: process.env.BUSINESS_ADDRESS || 'Your Business Address',
  businessSector: process.env.BUSINESS_SECTOR || 'general',
  aiPersonality: process.env.AI_PERSONALITY || 'helpful and professional',
  aiRole: process.env.AI_ROLE || 'customer service assistant',
  customPrompt: process.env.CUSTOM_PROMPT || '',
};

// Validation
const requiredEnvVars = ['GROQ_API_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Required environment variable ${envVar} is not set`);
  }
}

export { config };