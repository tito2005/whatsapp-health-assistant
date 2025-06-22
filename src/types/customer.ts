export interface Customer {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  address?: string;
  dateOfBirth?: Date;
  healthProfile?: HealthProfile;
  orderHistory: string[]; // Order IDs
  conversationHistory: string[]; // Conversation IDs
  preferences: CustomerPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface HealthProfile {
  conditions: string[];
  medications: string[];
  allergies: string[];
  goals: string[];
  lastConsultation?: Date;
}

export interface CustomerPreferences {
  language: 'id' | 'en';
  communicationStyle: 'formal' | 'casual';
  notificationSettings: {
    orderUpdates: boolean;
    healthTips: boolean;
    productRecommendations: boolean;
  };
}