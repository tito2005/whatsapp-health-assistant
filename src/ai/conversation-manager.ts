import { config } from '@/config/environment';
import { logger } from '@/shared/logger';
import { AIMessage } from './groq-service';

export interface ConversationContext {
  userId: string;
  messages: AIMessage[];
  metadata: Record<string, any>;
  lastActivity: Date;
}

export class ConversationManager {
  private conversations: Map<string, ConversationContext> = new Map();
  private maxMessages = 20; // Keep last 20 messages per conversation

  public async getConversation(userId: string): Promise<ConversationContext> {
    let conversation = this.conversations.get(userId);
    
    if (!conversation) {
      conversation = this.createNewConversation(userId);
      this.conversations.set(userId, conversation);
    }

    // Update last activity
    conversation.lastActivity = new Date();
    
    return conversation;
  }

  public async addMessage(
    userId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<ConversationContext> {
    const conversation = await this.getConversation(userId);
    
    conversation.messages.push({
      role,
      content
    });

    // Limit conversation history
    if (conversation.messages.length > this.maxMessages) {
      conversation.messages = conversation.messages.slice(-this.maxMessages);
    }

    conversation.lastActivity = new Date();
    this.conversations.set(userId, conversation);
    
    return conversation;
  }

  public async updateMetadata(
    userId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    const conversation = await this.getConversation(userId);
    conversation.metadata = { ...conversation.metadata, ...metadata };
    this.conversations.set(userId, conversation);
  }

  public async clearConversation(userId: string): Promise<void> {
    this.conversations.delete(userId);
    logger.info('Conversation cleared', { userId });
  }

  public getActiveConversations(): number {
    return this.conversations.size;
  }

  public async cleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    let cleaned = 0;

    for (const [userId, conversation] of this.conversations.entries()) {
      if (conversation.lastActivity < cutoff) {
        this.conversations.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up old conversations', { 
        cleaned,
        remaining: this.conversations.size 
      });
    }
  }

  private createNewConversation(userId: string): ConversationContext {
    return {
      userId,
      messages: [],
      metadata: {},
      lastActivity: new Date()
    };
  }

  // Setup periodic cleanup
  public startCleanupSchedule(): void {
    setInterval(() => {
      void this.cleanup();
    }, 60 * 60 * 1000); // Every hour
  }
}

export const conversationManager = new ConversationManager();