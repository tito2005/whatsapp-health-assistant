import { Product } from '@/types/product';
import { ProductService, HealthAssessment } from '@/products/product-service';
import { logger } from '@/shared/logger';

export interface DietGoal {
  type: 'weight_loss' | 'diabetes_control' | 'cholesterol_management' | 'gerd_relief' | 'general_wellness' | 'muscle_building';
  targetValue?: number;
  timeframe?: number;
  priority: 'high' | 'medium' | 'low';
}

export interface DietProfile {
  userId: string;
  age?: number | undefined;
  weight?: number | undefined;
  height?: number | undefined;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  medicalConditions: string[];
  currentMedications: string[];
  allergies: string[];
  dietaryRestrictions: string[];
  goals: DietGoal[];
  preferences: {
    mealFrequency: number;
    snackPreference: boolean;
    cookingTime: 'minimal' | 'moderate' | 'extensive';
    budgetLevel: 'low' | 'medium' | 'high';
  };
}

export interface PersonalizedRecommendation {
  product: Product;
  personalizedDosage: {
    frequency: string;
    timing: string[];
    instructions: string;
    duration: string;
  };
  expectedResults: {
    shortTerm: string;
    mediumTerm: string;
    longTerm: string;
  };
  monitoringPlan: {
    metrics: string[];
    frequency: string;
    milestones: { week: number; target: string }[];
  };
  dietarySupport: {
    foodsToEmphasize: string[];
    foodsToLimit: string[];
    mealTiming: string[];
    hydrationGoals: string;
  };
  lifestyle: {
    exerciseRecommendations: string[];
    sleepGuidance: string;
    stressManagement: string[];
  };
  safetyConsiderations: {
    contraindications: string[];
    medicationInteractions: string[];
    warningSignsToWatch: string[];
  };
}

export class DietPlanningService {
  private productService: ProductService;

  constructor() {
    this.productService = new ProductService();
  }

  public async createPersonalizedPlan(
    profile: DietProfile,
    healthAssessment: HealthAssessment
  ): Promise<{
    recommendations: PersonalizedRecommendation[];
    weeklyPlans: any[];
    overallStrategy: string;
  }> {
    try {
      logger.info('Creating personalized diet plan', { 
        userId: profile.userId,
        conditions: healthAssessment.conditions,
        goals: healthAssessment.goals
      });

      // Get product recommendations based on health assessment
      const productRecommendations = await this.productService.getProductRecommendations(
        healthAssessment,
        { 
          budget: profile.preferences.budgetLevel,
          allergies: profile.allergies
        }
      );

      // Create personalized recommendations for top 3 products
      const personalizedRecommendations: PersonalizedRecommendation[] = [];
      
      for (const rec of productRecommendations.slice(0, 3)) {
        const personalizedRec = await this.createPersonalizedRecommendation(
          rec.product, 
          profile, 
          healthAssessment
        );
        personalizedRecommendations.push(personalizedRec);
      }

      // Generate overall strategy
      const overallStrategy = this.generateOverallStrategy(profile, healthAssessment);

      logger.info('Personalized diet plan created successfully', {
        userId: profile.userId,
        recommendationsCount: personalizedRecommendations.length,
        primaryGoal: profile.goals[0]?.type
      });

      return {
        recommendations: personalizedRecommendations,
        weeklyPlans: [], // Simplified for now
        overallStrategy
      };

    } catch (error) {
      logger.error('Failed to create personalized diet plan', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: profile.userId
      });
      throw error;
    }
  }

  private async createPersonalizedRecommendation(
    product: Product,
    profile: DietProfile,
    _healthAssessment: HealthAssessment
  ): Promise<PersonalizedRecommendation> {
    const metadata = product.metadata as any;
    const usageGuidance = metadata?.usageGuidance;
    
    // Determine primary goal for this product
    const primaryGoal = this.identifyPrimaryGoal(product, profile.goals);
    
    // Get condition-specific guidance
    const conditionGuidance = this.getConditionSpecificGuidance(
      product, 
      profile.medicalConditions,
      usageGuidance
    );

    // Personalize dosage based on profile
    const personalizedDosage = this.personalizeProductDosage(
      product,
      profile,
      primaryGoal,
      conditionGuidance
    );

    return {
      product,
      personalizedDosage,
      expectedResults: {
        shortTerm: conditionGuidance?.expectedResults || 'Initial adaptation and digestive comfort',
        mediumTerm: this.generateMediumTermResults(primaryGoal),
        longTerm: this.generateLongTermResults(primaryGoal)
      },
      monitoringPlan: this.createMonitoringPlan(primaryGoal, profile),
      dietarySupport: this.generateDietarySupport(product, primaryGoal, profile),
      lifestyle: this.generateLifestyleRecommendations(primaryGoal, profile),
      safetyConsiderations: this.generateSafetyConsiderations(product, profile.medicalConditions, profile.currentMedications)
    };
  }

  private identifyPrimaryGoal(product: Product, goals: DietGoal[]): DietGoal {
    const productCategory = product.category;
    const productConditions = (product.metadata as any)?.healthConditions || [];

    for (const goal of goals) {
      if (goal.type === 'diabetes_control' && productCategory === 'diabetes_support') {
        return goal;
      }
      if (goal.type === 'weight_loss' && productCategory === 'weight_management') {
        return goal;
      }
      if (goal.type === 'cholesterol_management' && productConditions.includes('kolesterol tinggi')) {
        return goal;
      }
      if (goal.type === 'gerd_relief' && productConditions.includes('GERD')) {
        return goal;
      }
    }

    return goals[0] || { type: 'general_wellness', priority: 'medium' };
  }

  private getConditionSpecificGuidance(
    _product: Product,
    conditions: string[],
    usageGuidance: any
  ): any {
    if (!usageGuidance?.specificConditions) return null;

    const conditionMap: Record<string, string> = {
      'diabetes': 'diabetes',
      'gula darah tinggi': 'diabetes',
      'kolesterol tinggi': 'cholesterol',
      'GERD': 'gerd',
      'maag': 'gerd',
      'obesitas': 'weightLoss',
      'berat badan berlebih': 'weightLoss'
    };

    for (const condition of conditions) {
      const guidanceKey = conditionMap[condition.toLowerCase()];
      if (guidanceKey && usageGuidance.specificConditions[guidanceKey]) {
        return usageGuidance.specificConditions[guidanceKey];
      }
    }

    return null;
  }

  private personalizeProductDosage(
    product: Product,
    _profile: DietProfile,
    goal: DietGoal,
    conditionGuidance: any
  ): PersonalizedRecommendation['personalizedDosage'] {
    if (conditionGuidance) {
      return {
        frequency: conditionGuidance.dosage,
        timing: [conditionGuidance.timing],
        instructions: conditionGuidance.instructions,
        duration: '8 weeks'
      };
    }

    const metadata = product.metadata as any;
    const basicUsage = metadata?.usageGuidance?.basicUsage;
    
    if (goal.priority === 'high' && basicUsage?.therapeutic) {
      return {
        frequency: basicUsage.therapeutic.frequency,
        timing: [basicUsage.therapeutic.timing],
        instructions: metadata?.usageGuidance?.preparation?.mixingInstructions || product.dosage,
        duration: basicUsage.therapeutic.duration
      };
    }

    return {
      frequency: basicUsage?.maintenance?.frequency || '1x daily',
      timing: [basicUsage?.maintenance?.timing || 'Morning'],
      instructions: product.dosage,
      duration: 'Ongoing'
    };
  }

  private createMonitoringPlan(goal: DietGoal, _profile: DietProfile): PersonalizedRecommendation['monitoringPlan'] {
    const baseMetrics = ['energy level', 'overall wellbeing', 'side effects'];
    
    switch (goal.type) {
      case 'weight_loss':
        return {
          metrics: [...baseMetrics, 'weight', 'body measurements', 'appetite levels'],
          frequency: 'Weekly weigh-ins, daily symptoms tracking',
          milestones: [
            { week: 2, target: 'Appetite control and initial water weight loss' },
            { week: 4, target: '2-3kg weight reduction' },
            { week: 8, target: '5-7kg weight reduction' }
          ]
        };
      
      case 'diabetes_control':
        return {
          metrics: [...baseMetrics, 'fasting blood glucose', 'post-meal glucose'],
          frequency: 'Daily glucose monitoring, weekly averages',
          milestones: [
            { week: 2, target: 'More stable daily glucose readings' },
            { week: 4, target: 'Fasting glucose consistently under 130 mg/dL' },
            { week: 8, target: 'Post-meal spikes reduced by 30%' }
          ]
        };
      
      default:
        return {
          metrics: baseMetrics,
          frequency: 'Weekly check-ins',
          milestones: [
            { week: 4, target: 'Improved energy and digestive comfort' },
            { week: 8, target: 'Sustained health improvements' }
          ]
        };
    }
  }

  private generateDietarySupport(
    _product: Product,
    goal: DietGoal,
    _profile: DietProfile
  ): PersonalizedRecommendation['dietarySupport'] {
    const baseHydration = '8-10 glasses water daily, extra 2 glasses after product consumption';
    
    switch (goal.type) {
      case 'weight_loss':
        return {
          foodsToEmphasize: ['Lean proteins', 'Non-starchy vegetables', 'Complex carbs'],
          foodsToLimit: ['Processed foods', 'Sugary drinks', 'Fried foods'],
          mealTiming: ['Product 30 min before meals', 'Space meals 4-5 hours apart'],
          hydrationGoals: baseHydration + ', green tea between meals'
        };
      
      case 'diabetes_control':
        return {
          foodsToEmphasize: ['High-fiber vegetables', 'Lean proteins', 'Low glycemic carbs'],
          foodsToLimit: ['Simple sugars', 'High glycemic foods', 'Large portions'],
          mealTiming: ['Product 30 min before meals', 'Small frequent meals'],
          hydrationGoals: baseHydration + ', avoid sugary drinks'
        };
      
      default:
        return {
          foodsToEmphasize: ['Whole foods', 'Variety of fruits and vegetables'],
          foodsToLimit: ['Processed foods', 'Excessive sugar'],
          mealTiming: ['Regular meal schedule', 'Mindful eating'],
          hydrationGoals: baseHydration
        };
    }
  }

  private generateLifestyleRecommendations(
    goal: DietGoal,
    _profile: DietProfile
  ): PersonalizedRecommendation['lifestyle'] {
    const baseExercise = ['Regular physical activity', '30 minutes daily movement'];
    
    return {
      exerciseRecommendations: [
        ...baseExercise,
        goal.type === 'weight_loss' ? '150 minutes moderate cardio weekly' : 'Light to moderate exercise'
      ],
      sleepGuidance: '7-9 hours quality sleep for overall health',
      stressManagement: ['Regular stress relief activities', 'Work-life balance']
    };
  }

  private generateSafetyConsiderations(
    product: Product,
    _conditions: string[],
    _medications: string[]
  ): PersonalizedRecommendation['safetyConsiderations'] {
    const metadata = product.metadata as any;
    const basicWarnings = product.warnings || [];
    const dietaryConsiderations = metadata?.usageGuidance?.dietaryConsiderations;

    return {
      contraindications: [
        ...basicWarnings,
        'Do not exceed recommended dosage'
      ],
      medicationInteractions: [
        dietaryConsiderations?.interactions || 'Take 2 hours apart from medications',
        'Consult doctor before starting if on prescription drugs'
      ],
      warningSignsToWatch: [
        'Unusual digestive upset lasting more than 3 days',
        'Allergic reactions',
        'Unexpected side effects'
      ]
    };
  }

  private generateMediumTermResults(goal: DietGoal): string {
    switch (goal.type) {
      case 'weight_loss':
        return '4-6kg weight reduction, improved body composition, increased energy';
      case 'diabetes_control':
        return 'Stabilized blood glucose patterns, reduced post-meal spikes';
      case 'cholesterol_management':
        return '20-25% LDL cholesterol reduction, improved lipid profile';
      case 'gerd_relief':
        return 'Significant reduction in heartburn episodes';
      default:
        return 'Sustained energy improvement, better digestive health';
    }
  }

  private generateLongTermResults(goal: DietGoal): string {
    switch (goal.type) {
      case 'weight_loss':
        return 'Achieved target weight, sustainable healthy habits';
      case 'diabetes_control':
        return 'Optimal glucose control, reduced complications risk';
      case 'cholesterol_management':
        return 'Maintained healthy cholesterol levels';
      case 'gerd_relief':
        return 'Long-term symptom management, improved quality of life';
      default:
        return 'Established healthy lifestyle, sustained wellness improvements';
    }
  }

  private generateOverallStrategy(profile: DietProfile, _assessment: HealthAssessment): string {
    const primaryGoal = profile.goals[0]?.type || 'general_wellness';
    const timeframe = profile.goals[0]?.timeframe || 12;
    
    return `Comprehensive ${timeframe}-week personalized health plan focusing on ${primaryGoal.replace('_', ' ')}.

PHASE 1 (Weeks 1-2): Adaptation
- Product introduction and digestive adaptation
- Baseline establishment and routine building

PHASE 2 (Weeks 3-6): Establishment  
- Active health improvement and goal progression
- Habit formation and lifestyle integration

PHASE 3 (Weeks 7-12): Optimization & Maintenance
- Accelerated progress toward goals
- Long-term sustainability planning

KEY SUCCESS FACTORS:
- Consistent product usage as recommended
- Regular monitoring and progress tracking
- Lifestyle modifications supporting goals
- Professional healthcare coordination when needed`;
  }
}

export const dietPlanningService = new DietPlanningService();