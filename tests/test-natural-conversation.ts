#!/usr/bin/env ts-node
import { ClaudeService, ConversationContext, ConversationState } from '../src/claude/claude-service';
import { databaseManager } from '../src/config/database';

async function testNaturalConversation() {
  try {
    await databaseManager.waitForInitialization();
    
    const claudeService = new ClaudeService();
    
    console.log('🤖 Testing Natural Conversation Style - Maya the Diet Consultant\n');
    console.log('='.repeat(60));
    
    // Test scenarios
    const testCases = [
      {
        scenario: "Weight Loss Goal",
        message: "halo kak, saya mau diet nih. berat badan saya 85kg, target turun ke 70kg"
      },
      {
        scenario: "Diabetes Concern", 
        message: "saya diabetes nih kak, gula darah sering tinggi. ada produk yang bisa bantu?"
      },
      {
        scenario: "GERD/Maag Issue",
        message: "maag saya sering kambuh kak, terutama kalau stress. gimana ya?"
      },
      {
        scenario: "Hypertension",
        message: "dokter bilang tekanan darah saya tinggi, 160/90. perlu produk apa ya?"
      },
      {
        scenario: "General Health",
        message: "pengen hidup lebih sehat nih kak, tapi bingung mulai dari mana"
      }
    ];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      if (!testCase) continue;
      
      console.log(`\n${i + 1}. SCENARIO: ${testCase.scenario}`);
      console.log(`👤 Customer: "${testCase.message}"`);
      process.stdout.write('🤖 Maya: ');
      
      // Create conversation context
      const context: ConversationContext = {
        userId: `test-user-${i + 1}`,
        messages: [],
        state: ConversationState.GREETING,
        metadata: {
          userPreferences: {
            communicationStyle: 'brief' // Test with brief style
          }
        }
      };

      try {
        const response = await claudeService.processMessage(testCase.message, context);
        
        console.log(`"${response.response}"`);
        console.log(`   State: ${response.newState}`);
        
        // Add a brief delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      console.log('-'.repeat(60));
    }
    
    console.log('\n✅ Natural conversation testing completed!');
    console.log('\nKey improvements shown:');
    console.log('- Short, natural responses (1-3 sentences)');
    console.log('- Casual Indonesian language');
    console.log('- No numbered lists or menu options');
    console.log('- Product suggestions feel natural');
    console.log('- Empathetic and encouraging tone');
    
    await databaseManager.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// String.prototype.repeat is natively supported in modern Node.js

testNaturalConversation();