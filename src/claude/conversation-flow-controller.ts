import { ConversationContext, ConversationState } from './claude-service';

export interface ConversationStage {
  current: ConversationState;
  progress: number; // 0-100% completion of current stage
  nextExpected: ConversationState[];
  completedStages: ConversationState[];
}

export interface FlowContextSummary {
  stage: ConversationStage;
  customerProfile: {
    healthConcerns?: string[];
    dietGoals?: string[];
    eatingHabits?: {
      mealsPerDay?: number;
      usualMeals?: string[];
      hasSnacks?: boolean;
      restrictions?: string[];
    };
    mentionedProducts?: string[];
  };
  orderProgress?: {
    hasItems: boolean;
    customerInfoComplete: boolean;
    readyForConfirmation: boolean;
  };
  conversationSummary: string; // Short AI-readable summary
}

export interface MealPlanTemplate {
  id: string;
  name: string;
  targetCondition: string[];
  mealsPerDay: number;
  structure: {
    breakfast: MealOption[];
    lunch: MealOption[];
    dinner: MealOption[];
    snacks?: MealOption[];
  };
  products: string[]; // Product IDs that support this plan
}

export interface MealOption {
  type: 'main' | 'supplement' | 'beverage';
  description: string;
  products?: string[]; // Specific products for this meal
  timing?: string;
}

export class ConversationFlowController {
  private static instance: ConversationFlowController;
  
  // Structured meal plan templates
  private mealPlanTemplates: MealPlanTemplate[] = [
    {
      id: 'diabetes_control',
      name: 'Kontrol Diabetes',
      targetCondition: ['diabetes', 'gula darah'],
      mealsPerDay: 3,
      structure: {
        breakfast: [
          { type: 'supplement', description: 'Mganik Metafiber dengan air hangat', products: ['mganik-metafiber'] },
          { type: 'main', description: 'Oatmeal atau roti gandum' },
          { type: 'beverage', description: 'Air putih 2 gelas' }
        ],
        lunch: [
          { type: 'main', description: 'Nasi merah + lauk protein + sayuran hijau' },
          { type: 'supplement', description: 'Hotto Purto setelah makan', products: ['hotto-purto'] }
        ],
        dinner: [
          { type: 'main', description: 'Protein + sayuran (hindari karbohidrat berlebih)' },
          { type: 'supplement', description: 'Mganik Metafiber sebelum tidur', products: ['mganik-metafiber'] }
        ],
        snacks: [
          { type: 'main', description: 'Buah rendah gula (apel, pir) atau kacang almond' }
        ]
      },
      products: ['mganik-metafiber', 'hotto-purto']
    },
    {
      id: 'weight_management',
      name: 'Manajemen Berat Badan',
      targetCondition: ['diet', 'berat badan', 'obesitas'],
      mealsPerDay: 3,
      structure: {
        breakfast: [
          { type: 'supplement', description: 'Flimty Fiber dengan air dingin', products: ['flimty-fiber'] },
          { type: 'main', description: 'Protein shake atau telur rebus + sayuran' }
        ],
        lunch: [
          { type: 'main', description: 'Salad protein (ayam/ikan) + sayuran hijau' },
          { type: 'supplement', description: 'Mganik Superfood sebagai meal replacement', products: ['mganik-superfood'] }
        ],
        dinner: [
          { type: 'supplement', description: 'Spencers Mealblend sebagai pengganti makan malam', products: ['spencers-mealblend'] },
          { type: 'beverage', description: 'Air putih minimal 8 gelas/hari' }
        ],
        snacks: [
          { type: 'supplement', description: 'Mganik 3Peptide untuk mengurangi lapar', products: ['mganik-3peptide'] }
        ]
      },
      products: ['flimty-fiber', 'mganik-superfood', 'spencers-mealblend', 'mganik-3peptide']
    },
    {
      id: 'digestive_health',
      name: 'Kesehatan Pencernaan',
      targetCondition: ['pencernaan', 'maag', 'sembelit'],
      mealsPerDay: 3,
      structure: {
        breakfast: [
          { type: 'supplement', description: 'Mganik Metafiber dengan air hangat (perut kosong)', products: ['mganik-metafiber'] },
          { type: 'main', description: 'Bubur oat atau smoothie buah' }
        ],
        lunch: [
          { type: 'main', description: 'Makanan mudah dicerna + sayuran rebus' },
          { type: 'supplement', description: 'Hotto Mame untuk kesehatan usus', products: ['hotto-mame'] }
        ],
        dinner: [
          { type: 'main', description: 'Sup ayam atau ikan kukus + sayuran' },
          { type: 'supplement', description: 'Flimty Fiber untuk detox malam', products: ['flimty-fiber'] }
        ]
      },
      products: ['mganik-metafiber', 'hotto-mame', 'flimty-fiber']
    }
  ];

  public static getInstance(): ConversationFlowController {
    if (!ConversationFlowController.instance) {
      ConversationFlowController.instance = new ConversationFlowController();
    }
    return ConversationFlowController.instance;
  }

  /**
   * Detect the appropriate conversation flow and stage
   */
  public detectConversationFlow(
    userMessage: string, 
    aiResponse: string, 
    context: ConversationContext
  ): ConversationState {
    const lowerMessage = userMessage.toLowerCase();
    const lowerResponse = aiResponse.toLowerCase();

    // Check for conversation completion (after order confirmation)
    if (context.state === ConversationState.ORDER_CONFIRMATION && 
        (lowerResponse.includes('terima kasih sudah order') || 
         lowerResponse.includes('sehat selalu'))) {
      return ConversationState.CONVERSATION_COMPLETE;
    }

    // If already in complete state, only respond to new questions
    if (context.state === ConversationState.CONVERSATION_COMPLETE &&
        (lowerMessage.includes('?') || lowerMessage.includes('tanya') || 
         lowerMessage.includes('mau'))) {
      // Reset to appropriate state based on question
      if (lowerMessage.includes('order') || lowerMessage.includes('pesan')) {
        return ConversationState.ORDER_COLLECTION;
      } else if (lowerMessage.includes('diet') || lowerMessage.includes('saran')) {
        return ConversationState.DIET_CONSULTATION;
      } else {
        return ConversationState.PRODUCT_RECOMMENDATION;
      }
    }

    // Check for diet consultation keywords
    if (lowerMessage.includes('saran') || lowerMessage.includes('diet') || 
        lowerMessage.includes('meal plan') || lowerMessage.includes('pola makan') ||
        lowerMessage.includes('cara makan') || lowerMessage.includes('menu')) {
      return ConversationState.DIET_CONSULTATION;
    }

    // Stay in diet consultation if we're collecting diet profile info
    if (context.state === ConversationState.DIET_CONSULTATION && 
        (lowerMessage.includes('kali') || lowerMessage.includes('biasa') || 
         lowerMessage.includes('snack') || lowerMessage.includes('cemilan'))) {
      return ConversationState.DIET_CONSULTATION;
    }

    // Order-related detection
    if (lowerMessage.includes('pesan') || lowerMessage.includes('order') || 
        lowerMessage.includes('beli') || lowerResponse.includes('alamat lengkap')) {
      return ConversationState.ORDER_COLLECTION;
    }

    // Order confirmation detection
    if (context.state === ConversationState.ORDER_COLLECTION && 
        context.metadata?.currentOrder && 
        (lowerMessage.includes('ya') || lowerMessage.includes('benar') || 
         lowerMessage.includes('konfirm') || lowerResponse.includes('konfirmasi pesanan'))) {
      return ConversationState.ORDER_CONFIRMATION;
    }

    // Health consultation
    if (lowerMessage.includes('sakit') || lowerMessage.includes('keluhan') ||
        lowerMessage.includes('diabetes') || lowerMessage.includes('gejala')) {
      return ConversationState.HEALTH_INQUIRY;
    }

    // Product inquiry
    if (lowerMessage.includes('produk') || lowerMessage.includes('harga') ||
        lowerMessage.includes('manfaat') || lowerResponse.includes('saya rekomendasikan')) {
      return ConversationState.PRODUCT_RECOMMENDATION;
    }

    // Default state progression
    if (context.state === ConversationState.GREETING) {
      return ConversationState.PRODUCT_RECOMMENDATION;
    }

    return context.state;
  }

  /**
   * Generate enhanced context summary for AI understanding
   */
  public generateFlowContextSummary(context: ConversationContext): FlowContextSummary {
    const stage = this.analyzeConversationStage(context);
    const customerProfile = this.extractCustomerProfile(context);
    const orderProgress = this.analyzeOrderProgress(context);
    const conversationSummary = this.generateShortSummary(context, stage);

    return {
      stage,
      customerProfile,
      ...(orderProgress ? { orderProgress } : {}),
      conversationSummary
    };
  }

  /**
   * Get appropriate meal plan template based on customer profile
   */
  public getMealPlanTemplate(healthConcerns: string[], dietGoals: string[] = []): MealPlanTemplate | null {
    const allConcerns = [...healthConcerns, ...dietGoals].map(c => c.toLowerCase());
    
    // Find the best matching template
    for (const template of this.mealPlanTemplates) {
      if (template.targetCondition.some(condition => 
        allConcerns.some(concern => concern.includes(condition))
      )) {
        return template;
      }
    }

    // Default to weight management if no specific match
    return this.mealPlanTemplates.find(t => t.id === 'weight_management') || null;
  }

  /**
   * Generate personalized meal plan based on customer profile
   */
  public generatePersonalizedMealPlan(
    template: MealPlanTemplate,
    customerProfile: FlowContextSummary['customerProfile']
  ): string {
    const { eatingHabits, healthConcerns } = customerProfile;
    
    let plan = `📋 *${template.name} - Meal Plan Kustom*\n\n`;
    
    // Adjust meals per day based on customer habits
    const mealsPerDay = eatingHabits?.mealsPerDay || template.mealsPerDay;
    
    plan += `⏰ *Jadwal Makan (${mealsPerDay}x sehari):*\n\n`;
    
    // Breakfast
    plan += `🌅 *Sarapan (07:00-08:00):*\n`;
    template.structure.breakfast.forEach(meal => {
      plan += `• ${meal.description}\n`;
    });
    plan += `\n`;
    
    // Lunch
    plan += `☀️ *Makan Siang (12:00-13:00):*\n`;
    template.structure.lunch.forEach(meal => {
      plan += `• ${meal.description}\n`;
    });
    plan += `\n`;
    
    // Dinner (adjust if customer eats less frequently)
    if (mealsPerDay >= 3) {
      plan += `🌙 *Makan Malam (18:00-19:00):*\n`;
      template.structure.dinner.forEach(meal => {
        plan += `• ${meal.description}\n`;
      });
      plan += `\n`;
    }
    
    // Snacks (if customer has snacking habits)
    if (eatingHabits?.hasSnacks && template.structure.snacks) {
      plan += `🍎 *Cemilan Sehat:*\n`;
      template.structure.snacks.forEach(snack => {
        plan += `• ${snack.description}\n`;
      });
      plan += `\n`;
    }
    
    // Special notes based on health concerns
    if (healthConcerns?.includes('diabetes')) {
      plan += `⚠️ *Khusus Diabetes:*\n`;
      plan += `• Minum banyak air putih (minimal 8 gelas/hari)\n`;
      plan += `• Hindari gula tambahan dan karbohidrat olahan\n`;
      plan += `• Konsumsi suplemen 30 menit sebelum makan\n\n`;
    }
    
    plan += `💡 *Tips:* Menu ini bisa disesuaikan dengan selera Anda. Yang penting konsisten dan seimbang ya Kak! 😊\n\n`;
    plan += `Apakah meal plan ini cocok? Atau ada yang mau disesuaikan?`;
    
    return plan;
  }

  /**
   * Check if conversation should transition to ordering
   */
  public shouldTransitionToOrder(context: ConversationContext, aiResponse: string): boolean {
    // After diet consultation, if customer seems satisfied
    if (context.state === ConversationState.DIET_CONSULTATION && 
        (aiResponse.includes('cocok') || aiResponse.includes('tertarik') || 
         context.messages.length >= 8)) { // After sufficient consultation
      return true;
    }
    
    // After product recommendation, if customer shows interest
    if (context.state === ConversationState.PRODUCT_RECOMMENDATION && 
        context.metadata?.mentionedProducts && 
        context.metadata.mentionedProducts.length > 0) {
      return true;
    }
    
    return false;
  }

  /**
   * Generate conversation closure message
   */
  public generateClosureMessage(context: ConversationContext): string {
    const order = context.metadata?.currentOrder;
    
    if (order && order.customerName) {
      return `Terima kasih sudah order ya ${order.customerName}! 🙏\n\nPesanan Anda akan segera diproses. Sehat selalu Kak! 😊\n\nJika ada pertanyaan lain, jangan ragu untuk chat lagi ya! 💪`;
    } else {
      return `Terima kasih sudah order! 🙏\n\nPesanan Anda akan segera diproses. Sehat selalu Kak! 😊\n\nJika ada pertanyaan lain, jangan ragu untuk chat lagi ya! 💪`;
    }
  }

  /**
   * Analyze current conversation stage and progress
   */
  private analyzeConversationStage(context: ConversationContext): ConversationStage {
    const completedStages: ConversationState[] = [];
    let progress = 0;
    let nextExpected: ConversationState[] = [];

    // Determine completed stages based on context
    if (context.metadata?.mentionedProducts && context.metadata.mentionedProducts.length > 0) {
      completedStages.push(ConversationState.PRODUCT_RECOMMENDATION);
    }
    
    if (context.metadata?.userPreferences?.healthConditions && 
        context.metadata.userPreferences.healthConditions.length > 0) {
      completedStages.push(ConversationState.HEALTH_INQUIRY);
    }
    
    if (context.metadata?.dietProfile) {
      completedStages.push(ConversationState.DIET_CONSULTATION);
    }
    
    if (context.metadata?.currentOrder && context.metadata.currentOrder.items.length > 0) {
      completedStages.push(ConversationState.ORDER_COLLECTION);
    }

    // Calculate progress and next expected states
    switch (context.state) {
      case ConversationState.GREETING:
        progress = 10;
        nextExpected = [ConversationState.HEALTH_INQUIRY, ConversationState.PRODUCT_RECOMMENDATION];
        break;
      case ConversationState.HEALTH_INQUIRY:
        progress = 30;
        nextExpected = [ConversationState.PRODUCT_RECOMMENDATION, ConversationState.DIET_CONSULTATION];
        break;
      case ConversationState.PRODUCT_RECOMMENDATION:
        progress = 50;
        nextExpected = [ConversationState.DIET_CONSULTATION, ConversationState.ORDER_COLLECTION];
        break;
      case ConversationState.DIET_CONSULTATION:
        progress = 70;
        nextExpected = [ConversationState.ORDER_COLLECTION];
        break;
      case ConversationState.ORDER_COLLECTION:
        progress = 85;
        nextExpected = [ConversationState.ORDER_CONFIRMATION];
        break;
      case ConversationState.ORDER_CONFIRMATION:
        progress = 95;
        nextExpected = [ConversationState.CONVERSATION_COMPLETE];
        break;
      case ConversationState.CONVERSATION_COMPLETE:
        progress = 100;
        nextExpected = [];
        break;
      default:
        progress = 20;
        nextExpected = [ConversationState.PRODUCT_RECOMMENDATION];
    }

    return {
      current: context.state,
      progress,
      nextExpected,
      completedStages
    };
  }

  /**
   * Extract customer profile from conversation context
   */
  private extractCustomerProfile(context: ConversationContext): FlowContextSummary['customerProfile'] {
    const healthConcerns = context.metadata?.userPreferences?.healthConditions;
    const dietGoals = context.metadata?.dietProfile?.goals?.map(goal => goal.type);
    const mentionedProducts = context.metadata?.mentionedProducts;
    const eatingHabits = context.metadata?.dietProfile ? {
      mealsPerDay: context.metadata.dietProfile.preferences?.mealFrequency || 3,
      usualMeals: context.metadata.dietProfile.currentMedications || [],
      hasSnacks: context.metadata.dietProfile.preferences?.snackPreference || false,
      restrictions: context.metadata.dietProfile.dietaryRestrictions || []
    } : undefined;

    return {
      ...(healthConcerns ? { healthConcerns } : {}),
      ...(dietGoals ? { dietGoals } : {}),
      ...(eatingHabits ? { eatingHabits } : {}),
      ...(mentionedProducts ? { mentionedProducts } : {})
    };
  }

  /**
   * Analyze order progress
   */
  private analyzeOrderProgress(context: ConversationContext): FlowContextSummary['orderProgress'] | undefined {
    const order = context.metadata?.currentOrder;
    if (!order) return undefined;

    return {
      hasItems: order.items.length > 0,
      customerInfoComplete: !!(order.customerName && order.address && order.whatsappNumber),
      readyForConfirmation: order.isComplete
    };
  }

  /**
   * Generate short AI-readable conversation summary
   */
  private generateShortSummary(context: ConversationContext, stage: ConversationStage): string {
    const parts: string[] = [];
    
    // Stage info
    parts.push(`Stage: ${context.state} (${stage.progress}%)`);
    
    // Customer profile
    if (context.metadata?.userPreferences?.healthConditions?.length) {
      parts.push(`Health: ${context.metadata.userPreferences.healthConditions.join(', ')}`);
    }
    
    // Products mentioned
    if (context.metadata?.mentionedProducts?.length) {
      parts.push(`Products: ${context.metadata.mentionedProducts.join(', ')}`);
    }
    
    // Order status
    if (context.metadata?.currentOrder) {
      const order = context.metadata.currentOrder;
      if (order.items.length > 0) {
        parts.push(`Order: ${order.items.length} items`);
      }
      if (order.customerName) {
        parts.push(`Customer: ${order.customerName}`);
      }
    }
    
    // Diet consultation status
    if (context.metadata?.dietProfile) {
      parts.push(`Diet: consulting`);
    }
    
    return parts.join(' | ');
  }
}