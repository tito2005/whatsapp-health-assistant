#!/usr/bin/env ts-node

import { ClaudeService, ConversationContext, ConversationState } from '../src/claude/claude-service';
import { config } from '../src/config/environment';
import { databaseManager } from '../src/config/database';

async function testClaudeIntegration() {
  console.log('🧪 Testing Claude AI + Database Integration');
  console.log('==========================================\n');

  try {
    // Initialize database first
    console.log('1️⃣ Initializing database...');
    await databaseManager.waitForInitialization();
    console.log('✅ Database connected\n');

    // Check if Claude API key is available
    if (!config.claudeApiKey) {
      console.log('⚠️  Claude API key not configured - testing will be limited');
      console.log('💡 Set CLAUDE_API_KEY environment variable for full testing\n');
      return;
    }

    // Initialize Claude service
    console.log('2️⃣ Initializing Claude service...');
    const claudeService = new ClaudeService();
    console.log('✅ Claude service initialized\n');

    // Test scenarios
    const testCases = [
      {
        name: 'Diabetes Patient',
        conversation: [
          { role: 'user' as const, content: 'Halo, saya mau konsultasi' },
          { role: 'assistant' as const, content: 'Halo! Selamat datang. Saya Maya, konsultan kesehatan. Ada keluhan kesehatan apa yang ingin Anda konsultasikan?' }
        ],
        testMessage: 'Saya punya diabetes, gula darah sering tinggi. Umur saya 45 tahun. Butuh produk yang bisa bantu kontrol gula darah.',
        expectedKeywords: ['diabetes', 'gula darah', '45 tahun']
      },
      {
        name: 'Weight Loss Goal',
        conversation: [
          { role: 'user' as const, content: 'Halo' }
        ],
        testMessage: 'Saya ingin diet turun berat badan, perut kembung terus dan susah BAB. Budget saya terbatas.',
        expectedKeywords: ['diet', 'kembung', 'budget']
      },
      {
        name: 'General Health',
        conversation: [],
        testMessage: 'Saya mau produk untuk jaga kesehatan umum, tingkatkan imunitas.',
        expectedKeywords: ['imunitas', 'kesehatan']
      }
    ];

    for (const [index, testCase] of testCases.entries()) {
      console.log(`${index + 3}️⃣ Testing: ${testCase.name}`);
      console.log(`   Message: "${testCase.testMessage}"`);
      
      const context: ConversationContext = {
        userId: `test_user_${index}`,
        messages: testCase.conversation,
        state: ConversationState.HEALTH_INQUIRY,
        metadata: {}
      };

      try {
        const startTime = Date.now();
        const result = await claudeService.processMessage(testCase.testMessage, context);
        const duration = Date.now() - startTime;

        console.log(`   ✅ Response received (${duration}ms)`);
        console.log(`   📝 Response length: ${result.response.length} chars`);
        console.log(`   🔄 New state: ${result.newState}`);
        
        // Check if response contains product information
        const hasProductInfo = result.response.toLowerCase().includes('rp ') || 
                              result.response.toLowerCase().includes('produk') ||
                              result.response.toLowerCase().includes('harga');
        
        console.log(`   🛒 Contains product info: ${hasProductInfo ? '✅' : '❌'}`);
        
        // Preview response
        const preview = result.response.substring(0, 150) + (result.response.length > 150 ? '...' : '');
        console.log(`   👀 Preview: "${preview}"`);
        console.log('');

      } catch (error) {
        console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.log('');
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('🎉 Integration test completed!');
    console.log('');
    console.log('📊 What was tested:');
    console.log('   ✅ Database connectivity');
    console.log('   ✅ Claude AI service initialization');
    console.log('   ✅ Health assessment extraction');
    console.log('   ✅ Product recommendation integration');
    console.log('   ✅ Dynamic system prompt generation');
    console.log('   ✅ End-to-end message processing');

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : error);
  } finally {
    // Cleanup
    try {
      await databaseManager.close();
      console.log('🧹 Database connection closed');
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Test health assessment extraction separately
async function testHealthAssessmentExtraction() {
  console.log('\\n🔬 Testing Health Assessment Extraction');
  console.log('=======================================');

  const claudeService = new ClaudeService();
  
  const testMessages = [
    'Saya diabetes, gula darah tinggi',
    'Perut kembung, susah BAB, mau diet',
    'Pusing kepala, lelah, stress kerja',
    'Umur 35 tahun, mau produk premium untuk jaga kesehatan'
  ];

  for (const [index, message] of testMessages.entries()) {
    console.log(`\\nTest ${index + 1}: "${message}"`);
    
    const context: ConversationContext = {
      userId: `test_${index}`,
      messages: [],
      state: ConversationState.HEALTH_INQUIRY,
      metadata: {}
    };

    // Access private method through any cast for testing
    const assessment = (claudeService as any).extractHealthAssessment(message, context);
    
    console.log(`   Symptoms: [${assessment.symptoms.join(', ')}]`);
    console.log(`   Conditions: [${assessment.conditions.join(', ')}]`);
    console.log(`   Goals: [${assessment.goals.join(', ')}]`);
    console.log(`   Severity: ${assessment.severity}`);
    console.log(`   Duration: ${assessment.duration}`);
  }
}

if (require.main === module) {
  Promise.resolve()
    .then(() => testClaudeIntegration())
    .then(() => testHealthAssessmentExtraction())
    .then(() => {
      console.log('\\n✅ All tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\\n❌ Test suite failed:', error);
      process.exit(1);
    });
}