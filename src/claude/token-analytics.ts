import { logger } from '@/shared/logger';
import { TokenUsageBreakdown, PromptCacheMetrics } from '@/types/claude';
import { ConversationState } from './claude-service';

export interface TokenAnalytics {
  totalConversations: number;
  totalTokensUsed: number;
  totalCostUSD: number;
  averageTokensPerConversation: number;
  averageCostPerConversation: number;
  optimizationSavings: {
    tokensLiSaved: number;
    costSavedUSD: number;
    savingsPercentage: number;
  };
  stateBreakdown: Record<ConversationState, {
    count: number;
    avgTokens: number;
    avgCost: number;
  }>;
  dailyTrends: Array<{
    date: string;
    conversations: number;
    tokens: number;
    cost: number;
  }>;
}

export interface CostProjection {
  dailyEstimate: number;
  weeklyEstimate: number;
  monthlyEstimate: number;
  yearlyEstimate: number;
  withOptimization: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
}

export class TokenAnalyticsService {
  private static instance: TokenAnalyticsService;
  private analytics: TokenAnalytics;
  private conversationHistory: Array<{
    timestamp: Date;
    state: ConversationState;
    tokenBreakdown: TokenUsageBreakdown;
    costUSD: number;
  }> = [];

  // Claude 3.5 Sonnet pricing (per 1M tokens)
  private readonly PRICING = {
    INPUT: 3.0,
    OUTPUT: 15.0,
    CACHE_READ: 0.3,
    CACHE_WRITE: 3.75
  };

  private constructor() {
    this.analytics = this.initializeAnalytics();
  }

  public static getInstance(): TokenAnalyticsService {
    if (!TokenAnalyticsService.instance) {
      TokenAnalyticsService.instance = new TokenAnalyticsService();
    }
    return TokenAnalyticsService.instance;
  }

  /**
   * Record a conversation's token usage
   */
  public recordConversation(
    state: ConversationState,
    tokenBreakdown: TokenUsageBreakdown,
    cacheMetrics?: PromptCacheMetrics
  ): void {
    const cost = this.calculateConversationCost(tokenBreakdown);
    
    // Record individual conversation
    this.conversationHistory.push({
      timestamp: new Date(),
      state,
      tokenBreakdown,
      costUSD: cost
    });

    // Update aggregate analytics
    this.updateAnalytics(state, tokenBreakdown, cost, cacheMetrics);

    // Log every 10 conversations
    if (this.analytics.totalConversations % 10 === 0) {
      logger.info('Token analytics update', {
        totalConversations: this.analytics.totalConversations,
        averageTokensPerConversation: this.analytics.averageTokensPerConversation,
        totalCostUSD: this.analytics.totalCostUSD.toFixed(4),
        optimizationSavings: this.analytics.optimizationSavings
      });
    }

    // Cleanup old history (keep last 1000 conversations)
    if (this.conversationHistory.length > 1000) {
      this.conversationHistory = this.conversationHistory.slice(-1000);
    }
  }

  /**
   * Calculate cost for a single conversation
   */
  private calculateConversationCost(tokenBreakdown: TokenUsageBreakdown): number {
    let inputCost = 0;
    let outputCost = 0;

    if (tokenBreakdown.isCacheHit) {
      // Cache read pricing for static prompt
      const cacheReadTokens = tokenBreakdown.staticPromptTokens;
      const regularInputTokens = tokenBreakdown.totalInputTokens - cacheReadTokens;
      
      inputCost = (cacheReadTokens / 1_000_000) * this.PRICING.CACHE_READ +
                  (regularInputTokens / 1_000_000) * this.PRICING.INPUT;
    } else {
      // Regular pricing
      inputCost = (tokenBreakdown.totalInputTokens / 1_000_000) * this.PRICING.INPUT;
    }

    outputCost = (tokenBreakdown.outputTokens / 1_000_000) * this.PRICING.OUTPUT;

    return inputCost + outputCost;
  }

  /**
   * Update aggregate analytics
   */
  private updateAnalytics(
    state: ConversationState,
    tokenBreakdown: TokenUsageBreakdown,
    cost: number,
    cacheMetrics?: PromptCacheMetrics
  ): void {
    this.analytics.totalConversations++;
    this.analytics.totalTokensUsed += tokenBreakdown.totalInputTokens + tokenBreakdown.outputTokens;
    this.analytics.totalCostUSD += cost;
    
    this.analytics.averageTokensPerConversation = 
      this.analytics.totalTokensUsed / this.analytics.totalConversations;
    this.analytics.averageCostPerConversation = 
      this.analytics.totalCostUSD / this.analytics.totalConversations;

    // Update state breakdown
    if (!this.analytics.stateBreakdown[state]) {
      this.analytics.stateBreakdown[state] = { count: 0, avgTokens: 0, avgCost: 0 };
    }

    const stateData = this.analytics.stateBreakdown[state];
    const totalTokens = tokenBreakdown.totalInputTokens + tokenBreakdown.outputTokens;
    
    stateData.count++;
    stateData.avgTokens = ((stateData.avgTokens * (stateData.count - 1)) + totalTokens) / stateData.count;
    stateData.avgCost = ((stateData.avgCost * (stateData.count - 1)) + cost) / stateData.count;

    // Update optimization savings
    if (cacheMetrics) {
      this.analytics.optimizationSavings.tokensLiSaved = cacheMetrics.totalTokensSaved;
      this.analytics.optimizationSavings.costSavedUSD = cacheMetrics.costSavings;
      
      const totalPotentialCost = this.analytics.totalCostUSD + cacheMetrics.costSavings;
      this.analytics.optimizationSavings.savingsPercentage = 
        totalPotentialCost > 0 ? (cacheMetrics.costSavings / totalPotentialCost) * 100 : 0;
    }

    // Update daily trends
    this.updateDailyTrends(totalTokens, cost);
  }

  /**
   * Update daily trends data
   */
  private updateDailyTrends(tokens: number, cost: number): void {
    const today = new Date().toISOString().split('T')[0] || '';
    let todayEntry = this.analytics.dailyTrends.find(entry => entry.date === today);

    if (!todayEntry) {
      todayEntry = { date: today, conversations: 0, tokens: 0, cost: 0 };
      this.analytics.dailyTrends.push(todayEntry);
    }

    todayEntry!.conversations++;
    todayEntry!.tokens += tokens;
    todayEntry!.cost += cost;

    // Keep only last 30 days
    if (this.analytics.dailyTrends.length > 30) {
      this.analytics.dailyTrends = this.analytics.dailyTrends.slice(-30);
    }
  }

  /**
   * Get current analytics
   */
  public getAnalytics(): TokenAnalytics {
    return { ...this.analytics };
  }

  /**
   * Get cost projections based on current usage
   */
  public getCostProjections(): CostProjection {
    // Calculate daily average from recent data
    const recentDays = this.analytics.dailyTrends.slice(-7); // Last 7 days
    const avgDailyCost = recentDays.length > 0 
      ? recentDays.reduce((sum, day) => sum + day.cost, 0) / recentDays.length
      : this.analytics.averageCostPerConversation * 20; // Fallback: 20 conversations per day

    // Base projections
    const daily = avgDailyCost;
    const weekly = daily * 7;
    const monthly = daily * 30;
    const yearly = daily * 365;

    // Optimized projections (current savings rate)
    const savingsRate = this.analytics.optimizationSavings.savingsPercentage / 100;
    const optimizationMultiplier = 1 - savingsRate;

    return {
      dailyEstimate: daily,
      weeklyEstimate: weekly,
      monthlyEstimate: monthly,
      yearlyEstimate: yearly,
      withOptimization: {
        daily: daily * optimizationMultiplier,
        weekly: weekly * optimizationMultiplier,
        monthly: monthly * optimizationMultiplier,
        yearly: yearly * optimizationMultiplier
      }
    };
  }

  /**
   * Get token efficiency metrics
   */
  public getEfficiencyMetrics(): {
    tokensPerDollar: number;
    conversationsPerDollar: number;
    costPerMessage: number;
    optimizationImpact: {
      tokenSavingsRate: number;
      costSavingsRate: number;
      effectivenessByState: Record<ConversationState, number>;
    };
  } {
    const tokensPerDollar = this.analytics.totalCostUSD > 0 
      ? this.analytics.totalTokensUsed / this.analytics.totalCostUSD
      : 0;
    
    const conversationsPerDollar = this.analytics.totalCostUSD > 0
      ? this.analytics.totalConversations / this.analytics.totalCostUSD
      : 0;

    const costPerMessage = this.analytics.totalConversations > 0
      ? this.analytics.totalCostUSD / this.analytics.totalConversations
      : 0;

    // Calculate effectiveness by state
    const effectivenessByState: Record<ConversationState, number> = {} as any;
    for (const [state, data] of Object.entries(this.analytics.stateBreakdown)) {
      // Effectiveness = conversations per dollar for this state
      effectivenessByState[state as ConversationState] = data.avgCost > 0 ? 1 / data.avgCost : 0;
    }

    return {
      tokensPerDollar,
      conversationsPerDollar,
      costPerMessage,
      optimizationImpact: {
        tokenSavingsRate: this.analytics.optimizationSavings.savingsPercentage,
        costSavingsRate: this.analytics.optimizationSavings.savingsPercentage,
        effectivenessByState
      }
    };
  }

  /**
   * Get conversation patterns analysis
   */
  public getConversationPatterns(): {
    mostCostlyStates: Array<{ state: ConversationState; avgCost: number }>;
    mostEfficientStates: Array<{ state: ConversationState; costPerToken: number }>;
    usageByHour: Record<number, { conversations: number; tokens: number; cost: number }>;
    trendsAnalysis: {
      costTrend: 'increasing' | 'decreasing' | 'stable';
      tokenEfficiencyTrend: 'improving' | 'declining' | 'stable';
    };
  } {
    // Most costly states
    const mostCostlyStates = Object.entries(this.analytics.stateBreakdown)
      .map(([state, data]) => ({ state: state as ConversationState, avgCost: data.avgCost }))
      .sort((a, b) => b.avgCost - a.avgCost)
      .slice(0, 3);

    // Most efficient states (lowest cost per token)
    const mostEfficientStates = Object.entries(this.analytics.stateBreakdown)
      .map(([state, data]) => ({ 
        state: state as ConversationState, 
        costPerToken: data.avgTokens > 0 ? data.avgCost / data.avgTokens : 0 
      }))
      .filter(item => item.costPerToken > 0)
      .sort((a, b) => a.costPerToken - b.costPerToken)
      .slice(0, 3);

    // Usage by hour
    const usageByHour: Record<number, { conversations: number; tokens: number; cost: number }> = {};
    this.conversationHistory.forEach(conv => {
      const hour = conv.timestamp.getHours();
      if (!usageByHour[hour]) {
        usageByHour[hour] = { conversations: 0, tokens: 0, cost: 0 };
      }
      usageByHour[hour].conversations++;
      usageByHour[hour].tokens += conv.tokenBreakdown.totalInputTokens + conv.tokenBreakdown.outputTokens;
      usageByHour[hour].cost += conv.costUSD;
    });

    // Trends analysis
    const recentTrends = this.analytics.dailyTrends.slice(-7);
    const costTrend = this.analyzeTrend(recentTrends.map(day => day.cost));
    const tokenEfficiencyTrend = this.mapTrendToEfficiency(this.analyzeTrend(
      recentTrends.map(day => day.conversations > 0 ? day.conversations / day.cost : 0)
    ));

    return {
      mostCostlyStates,
      mostEfficientStates,
      usageByHour,
      trendsAnalysis: {
        costTrend,
        tokenEfficiencyTrend
      }
    };
  }

  /**
   * Analyze trend direction
   */
  private analyzeTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 3) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const changePercent = Math.abs((secondAvg - firstAvg) / firstAvg) * 100;

    if (changePercent < 5) return 'stable';
    return secondAvg > firstAvg ? 'increasing' : 'decreasing';
  }

  /**
   * Map cost trend to efficiency trend
   */
  private mapTrendToEfficiency(trend: 'increasing' | 'decreasing' | 'stable'): 'improving' | 'declining' | 'stable' {
    switch (trend) {
      case 'increasing': return 'improving';
      case 'decreasing': return 'declining';
      case 'stable': return 'stable';
    }
  }

  /**
   * Export analytics data for external analysis
   */
  public exportData(): {
    summary: TokenAnalytics;
    rawConversations: Array<{
      timestamp: Date;
      state: ConversationState;
      tokenBreakdown: TokenUsageBreakdown;
      costUSD: number;
    }>;
    exportTimestamp: string;
  } {
    return {
      summary: this.analytics,
      rawConversations: this.conversationHistory,
      exportTimestamp: new Date().toISOString()
    };
  }

  /**
   * Reset analytics data
   */
  public reset(): void {
    this.analytics = this.initializeAnalytics();
    this.conversationHistory = [];
    logger.info('Token analytics reset');
  }

  /**
   * Initialize empty analytics structure
   */
  private initializeAnalytics(): TokenAnalytics {
    return {
      totalConversations: 0,
      totalTokensUsed: 0,
      totalCostUSD: 0,
      averageTokensPerConversation: 0,
      averageCostPerConversation: 0,
      optimizationSavings: {
        tokensLiSaved: 0,
        costSavedUSD: 0,
        savingsPercentage: 0
      },
      stateBreakdown: {} as Record<ConversationState, {
        count: number;
        avgTokens: number;
        avgCost: number;
      }>,
      dailyTrends: []
    };
  }
}