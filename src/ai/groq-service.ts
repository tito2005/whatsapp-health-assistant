import { config } from '@/config/environment';
import { logger } from '@/shared/logger';
import Groq from 'groq-sdk';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class GroqService {
  private client: Groq;

  constructor() {
    this.client = new Groq({
      apiKey: config.groqApiKey,
    });
  }

  public async processMessage(
    messages: AIMessage[],
    systemPrompt?: string
  ): Promise<AIResponse> {
    try {
      const groqMessages: any[] = [];

      // Add system prompt if provided
      if (systemPrompt) {
        groqMessages.push({
          role: 'system',
          content: systemPrompt
        });
      }

      // Add conversation messages
      groqMessages.push(...messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })));

      const completion = await this.client.chat.completions.create({
        messages: groqMessages,
        model: config.groqModel,
        max_tokens: config.groqMaxTokens,
        temperature: 0.7,
        stream: false,
      });

      const response = completion.choices[0]?.message?.content || '';
      const usage = completion.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      };

      logger.info('GroqCloud API response received', {
        model: config.groqModel,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        responseLength: response.length
      });

      return {
        content: response,
        usage: {
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens
        }
      };

    } catch (error) {
      logger.error('GroqCloud API error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        model: config.groqModel
      });
      throw new Error(`AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async generateSystemPrompt(sector: string, role: string, personality: string): Promise<string> {
    const sectorPrompts = {
      health: `You are a knowledgeable health consultant who provides general wellness advice and product recommendations.`,
      ecommerce: `You are a helpful sales assistant who helps customers find products and complete purchases.`,
      education: `You are an educational assistant who helps students learn and provides study guidance.`,
      finance: `You are a financial advisor assistant who provides general financial guidance and service information.`,
      hospitality: `You are a hospitality assistant who helps with bookings, recommendations, and customer service.`,
      retail: `You are a retail assistant who helps customers find products and provides shopping assistance.`,
      general: `You are a versatile AI assistant who helps with various customer inquiries and requests.`
    };

    const basePrompt = sectorPrompts[sector as keyof typeof sectorPrompts] || sectorPrompts.general;
    
    return `${basePrompt}

Your role: ${role}
Your personality: ${personality}
Business: ${config.businessName}
Location: ${config.businessAddress}

Communication Guidelines:
- Be helpful, friendly, and professional
- Respond in the user's language (detect from their message)
- Keep responses concise but informative
- Ask clarifying questions when needed
- Provide accurate information about products/services
- Guide users through processes step by step

Important: Always maintain a ${personality} tone while being ${role}.

${config.customPrompt ? `\nCustom Instructions:\n${config.customPrompt}` : ''}`;
  }

  public async testConnection(): Promise<boolean> {
    try {
      const testResponse = await this.processMessage([
        { role: 'user', content: 'Hello, this is a connection test.' }
      ]);
      
      return testResponse.content.length > 0;
    } catch (error) {
      logger.error('GroqCloud connection test failed', { error });
      return false;
    }
  }
}

export const groqService = new GroqService();