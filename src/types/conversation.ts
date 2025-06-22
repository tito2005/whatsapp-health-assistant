import { Order } from "./order";

export type ConversationState = 
  | 'greeting'
  | 'health_inquiry'
  | 'product_recommendation'
  | 'order_collection'
  | 'order_confirmation'
  | 'lifestyle_advice'
  | 'completed';

export interface ConversationContext {
  customerId: string;
  state: ConversationState;
  healthConcerns: string[];
  recommendedProducts: string[];
  orderInProgress?: Partial<Order>;
  conversationHistory: ConversationMessage[];
  lastActivity: Date;
  metadata: Record<string, any>;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}