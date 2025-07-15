/**
 * Enhanced Health Intelligence Types
 * Supporting advanced health term mapping, context-aware scoring, and smart conversations
 */

export interface EnhancedHealthMapping {
  term: string;
  variations: string[];           // Regional/colloquial variants
  englishEquivalents: string[];
  severity: SeverityLevel;
  category: string;               // Health category ID
  contextClues: string[];         // Associated words that increase confidence
  opposites?: string[];           // Terms that contradict this condition
  confidence: number;             // Base confidence score for this mapping
}

export interface HealthCategory {
  id: string;
  name: string;
  followUpQuestions: ConversationTemplate[];
  scoringWeights: ScoringWeights;
  urgencyLevel: UrgencyLevel;
}

export interface ConversationTemplate {
  id: string;
  question: string;
  category: QuestionCategory;
  priority: 'high' | 'medium' | 'low';
  conditionalLogic?: ConditionalTrigger;
  expectedAnswerType: AnswerType;
  followUpMapping?: Record<string, string>;
}

export interface ScoringWeights {
  symptomMatch: number;
  conditionMatch: number;
  severityMultiplier: number;
  durationBonus: number;
  contextualRelevance: number;
  userProfileAlignment: number;
}

export interface TemporalContext {
  duration: 'acute' | 'subacute' | 'chronic' | 'unknown';
  frequency: 'occasional' | 'frequent' | 'constant' | 'unknown';
  progression: 'improving' | 'stable' | 'worsening' | 'unknown';
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  triggers?: string[];
}

export interface EnhancedHealthAssessment {
  symptoms: ExtractedSymptom[];
  conditions: ExtractedCondition[];
  severity: SeverityString;
  duration: string;
  goals: string[];
  temporalContext: TemporalContext;
  contextualFactors: ContextualFactor[];
  informationGaps: InformationGap[];
}

export interface ExtractedSymptom {
  term: string;
  originalText: string;
  confidence: number;
  severity: SeverityString;
  mappedTerms: string[];
  contextClues: string[];
}

export interface ExtractedCondition {
  term: string;
  originalText: string;
  confidence: number;
  severity: SeverityString;
  mappedTerms: string[];
  medicalCategory: string;
}

export interface ContextualFactor {
  type: 'lifestyle' | 'environmental' | 'dietary' | 'medication' | 'stress';
  value: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export interface InformationGap {
  type: 'duration' | 'severity' | 'triggers' | 'frequency' | 'progression';
  importance: 'critical' | 'important' | 'helpful';
  suggestedQuestion: string;
}

export interface SmartQuestion {
  question: string;
  category: QuestionCategory;
  priority: 'high' | 'medium' | 'low';
  conditionalLogic?: ConditionalTrigger;
  expectedAnswerType: AnswerType;
  contextualHints?: string[];
}

export interface ContextualProductRecommendation {
  product: any; // Product type from existing system
  relevanceScore: number;
  contextualReasons: ContextualReason[];
  benefits: string[];
  smartQuestions?: SmartQuestion[];
  followUpAdvice?: string;
  urgencyLevel: UrgencyLevel;
}

export interface ContextualReason {
  type: 'symptom_match' | 'condition_match' | 'severity_appropriate' | 'duration_suitable' | 'profile_aligned';
  explanation: string;
  confidence: number;
  supportingEvidence: string[];
}

export interface ConversationIntelligence {
  healthConcerns: ExtractedHealthData;
  informationGaps: InformationGap[];
  consultationUrgency: UrgencyLevel;
  recommendedConversationPath: ConversationPath;
  contextualQuestions: SmartQuestion[];
  conversationDepth: ConsultationLevel;
}

export interface ExtractedHealthData {
  symptoms: ExtractedSymptom[];
  conditions: ExtractedCondition[];
  temporalContext: TemporalContext;
  severityAssessment: SeverityAssessment;
  userProfile: UserHealthProfile;
}

export interface SeverityAssessment {
  overall: SeverityLevel;
  impact: 'minimal' | 'moderate' | 'severe' | 'debilitating';
  urgency: UrgencyLevel;
  functionalImpact: number; // 1-10 scale
}

export interface UserHealthProfile {
  age?: number;
  gender?: 'male' | 'female';
  chronicalConditions: string[];
  medicationHistory: string[];
  lifestyleFactors: string[];
  communicationPreference: 'brief' | 'detailed' | 'conversational';
}

// Enums and Types
export type SeverityLevel = 'mild' | 'moderate' | 'severe' | 'any';
export type SeverityString = string; // For dynamic severity handling
export type UrgencyLevel = 'routine' | 'soon' | 'urgent' | 'emergency';
export type QuestionCategory = 'duration' | 'severity' | 'triggers' | 'lifestyle' | 'medical_history' | 'symptoms' | 'frequency' | 'progression';
export type AnswerType = 'duration' | 'scale' | 'boolean' | 'descriptive' | 'choice';
export type ConversationPath = 'quick_consultation' | 'detailed_assessment' | 'product_focused' | 'educational';
export type ConsultationLevel = 'basic' | 'intermediate' | 'comprehensive';

export interface ConditionalTrigger {
  condition: string;
  operator: 'contains' | 'equals' | 'greater_than' | 'less_than';
  value: string | number;
  action: 'ask' | 'skip' | 'prioritize';
}

// Smart conversation context
export interface SmartConversationContext {
  currentQuestionCategory?: QuestionCategory;
  askedQuestions: string[];
  gatheredContext: Record<string, any>;
  conversationDepth: ConsultationLevel;
  userEngagement: 'low' | 'medium' | 'high';
  informationCompleteness: number; // 0-100%
}

// Scoring context for product recommendations
export interface ScoringContext {
  userProfile?: UserHealthProfile;
  conversationHistory?: string[];
  previousRecommendations?: string[];
  urgencyLevel?: UrgencyLevel;
  consultationDepth?: ConsultationLevel;
}