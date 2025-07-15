/**
 * Smart Conversation Engine
 * Intelligent conversation flow with contextual follow-up questions and adaptive consultation depth
 */

import { logger } from '@/shared/logger';
import { ConversationContext } from '@/claude/claude-service';
import { 
  SmartQuestion,
  InformationGap,
  ExtractedHealthData,
  ConsultationLevel,
  UrgencyLevel,
  ContextualProductRecommendation
} from '@/types/health-intelligence';
import { enhancedHealthMappingService } from './enhanced-health-mapping';

export interface ConversationAnalysis {
  healthDataCompleteness: number; // 0-100%
  urgencyLevel: UrgencyLevel;
  recommendedQuestions: SmartQuestion[];
  conversationDepth: ConsultationLevel;
  nextBestAction: 'ask_questions' | 'provide_recommendations' | 'seek_clarification' | 'escalate';
  informationGaps: InformationGap[];
}

export class SmartConversationEngine {
  private maxQuestionsPerTurn = 2;
  private questionHistory: Map<string, string[]> = new Map();
  
  constructor() {
    logger.info('Smart Conversation Engine initialized with adaptive questioning capabilities');
  }

  /**
   * Analyze current conversation and generate intelligent follow-up
   */
  public analyzeConversation(
    message: string,
    context: ConversationContext,
    extractedHealthData: ExtractedHealthData
  ): ConversationAnalysis {
    const startTime = Date.now();

    try {
      // Assess information completeness
      const completeness = this.assessInformationCompleteness(extractedHealthData);
      
      // Determine urgency level
      const urgencyLevel = this.assessUrgencyLevel(extractedHealthData, message);
      
      // Identify information gaps
      const informationGaps = this.identifyInformationGaps(extractedHealthData);
      
      // Generate smart questions
      const recommendedQuestions = this.generateSmartQuestions(
        extractedHealthData, 
        informationGaps, 
        context
      );
      
      // Determine conversation depth
      const conversationDepth = this.determineConsultationDepth(
        extractedHealthData, 
        context, 
        urgencyLevel
      );
      
      // Decide next best action
      const nextBestAction = this.determineNextAction(
        completeness, 
        urgencyLevel, 
        informationGaps.length,
        context
      );

      const analysis: ConversationAnalysis = {
        healthDataCompleteness: completeness,
        urgencyLevel,
        recommendedQuestions: recommendedQuestions.slice(0, this.maxQuestionsPerTurn),
        conversationDepth,
        nextBestAction,
        informationGaps
      };

      const duration = Date.now() - startTime;
      logger.info('Conversation analyzed', {
        userId: context.userId,
        completeness: completeness.toFixed(1),
        urgencyLevel,
        questionsGenerated: recommendedQuestions.length,
        nextAction: nextBestAction,
        duration
      });

      return analysis;

    } catch (error) {
      logger.error('Failed to analyze conversation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: context.userId
      });
      
      return this.createFallbackAnalysis();
    }
  }

  /**
   * Generate contextual follow-up questions based on health data
   */
  public generateContextualQuestions(
    extractedHealthData: ExtractedHealthData,
    context: ConversationContext
  ): SmartQuestion[] {
    const questions: SmartQuestion[] = [];
    const askedQuestions = this.questionHistory.get(context.userId) || [];

    // Questions based on symptoms
    extractedHealthData.symptoms.forEach(symptom => {
      const categoryQuestions = this.getSymptomSpecificQuestions(symptom.term, symptom.severity);
      questions.push(...categoryQuestions.filter(q => !askedQuestions.includes(q.question)));
    });

    // Questions based on conditions
    extractedHealthData.conditions.forEach(condition => {
      const categoryQuestions = this.getConditionSpecificQuestions(condition.term, condition.medicalCategory);
      questions.push(...categoryQuestions.filter(q => !askedQuestions.includes(q.question)));
    });

    // Temporal context questions
    if (!extractedHealthData.temporalContext.duration || extractedHealthData.temporalContext.duration === 'unknown') {
      questions.push({
        question: 'Keluhan ini sudah berapa lama? Baru hari ini, minggu ini, atau sudah lebih lama?',
        category: 'duration',
        priority: 'high',
        expectedAnswerType: 'duration',
        contextualHints: ['Durasi keluhan membantu menentukan jenis penanganan yang tepat']
      });
    }

    // Severity clarification
    const hasUnclearSeverity = extractedHealthData.symptoms.some(s => s.severity === 'any');
    if (hasUnclearSeverity) {
      questions.push({
        question: 'Seberapa mengganggu keluhan ini? Ringan, sedang, atau cukup parah?',
        category: 'severity',
        priority: 'high',
        expectedAnswerType: 'scale',
        contextualHints: ['Tingkat keparahan membantu pilih produk yang sesuai']
      });
    }

    // Lifestyle and trigger questions
    questions.push(...this.generateLifestyleQuestions(extractedHealthData));

    // Sort by priority and remove duplicates
    return this.prioritizeAndDeduplicateQuestions(questions, context);
  }

  /**
   * Determine appropriate consultation depth based on context
   */
  public determineConsultationDepth(
    extractedHealthData: ExtractedHealthData,
    context: ConversationContext,
    urgencyLevel: UrgencyLevel
  ): ConsultationLevel {
    let depthScore = 0;

    // Complexity factors
    if (extractedHealthData.conditions.length > 1) depthScore += 2;
    if (extractedHealthData.symptoms.length > 3) depthScore += 2;
    if (urgencyLevel === 'urgent' || urgencyLevel === 'emergency') depthScore += 3;

    // User engagement factors
    const messageCount = context.messages.length;
    if (messageCount > 5) depthScore += 1;

    // User preference
    const userPrefs = context.metadata?.userPreferences;
    if (userPrefs?.communicationStyle === 'detailed') depthScore += 2;
    if (userPrefs?.communicationStyle === 'brief') depthScore -= 1;

    // Determine depth
    if (depthScore >= 5) return 'comprehensive';
    if (depthScore >= 3) return 'intermediate';
    return 'basic';
  }

  /**
   * Create intelligent conversation response with questions
   */
  public createIntelligentResponse(
    analysis: ConversationAnalysis,
    recommendations: ContextualProductRecommendation[],
    context: ConversationContext
  ): string {
    let response = '';

    // Handle based on next best action
    switch (analysis.nextBestAction) {
      case 'ask_questions':
        response = this.createQuestionResponse(analysis.recommendedQuestions);
        break;
        
      case 'provide_recommendations':
        response = this.createRecommendationResponse(recommendations, analysis);
        break;
        
      case 'seek_clarification':
        response = this.createClarificationResponse(analysis.informationGaps);
        break;
        
      case 'escalate':
        response = this.createEscalationResponse(analysis.urgencyLevel);
        break;
        
      default:
        response = 'Ada yang bisa saya bantu lagi untuk keluhan kesehatan Anda?';
    }

    // Add contextual follow-up if appropriate
    if (analysis.recommendedQuestions.length > 0 && analysis.nextBestAction !== 'ask_questions') {
      const topQuestion = analysis.recommendedQuestions[0];
      if (topQuestion && topQuestion.priority === 'high') {
        response += `\n\n${topQuestion.question}`;
      }
    }

    // Track asked questions
    this.trackAskedQuestions(context.userId, analysis.recommendedQuestions);

    return response;
  }

  // Private helper methods

  private assessInformationCompleteness(extractedHealthData: ExtractedHealthData): number {
    let completeness = 0;

    // Check symptom/condition presence (25%)
    if (extractedHealthData.symptoms.length > 0 || extractedHealthData.conditions.length > 0) {
      completeness += 25;
    }

    // Check severity assessment (20%)
    if (extractedHealthData.severityAssessment.overall !== 'any') {
      completeness += 20;
    }

    // Check temporal context (20%)
    const temporal = extractedHealthData.temporalContext;
    if (temporal.duration !== 'unknown' || temporal.frequency !== 'unknown') {
      completeness += 20;
    }

    // Check user profile (15%)
    if (extractedHealthData.userProfile.age || extractedHealthData.userProfile.chronicalConditions.length > 0) {
      completeness += 15;
    }

    // Check symptom detail completeness (20%)
    const detailedSymptoms = extractedHealthData.symptoms.filter(s => s.confidence > 0.7);
    if (detailedSymptoms.length > 0) {
      completeness += 20;
    }

    return Math.min(completeness, 100);
  }

  private assessUrgencyLevel(extractedHealthData: ExtractedHealthData, message: string): UrgencyLevel {
    const urgentMarkers = ['emergency', 'darurat', 'sangat sakit', 'parah banget', 'tidak tahan'];
    const soonMarkers = ['cepat', 'segera', 'butuh bantuan', 'sakit banget'];

    const normalizedMessage = message.toLowerCase();
    
    if (urgentMarkers.some(marker => normalizedMessage.includes(marker))) {
      return 'emergency';
    }

    if (soonMarkers.some(marker => normalizedMessage.includes(marker))) {
      return 'urgent';
    }

    // Check based on condition severity
    const hasSevereConditions = extractedHealthData.conditions.some(c => c.severity === 'severe');
    const hasSevereSymptoms = extractedHealthData.symptoms.some(s => s.severity === 'severe');

    if (hasSevereConditions || hasSevereSymptoms) {
      return 'soon';
    }

    return 'routine';
  }

  private identifyInformationGaps(extractedHealthData: ExtractedHealthData): InformationGap[] {
    const gaps: InformationGap[] = [];

    // Duration gap
    if (extractedHealthData.temporalContext.duration === 'unknown') {
      gaps.push({
        type: 'duration',
        importance: 'critical',
        suggestedQuestion: 'Keluhan ini sudah berapa lama?'
      });
    }

    // Severity gap
    if (extractedHealthData.severityAssessment.overall === 'any') {
      gaps.push({
        type: 'severity',
        importance: 'important',
        suggestedQuestion: 'Seberapa parah keluhan yang dirasakan?'
      });
    }

    // Trigger gap
    if (extractedHealthData.temporalContext.triggers?.length === 0) {
      gaps.push({
        type: 'triggers',
        importance: 'helpful',
        suggestedQuestion: 'Ada pemicu tertentu yang membuat keluhan ini muncul?'
      });
    }

    // Frequency gap
    if (extractedHealthData.temporalContext.frequency === 'unknown') {
      gaps.push({
        type: 'frequency',
        importance: 'important',
        suggestedQuestion: 'Seberapa sering keluhan ini muncul?'
      });
    }

    return gaps;
  }

  private generateSmartQuestions(
    extractedHealthData: ExtractedHealthData,
    informationGaps: InformationGap[],
    _context: ConversationContext
  ): SmartQuestion[] {
    const questions: SmartQuestion[] = [];

    // Generate questions from information gaps
    informationGaps.forEach(gap => {
      questions.push({
        question: gap.suggestedQuestion,
        category: gap.type,
        priority: gap.importance === 'critical' ? 'high' : 
                 gap.importance === 'important' ? 'medium' : 'low',
        expectedAnswerType: gap.type === 'duration' ? 'duration' :
                           gap.type === 'severity' ? 'scale' : 'descriptive'
      });
    });

    // Add category-specific questions
    const categoryIds = this.getCategoryIds(extractedHealthData);
    categoryIds.forEach(categoryId => {
      const categoryQuestions = enhancedHealthMappingService.getFollowUpQuestions([categoryId]);
      questions.push(...categoryQuestions.map(template => ({
        question: template.question,
        category: template.category,
        priority: template.priority,
        expectedAnswerType: template.expectedAnswerType
      })));
    });

    return questions;
  }

  private determineNextAction(
    completeness: number,
    urgencyLevel: UrgencyLevel,
    gapCount: number,
    _context: ConversationContext
  ): ConversationAnalysis['nextBestAction'] {
    // Emergency cases should escalate
    if (urgencyLevel === 'emergency') {
      return 'escalate';
    }

    // If information is very incomplete, ask questions
    if (completeness < 40 && gapCount > 2) {
      return 'ask_questions';
    }

    // If moderately complete and urgent, provide recommendations
    if (completeness >= 60 || urgencyLevel === 'urgent') {
      return 'provide_recommendations';
    }

    // If some gaps but good progress, seek clarification
    if (gapCount > 0 && completeness >= 40) {
      return 'seek_clarification';
    }

    // Default to providing recommendations
    return 'provide_recommendations';
  }

  private getSymptomSpecificQuestions(symptom: string, _severity: string): SmartQuestion[] {
    const questions: SmartQuestion[] = [];

    // Digestive symptom questions
    if (['maag', 'begah', 'mulas', 'eneg'].includes(symptom)) {
      questions.push({
        question: 'Keluhan ini muncul sebelum atau sesudah makan?',
        category: 'triggers',
        priority: 'high',
        expectedAnswerType: 'choice'
      });
    }

    // Fatigue symptom questions
    if (['lemes', 'capek', 'lelah'].includes(symptom)) {
      questions.push({
        question: 'Istirahat cukup nggak? Biasanya tidur berapa jam per malam?',
        category: 'lifestyle',
        priority: 'medium',
        expectedAnswerType: 'descriptive'
      });
    }

    return questions;
  }

  private getConditionSpecificQuestions(_condition: string, category: string): SmartQuestion[] {
    const questions: SmartQuestion[] = [];

    if (category === 'metabolic') {
      questions.push({
        question: 'Sudah pernah cek gula darah belum? Hasilnya berapa?',
        category: 'medical_history',
        priority: 'high',
        expectedAnswerType: 'descriptive'
      });
    }

    if (category === 'cardiovascular') {
      questions.push({
        question: 'Tekanan darah terakhir berapa? Ada riwayat keluarga dengan masalah jantung?',
        category: 'medical_history',
        priority: 'high',
        expectedAnswerType: 'descriptive'
      });
    }

    return questions;
  }

  private generateLifestyleQuestions(extractedHealthData: ExtractedHealthData): SmartQuestion[] {
    const questions: SmartQuestion[] = [];

    // Activity level question
    if (extractedHealthData.symptoms.some(s => ['lemes', 'capek'].includes(s.term))) {
      questions.push({
        question: 'Aktivitas harian gimana? Banyak duduk atau cukup aktif bergerak?',
        category: 'lifestyle',
        priority: 'medium',
        expectedAnswerType: 'descriptive'
      });
    }

    // Diet question for digestive issues
    if (extractedHealthData.symptoms.some(s => ['maag', 'begah', 'mulas'].includes(s.term))) {
      questions.push({
        question: 'Pola makan gimana? Sering telat makan atau makan makanan pedas/asam?',
        category: 'lifestyle',
        priority: 'medium',
        expectedAnswerType: 'descriptive'
      });
    }

    return questions;
  }

  private prioritizeAndDeduplicateQuestions(questions: SmartQuestion[], context: ConversationContext): SmartQuestion[] {
    const askedQuestions = this.questionHistory.get(context.userId) || [];
    
    // Remove already asked questions
    const newQuestions = questions.filter(q => !askedQuestions.includes(q.question));
    
    // Sort by priority
    return newQuestions.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private createQuestionResponse(questions: SmartQuestion[]): string {
    if (questions.length === 0) return 'Bisa cerita lebih detail tentang keluhan yang dirasakan?';

    const topQuestion = questions[0]!;
    let response = topQuestion.question;

    // Add contextual hint if available
    if (topQuestion.contextualHints && topQuestion.contextualHints.length > 0) {
      response += `\n\n💡 ${topQuestion.contextualHints[0]}`;
    }

    return response;
  }

  private createRecommendationResponse(
    recommendations: ContextualProductRecommendation[],
    _analysis: ConversationAnalysis
  ): string {
    if (recommendations.length === 0) {
      return 'Berdasarkan keluhan yang dijelaskan, saya akan carikan produk yang sesuai ya.';
    }

    const topRec = recommendations[0]!;
    let response = `Untuk keluhan ini, saya rekomendasikan ${topRec.product.name}.`;

    if (topRec.contextualReasons.length > 0) {
      const reason = topRec.contextualReasons[0]!;
      response += ` ${reason.explanation}.`;
    }

    return response;
  }

  private createClarificationResponse(gaps: InformationGap[]): string {
    const criticalGap = gaps.find(g => g.importance === 'critical');
    if (criticalGap) {
      return criticalGap.suggestedQuestion;
    }

    return 'Bisa dijelaskan lebih detail tentang keluhan yang dirasakan?';
  }

  private createEscalationResponse(urgencyLevel: UrgencyLevel): string {
    if (urgencyLevel === 'emergency') {
      return 'Sepertinya kondisi ini memerlukan penanganan medis segera. Saya sarankan untuk konsultasi dengan dokter atau kunjungi fasilitas kesehatan terdekat ya.';
    }

    return 'Untuk kondisi ini, sebaiknya konsultasi dengan tenaga medis juga ya selain menggunakan suplemen.';
  }

  private trackAskedQuestions(userId: string, questions: SmartQuestion[]): void {
    const askedQuestions = this.questionHistory.get(userId) || [];
    const newQuestions = questions.map(q => q.question);
    
    this.questionHistory.set(userId, [...askedQuestions, ...newQuestions].slice(-10)); // Keep last 10
  }

  private getCategoryIds(extractedHealthData: ExtractedHealthData): string[] {
    const categoryIds = new Set<string>();
    
    extractedHealthData.conditions.forEach(condition => {
      categoryIds.add(condition.medicalCategory);
    });
    
    // Could also map symptoms to categories
    return Array.from(categoryIds);
  }

  private createFallbackAnalysis(): ConversationAnalysis {
    return {
      healthDataCompleteness: 30,
      urgencyLevel: 'routine',
      recommendedQuestions: [{
        question: 'Bisa cerita lebih detail tentang keluhan yang dirasakan?',
        category: 'symptoms',
        priority: 'medium',
        expectedAnswerType: 'descriptive'
      }],
      conversationDepth: 'basic',
      nextBestAction: 'seek_clarification',
      informationGaps: []
    };
  }
}

export const smartConversationEngine = new SmartConversationEngine();