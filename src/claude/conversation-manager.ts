import { config } from '@/config/environment';
import { log, logger } from '@/shared/logger';
import { MessageParam } from '@anthropic-ai/sdk/resources';
import { createClient, RedisClientType } from 'redis';
import { ConversationContext, ConversationState } from './claude-service';

export class ConversationManager {
  private redisClient: RedisClientType;
  private connected: boolean = false;

  constructor() {
    const redisOptions: any = {
      url: `redis://${config.redisHost}:${config.redisPort}`,
      database: config.redisDb,
    };
    if (config.redisPassword) {
      redisOptions.password = config.redisPassword;
    }
    this.redisClient = createClient(redisOptions);

    this.setupRedisHandlers();
  }

  private setupRedisHandlers(): void {
    this.redisClient.on('error', (err) => {
      // Don't log every reconnection attempt
      if (!this.connected && err.code === 'ECONNREFUSED') {
        logger.warn('Redis not available - using in-memory storage', { code: err.code });
      } else if (this.connected) {
        logger.error('Redis connection lost', err);
      }
      this.connected = false;
    });

    this.redisClient.on('connect', () => {
      log.startup('Redis connected for conversation management');
      this.connected = true;
    });

    this.redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });
  }

  public async initialize(): Promise<void> {
    try {
      await this.redisClient.connect();
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        logger.warn('Redis not running - conversations will use in-memory storage only');
        logger.info('To enable persistent conversations, start Redis: redis-server');
      } else {
        logger.error('Failed to connect to Redis', error);
      }
      // Continue without Redis - fallback to in-memory
      this.connected = false;
    }
  }

  public async getConversation(userId: string): Promise<ConversationContext> {
    const key = `conversation:${userId}`;
    
    try {
      if (!this.connected) {
        return this.createNewConversation(userId);
      }

      const data = await this.redisClient.get(key);
      
      if (!data) {
        return this.createNewConversation(userId);
      }

      const parsed = JSON.parse(data);
      
      // Ensure messages are properly typed
      parsed.messages = parsed.messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      }));

      return parsed as ConversationContext;
      
    } catch (error) {
      logger.error('Error getting conversation from Redis', error, { userId });
      return this.createNewConversation(userId);
    }
  }

  public async saveConversation(context: ConversationContext): Promise<void> {
    const key = `conversation:${context.userId}`;
    
    try {
      if (!this.connected) {
        logger.warn('Redis not connected, conversation not persisted');
        return;
      }

      // Limit conversation history to last 20 messages to avoid token limits
      const limitedContext = {
        ...context,
        messages: context.messages.slice(-20),
      };

      await this.redisClient.setEx(
        key,
        config.redisTtl, // 24 hours by default
        JSON.stringify(limitedContext)
      );
      
    } catch (error) {
      logger.error('Error saving conversation to Redis', error, { userId: context.userId });
    }
  }

  public async addMessage(
    userId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<ConversationContext> {
    const conversation = await this.getConversation(userId);
    
    conversation.messages.push({
      role,
      content,
    } as MessageParam);

    await this.saveConversation(conversation);
    
    return conversation;
  }

  public async updateState(
    userId: string,
    newState: ConversationState
  ): Promise<void> {
    const conversation = await this.getConversation(userId);
    conversation.state = newState;
    await this.saveConversation(conversation);
  }

  public async clearConversation(userId: string): Promise<void> {
    const key = `conversation:${userId}`;
    
    try {
      if (this.connected) {
        await this.redisClient.del(key);
      }
    } catch (error) {
      logger.error('Error clearing conversation', error, { userId });
    }
  }

  private createNewConversation(userId: string): ConversationContext {
    return {
      userId,
      messages: [],
      state: ConversationState.GREETING,
      metadata: {},
    };
  }

  public async disconnect(): Promise<void> {
    if (this.connected) {
      await this.redisClient.quit();
      this.connected = false;
      logger.info('Redis disconnected');
    }
  }

  // Utility method to get conversation summary
  public async getConversationSummary(userId: string): Promise<{
    messageCount: number;
    state: ConversationState;
    lastMessageTime?: Date;
  }> {
    const conversation = await this.getConversation(userId);
    
    return {
      messageCount: conversation.messages.length,
      state: conversation.state,
      lastMessageTime: conversation.messages.length > 0 ? new Date() : new Date(),
    };
  }
}