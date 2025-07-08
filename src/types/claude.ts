import { ConversationMessage, ConversationState } from "./conversation";
import { Customer } from "./customer";
import { Product } from "./product";

export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  messages: ClaudeMessage[];
  system?: string | CachedSystemPrompt[];
  temperature?: number;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ClaudePromptContext {
  customerData: Customer;
  conversationState: ConversationState;
  productCatalog: Product[];
  conversationHistory: ConversationMessage[];
  currentIntent?: string;
}

// Prompt Caching Interfaces
export interface CachedSystemPrompt {
  type: "text";
  text: string;
  cache_control?: CacheControl;
}

export interface CacheControl {
  type: "ephemeral";
}

export interface PromptCacheMetrics {
  totalCalls: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  totalTokensSaved: number;
  costSavings: number;
}

export interface TokenUsageBreakdown {
  staticPromptTokens: number;
  dynamicContextTokens: number;
  conversationHistoryTokens: number;
  productRecommendationTokens: number;
  totalInputTokens: number;
  outputTokens: number;
  isCacheHit: boolean;
}

export interface OptimizedSystemPrompt {
  staticPrompt: CachedSystemPrompt;
  dynamicContext: CachedSystemPrompt;
  estimatedTokens: {
    static: number;
    dynamic: number;
    total: number;
  };
}