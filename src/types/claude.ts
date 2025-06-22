import { ConversationMessage, ConversationState } from "./conversation";
import { Customer } from "./customer";
import { Product } from "./product";

export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  messages: ClaudeMessage[];
  system?: string;
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