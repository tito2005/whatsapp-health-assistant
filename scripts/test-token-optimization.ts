#!/usr/bin/env ts-node
import { databaseManager } from '../src/config/database';
import { ClaudeService } from '../src/claude/claude-service';
import { ConversationManager } from '../src/claude/conversation-manager';

async function testTokenOptimization() {
  try {
    console.log('🧪 Testing Token Optimization Implementation\n');

    // Initialize services
    await databaseManager.waitForInitialization();
    
    const claudeService = new ClaudeService();
    const conversationManager = new ConversationManager();
    await conversationManager.initialize();

    console.log('✅ Services initialized successfully\n');

    // Test user conversation
    const testUserId = 'test-user-optimization';
    
    // Clear any existing conversation
    await conversationManager.clearConversation(testUserId);
    
    console.log('📊 Testing Token Optimization with Sample Conversations\n');
    
    // Test conversation flow
    const testMessages = [
      'Halo kak, mau tanya tentang hotto purto',
      'Untuk diabetes bagus ga?',
      'Berapa harganya kak?',
      'Mau pesan 2 pouch',
      'Nama saya Budi, alamat Jl. Sudirman No 123 Batam'
    ];

    let totalMessages = 0;

    for (const [index, message] of testMessages.entries()) {
      console.log(`\n🔄 Processing message ${index + 1}: "${message}"`);
      
      // Get conversation context
      let context = await conversationManager.getConversation(testUserId);
      
      try {
        // Process with Claude
        const result = await claudeService.processMessage(message, context);
        
        // Update conversation
        context = await conversationManager.addMessage(testUserId, 'user', message);
        context = await conversationManager.addMessage(testUserId, 'assistant', result.response);
        await conversationManager.updateState(testUserId, result.newState);
        
        totalMessages++;
        console.log(`   📤 Response: ${result.response.substring(0, 100)}...`);
        console.log(`   🔄 State: ${result.newState}`);
        
      } catch (error) {
        console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Get optimization metrics
    console.log('\n📈 Optimization Metrics:');
    const metrics = claudeService.getOptimizationMetrics();
    
    console.log('\n🎯 Cache Performance:');
    console.log(`   Cache Hits: ${metrics.cacheMetrics.cacheHits}`);
    console.log(`   Cache Misses: ${metrics.cacheMetrics.cacheMisses}`);
    console.log(`   Hit Rate: ${(metrics.cacheMetrics.cacheHitRate * 100).toFixed(1)}%`);
    console.log(`   Tokens Saved: ${metrics.cacheMetrics.totalTokensSaved.toLocaleString()}`);
    console.log(`   Cost Savings: $${metrics.cacheMetrics.costSavings.toFixed(4)}`);

    console.log('\n💰 Cost Analysis:');
    console.log(`   Total Conversations: ${metrics.analytics.totalConversations}`);
    console.log(`   Average Tokens/Conversation: ${Math.round(metrics.analytics.averageTokensPerConversation)}`);
    console.log(`   Average Cost/Conversation: $${metrics.analytics.averageCostPerConversation.toFixed(4)}`);

    console.log('\n📊 Cost Projections:');
    console.log(`   Daily: $${metrics.costProjections.dailyEstimate.toFixed(2)} (optimized: $${metrics.costProjections.withOptimization.daily.toFixed(2)})`);
    console.log(`   Monthly: $${metrics.costProjections.monthlyEstimate.toFixed(2)} (optimized: $${metrics.costProjections.withOptimization.monthly.toFixed(2)})`);

    console.log('\n🔧 Optimization Status:');
    console.log(`   Prompt Caching: ${metrics.optimizationStatus.promptCachingEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Conversation Compression: ${metrics.optimizationStatus.conversationCompressionEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`   Compression Level: ${metrics.optimizationStatus.compressionLevel}`);

    // Test conversation patterns
    const patterns = claudeService.getConversationPatterns();
    
    console.log('\n📋 Conversation Patterns:');
    if (patterns.mostCostlyStates?.length > 0) {
      console.log('   Most Costly States:');
      patterns.mostCostlyStates.forEach((state: any, i: number) => {
        console.log(`     ${i + 1}. ${state.state}: $${state.avgCost.toFixed(4)}/conversation`);
      });
    }

    if (patterns.mostEfficientStates?.length > 0) {
      console.log('   Most Efficient States:');
      patterns.mostEfficientStates.forEach((state: any, i: number) => {
        console.log(`     ${i + 1}. ${state.state}: $${state.costPerToken.toFixed(6)}/token`);
      });
    }

    console.log('\n✅ Token Optimization Test Completed Successfully!');
    
    // Calculate savings
    const savingsPercentage = metrics.analytics.optimizationSavings.savingsPercentage;
    console.log(`\n🎉 Estimated Savings: ${savingsPercentage.toFixed(1)}%`);
    
    if (savingsPercentage >= 60) {
      console.log('🎯 TARGET ACHIEVED: 60%+ cost reduction reached!');
    } else if (savingsPercentage >= 40) {
      console.log('⚡ GOOD PROGRESS: 40%+ cost reduction achieved');
    } else {
      console.log('📈 OPTIMIZATION ACTIVE: Savings will improve with more conversations');
    }

    // Cleanup
    await conversationManager.clearConversation(testUserId);
    await conversationManager.disconnect();
    await databaseManager.close();

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testTokenOptimization().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});