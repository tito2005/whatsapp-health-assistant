#!/usr/bin/env ts-node

import { databaseManager } from '@/config/database';
import { productService } from '@/products/product-service';
import { logger } from '@/shared/logger';

interface TestCase {
  name: string;
  description: string;
  input: {
    symptoms: string[];
    conditions: string[];
    severity: 'mild' | 'moderate' | 'severe';
    duration: 'acute' | 'chronic';
    goals: string[];
  };
  context?: {
    customerAge?: number;
    budget?: 'low' | 'medium' | 'high';
    allergies?: string[];
  };
  expectedCategories?: string[];
  minimumRecommendations?: number;
}

const testCases: TestCase[] = [
  {
    name: 'Diabetes Management',
    description: 'Customer with diabetes seeking blood sugar control',
    input: {
      symptoms: ['gula darah tinggi', 'sering haus', 'mudah lelah'],
      conditions: ['diabetes', 'gula darah tidak stabil'],
      severity: 'moderate',
      duration: 'chronic',
      goals: ['kontrol gula darah', 'hidup sehat']
    },
    expectedCategories: ['diabetes_support'],
    minimumRecommendations: 2
  },

  {
    name: 'Digestive Issues',
    description: 'Customer with stomach problems and digestive issues',
    input: {
      symptoms: ['perut perih', 'kembung', 'susah BAB'],
      conditions: ['maag', 'asam lambung'],
      severity: 'mild',
      duration: 'acute',
      goals: ['pencernaan sehat', 'nyaman makan']
    },
    expectedCategories: ['digestive_health', 'general_wellness'],
    minimumRecommendations: 1
  },

  {
    name: 'Weight Management',
    description: 'Customer wanting to lose weight and manage obesity',
    input: {
      symptoms: ['berat badan naik', 'mudah lapar', 'metabolisme lambat'],
      conditions: ['obesitas', 'berat badan berlebih'],
      severity: 'moderate',
      duration: 'chronic',
      goals: ['turun berat badan', 'diet sehat', 'hidup aktif']
    },
    context: {
      customerAge: 35,
      budget: 'medium'
    },
    expectedCategories: ['weight_management'],
    minimumRecommendations: 1
  },

  {
    name: 'Cardiovascular Health',
    description: 'Customer with high blood pressure and heart concerns',
    input: {
      symptoms: ['tekanan darah tinggi', 'pusing', 'jantung berdebar'],
      conditions: ['hipertensi', 'darah tinggi'],
      severity: 'severe',
      duration: 'chronic',
      goals: ['tekanan darah normal', 'jantung sehat']
    },
    context: {
      customerAge: 55,
      budget: 'high'
    },
    expectedCategories: ['cardiovascular'],
    minimumRecommendations: 1
  },

  {
    name: 'General Wellness',
    description: 'Health-conscious customer seeking overall wellness',
    input: {
      symptoms: ['mudah lelah', 'imun lemah'],
      conditions: ['stamina kurang'],
      severity: 'mild',
      duration: 'acute',
      goals: ['sehat optimal', 'energi lebih', 'imun kuat']
    },
    context: {
      customerAge: 28,
      budget: 'low'
    },
    expectedCategories: ['general_wellness'],
    minimumRecommendations: 1
  },

  {
    name: 'Senior Citizen Health',
    description: 'Elderly customer with multiple health concerns',
    input: {
      symptoms: ['kolesterol tinggi', 'gula darah naik', 'susah BAB'],
      conditions: ['kolesterol', 'pre-diabetes', 'pencernaan lambat'],
      severity: 'moderate',
      duration: 'chronic',
      goals: ['sehat di usia lanjut', 'aktif terus']
    },
    context: {
      customerAge: 68,
      budget: 'medium'
    },
    minimumRecommendations: 2
  },

  {
    name: 'Active Lifestyle',
    description: 'Fitness enthusiast needing protein and energy support',
    input: {
      symptoms: ['pemulihan lambat', 'otot lemah'],
      conditions: ['kekurangan protein'],
      severity: 'mild',
      duration: 'acute',
      goals: ['stamina lebih', 'otot kuat', 'recovery cepat']
    },
    context: {
      customerAge: 25,
      budget: 'medium'
    },
    expectedCategories: ['general_wellness'],
    minimumRecommendations: 1
  }
];

async function runRecommendationTests(): Promise<void> {
  try {
    console.log('\n🧪 PRODUCT RECOMMENDATION ENGINE TESTING');
    console.log('=========================================');
    
    // Initialize database
    await databaseManager.waitForInitialization();
    
    if (!databaseManager.isConnected()) {
      throw new Error('Database not connected');
    }

    // Get initial statistics
    const stats = await productService.getProductStatistics();
    console.log(`📊 Testing with ${stats.totalProducts} products across ${Object.keys(stats.productsByCategory).length} categories\n`);

    let passedTests = 0;
    let failedTests = 0;
    const results: Array<{ testCase: string; success: boolean; details: any }> = [];

    // Run each test case
    for (const [index, testCase] of testCases.entries()) {
      console.log(`🔬 Test ${index + 1}/${testCases.length}: ${testCase.name}`);
      console.log(`   ${testCase.description}`);
      
      try {
        const startTime = Date.now();
        
        // Get recommendations
        const recommendations = await productService.getProductRecommendations(
          testCase.input,
          testCase.context
        );
        
        const duration = Date.now() - startTime;
        
        // Analyze results
        const analysis = analyzeRecommendations(testCase, recommendations);
        
        if (analysis.success) {
          passedTests++;
          console.log(`   ✅ PASSED (${duration}ms)`);
        } else {
          failedTests++;
          console.log(`   ❌ FAILED (${duration}ms)`);
          console.log(`   Reason: ${analysis.reason}`);
        }
        
        // Display top recommendations
        if (recommendations.length > 0) {
          console.log(`   📦 Top recommendations:`);
          recommendations.slice(0, 2).forEach((rec, i) => {
            console.log(`      ${i + 1}. ${rec.product.name} (Score: ${rec.relevanceScore.toFixed(2)})`);
            console.log(`         ${rec.reason}`);
          });
        } else {
          console.log(`   📦 No recommendations generated`);
        }
        
        results.push({
          testCase: testCase.name,
          success: analysis.success,
          details: {
            recommendations: recommendations.length,
            topScore: recommendations[0]?.relevanceScore || 0,
            categories: [...new Set(recommendations.map(r => r.product.category))],
            duration,
            analysis
          }
        });
        
        console.log(''); // Empty line for readability
        
      } catch (error) {
        failedTests++;
        console.log(`   ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        
        results.push({
          testCase: testCase.name,
          success: false,
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    }

    // Display summary
    console.log('📋 TEST SUMMARY');
    console.log('===============');
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📊 Success Rate: ${Math.round((passedTests / testCases.length) * 100)}%`);

    // Detailed analysis
    if (results.length > 0) {
      console.log('\n📈 DETAILED ANALYSIS');
      console.log('===================');
      
      const avgRecommendations = results
        .filter(r => r.success && r.details.recommendations)
        .reduce((sum, r) => sum + r.details.recommendations, 0) / passedTests;
      
      const avgScore = results
        .filter(r => r.success && r.details.topScore)
        .reduce((sum, r) => sum + r.details.topScore, 0) / passedTests;
      
      const avgDuration = results
        .filter(r => r.details.duration)
        .reduce((sum, r) => sum + r.details.duration, 0) / results.length;

      console.log(`📊 Average recommendations per test: ${avgRecommendations.toFixed(1)}`);
      console.log(`🎯 Average relevance score: ${avgScore.toFixed(3)}`);
      console.log(`⏱️  Average response time: ${avgDuration.toFixed(0)}ms`);
      
      // Category coverage
      const allCategories = results
        .filter(r => r.success)
        .flatMap(r => r.details.categories || []);
      const uniqueCategories = [...new Set(allCategories)];
      
      console.log(`🏷️  Categories covered: ${uniqueCategories.length}`);
      console.log(`   ${uniqueCategories.join(', ')}`);
    }

    // Performance insights
    console.log('\n🚀 PERFORMANCE INSIGHTS');
    console.log('=======================');
    
    // Test Indonesian search functionality
    console.log('Testing Indonesian search terms...');
    const searchTerms = ['diabetes', 'maag', 'diet', 'kolesterol', 'hipertensi'];
    
    for (const term of searchTerms) {
      const searchResults = await productService.searchProductsInIndonesian(term);
      console.log(`   "${term}": ${searchResults.length} products found`);
    }

    // Final verdict
    console.log(`\n${passedTests === testCases.length ? '🎉' : '⚠️'} Final Result: ${passedTests}/${testCases.length} tests passed`);
    
    if (failedTests > 0) {
      console.log('\n🔧 RECOMMENDATIONS FOR IMPROVEMENT:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   • Fix issues in "${r.testCase}" test`);
        if (r.details.analysis?.reason) {
          console.log(`     Reason: ${r.details.analysis.reason}`);
        }
      });
    }

  } catch (error) {
    logger.error('Test execution failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

function analyzeRecommendations(testCase: TestCase, recommendations: any[]): { success: boolean; reason: string; score: number } {
  // Check minimum recommendations
  if (testCase.minimumRecommendations && recommendations.length < testCase.minimumRecommendations) {
    return {
      success: false,
      reason: `Expected at least ${testCase.minimumRecommendations} recommendations, got ${recommendations.length}`,
      score: 0
    };
  }

  // Check if any recommendations were generated
  if (recommendations.length === 0) {
    return {
      success: false,
      reason: 'No recommendations generated',
      score: 0
    };
  }

  // Check expected categories
  if (testCase.expectedCategories) {
    const foundCategories = [...new Set(recommendations.map(r => r.product.category))];
    const hasExpectedCategory = testCase.expectedCategories.some(expected => 
      foundCategories.includes(expected)
    );
    
    if (!hasExpectedCategory) {
      return {
        success: false,
        reason: `Expected categories ${testCase.expectedCategories.join(', ')}, found ${foundCategories.join(', ')}`,
        score: 0.5
      };
    }
  }

  // Check relevance scores
  const topScore = recommendations[0]?.relevanceScore || 0;
  if (topScore < 0.3) {
    return {
      success: false,
      reason: `Top relevance score too low: ${topScore.toFixed(3)} (minimum 0.3)`,
      score: topScore
    };
  }

  // Check recommendation quality
  const hasReasons = recommendations.every(r => r.reason && r.reason.length > 10);
  if (!hasReasons) {
    return {
      success: false,
      reason: 'Poor recommendation reasoning quality',
      score: topScore
    };
  }

  return {
    success: true,
    reason: 'All checks passed',
    score: topScore
  };
}

async function testSpecificScenario(): Promise<void> {
  console.log('\n🎯 TESTING SPECIFIC USER SCENARIO');
  console.log('=================================');
  
  // Simulate a real customer conversation
  const scenarios = [
    {
      userMessage: "Saya punya diabetes dan gula darah sering naik. Adakah produk yang bisa membantu?",
      expectedFindings: ['diabetes', 'gula darah tinggi']
    },
    {
      userMessage: "Perut saya sering kembung dan susah BAB, maagnya juga sering kambuh",
      expectedFindings: ['maag', 'pencernaan', 'susah BAB']
    },
    {
      userMessage: "Mau diet nih, berat badan naik terus. Ada yang bisa bantu turun berat badan?",
      expectedFindings: ['diet', 'berat badan', 'obesitas']
    }
  ];

  for (const scenario of scenarios) {
    console.log(`\n💬 User: "${scenario.userMessage}"`);
    
    // This would normally be processed by the enhanced WhatsApp service
    // For testing, we'll extract health concerns manually
    const healthConcerns = extractHealthConcernsFromMessage(scenario.userMessage);
    
    console.log(`🔍 Extracted concerns: ${healthConcerns.join(', ')}`);
    
    if (healthConcerns.length > 0) {
      const recommendations = await productService.getProductRecommendations({
        symptoms: healthConcerns,
        conditions: healthConcerns,
        severity: 'moderate',
        duration: 'chronic',
        goals: []
      });
      
      console.log(`🤖 AI Response: Found ${recommendations.length} suitable products:`);
      recommendations.slice(0, 2).forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec.product.name} - Rp ${rec.product.price.toLocaleString()}`);
        console.log(`      ${rec.reason}`);
      });
    }
  }
}

function extractHealthConcernsFromMessage(message: string): string[] {
  const concerns: string[] = [];
  const lowerMessage = message.toLowerCase();

  const patterns = {
    'diabetes': ['diabetes', 'gula darah'],
    'maag': ['maag', 'lambung'],
    'diet': ['diet', 'berat badan', 'gemuk'],
    'pencernaan': ['kembung', 'susah bab', 'pencernaan'],
    'hipertensi': ['darah tinggi', 'hipertensi'],
    'kolesterol': ['kolesterol']
  };

  Object.entries(patterns).forEach(([concern, keywords]) => {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      concerns.push(concern);
    }
  });

  return concerns;
}

// CLI interface
async function main(): Promise<void> {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'scenario':
        await testSpecificScenario();
        break;
        
      case 'full':
        await runRecommendationTests();
        await testSpecificScenario();
        break;
        
      default:
        await runRecommendationTests();
        break;
    }
    
    console.log('\n✅ Testing completed successfully');
    
  } catch (error) {
    console.error('\n❌ Testing failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Export for programmatic use
export { runRecommendationTests, testSpecificScenario };

// Run if called directly
if (require.main === module) {
  main();
}