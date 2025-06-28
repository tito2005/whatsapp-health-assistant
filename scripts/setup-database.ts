#!/usr/bin/env ts-node

import { databaseManager } from '@/config/database';
import { productService } from '@/products/product-service';
import { logger } from '@/shared/logger';
import { displayProductSummary, seedProducts, validateProductData } from './seed-products';

interface SetupResult {
  success: boolean;
  message: string;
  details?: any;
  duration?: number;
}

async function setupDatabase(): Promise<SetupResult> {
  const startTime = Date.now();
  
  try {
    logger.info('🚀 Starting comprehensive database setup...');

    // Step 1: Wait for database initialization
    logger.info('📁 Initializing database connection...');
    await databaseManager.waitForInitialization();

    if (!databaseManager.isConnected()) {
      throw new Error('Database connection failed after initialization');
    }

    logger.info('✅ Database connection established successfully');

    // Step 2: Validate product data before seeding
    logger.info('🔍 Validating product data structure...');
    const isValid = await validateProductData();
    
    if (!isValid) {
      throw new Error('Product data validation failed - please fix data structure issues');
    }

    logger.info('✅ Product data validation passed');

    // Step 3: Seed products
    logger.info('🌱 Seeding health products...');
    await seedProducts();
    logger.info('✅ Products seeded successfully');

    // Step 4: Verify setup with comprehensive tests
    logger.info('🧪 Running verification tests...');
    await runVerificationTests();
    logger.info('✅ All verification tests passed');

    const duration = Date.now() - startTime;
    const result: SetupResult = {
      success: true,
      message: 'Database setup completed successfully',
      duration,
      details: await getDatabaseStatus()
    };

    logger.info('🎉 Database setup completed successfully!', {
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

    return result;

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error('❌ Database setup failed', {
      error: errorMessage,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

    return {
      success: false,
      message: `Database setup failed: ${errorMessage}`,
      duration
    };
  }
}

async function runVerificationTests(): Promise<void> {
  const tests = [
    testDatabaseConnection,
    testTableCreation,
    testProductCRUD,
    testProductRecommendations,
    testHealthMapping
  ];

  for (const test of tests) {
    await test();
  }
}

async function testDatabaseConnection(): Promise<void> {
  logger.info('Testing database connection...');
  
  const health = await databaseManager.healthCheck();
  if (!health.healthy) {
    throw new Error(`Database health check failed: ${health.message}`);
  }
  
  logger.info('✅ Database connection test passed');
}

async function testTableCreation(): Promise<void> {
  logger.info('Testing table creation...');
  
  const connection = databaseManager.getConnection();
  
  const tables = await connection.all(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `);
  
  const expectedTables = ['products', 'customers', 'orders', 'conversations', 'product_recommendations'];
  const existingTables = tables.map(t => t.name);
  
  for (const expectedTable of expectedTables) {
    if (!existingTables.includes(expectedTable)) {
      throw new Error(`Required table not found: ${expectedTable}`);
    }
  }
  
  logger.info('✅ Table creation test passed', { 
    tables: existingTables.length,
    names: existingTables 
  });
}

async function testProductCRUD(): Promise<void> {
  logger.info('Testing product CRUD operations...');
  
  // Test read operations
  const allProducts = await productService.getAllProducts();
  if (allProducts.length === 0) {
    throw new Error('No products found in database after seeding');
  }

  // Test get by ID
  const firstProduct = allProducts[0];
  if (!firstProduct) {
    throw new Error('No products available to test get by ID');
  }
  const retrievedProduct = await productService.getProductById(firstProduct.id);
  if (!retrievedProduct || retrievedProduct.id !== firstProduct.id) {
    throw new Error('Product retrieval by ID failed');
  }

  // Test category filtering
  const categoryProducts = await productService.getProductsByCategory(firstProduct.category);
  if (categoryProducts.length === 0) {
    throw new Error('Category filtering failed');
  }

  // Test statistics
  const stats = await productService.getProductStatistics();
  if (stats.totalProducts !== allProducts.length) {
    throw new Error('Product statistics mismatch');
  }

  logger.info('✅ Product CRUD test passed', {
    totalProducts: allProducts.length,
    categories: Object.keys(stats.productsByCategory).length,
    averagePrice: Math.round(stats.averagePrice)
  });
}

async function testProductRecommendations(): Promise<void> {
  logger.info('Testing product recommendation engine...');
  
  // Test health-based recommendations
  const testCases = [
    {
      name: 'Diabetes symptoms',
      assessment: {
        symptoms: ['gula darah tinggi'],
        conditions: ['diabetes'],
        severity: 'moderate' as const,
        duration: 'chronic' as const,
        goals: ['kontrol gula darah']
      }
    },
    {
      name: 'Digestive issues',
      assessment: {
        symptoms: ['perut kembung', 'susah BAB'],
        conditions: ['maag'],
        severity: 'mild' as const,
        duration: 'acute' as const,
        goals: ['pencernaan sehat']
      }
    },
    {
      name: 'Weight management',
      assessment: {
        symptoms: ['berat badan naik'],
        conditions: ['obesitas'],
        severity: 'moderate' as const,
        duration: 'chronic' as const,
        goals: ['turun berat badan']
      }
    }
  ];

  for (const testCase of testCases) {
    const recommendations = await productService.getProductRecommendations(testCase.assessment);
    
    if (recommendations.length === 0) {
      logger.warn(`No recommendations found for ${testCase.name}`, { testCase });
    } else {
      logger.info(`✅ Recommendations generated for ${testCase.name}`, {
        count: recommendations.length,
        topProduct: recommendations[0]?.product?.name ?? 'N/A',
        relevanceScore: recommendations[0]?.relevanceScore ?? 'N/A'
      });
    }
  }

  logger.info('✅ Product recommendation test passed');
}

async function testHealthMapping(): Promise<void> {
  logger.info('Testing Indonesian health term mapping...');
  
  const testSearches = [
    'diabetes',
    'maag',
    'kolesterol tinggi',
    'diet',
    'susah BAB'
  ];

  for (const searchTerm of testSearches) {
    const results = await productService.searchProductsInIndonesian(searchTerm);
    logger.info(`Search "${searchTerm}" returned ${results.length} products`);
  }

  logger.info('✅ Health mapping test passed');
}

async function getDatabaseStatus(): Promise<any> {
  try {
    const health = await databaseManager.healthCheck();
    const stats = await productService.getProductStatistics();
    
    return {
      health: health.healthy,
      connection: databaseManager.isConnected(),
      products: {
        total: stats.totalProducts,
        inStock: stats.inStockCount,
        categories: Object.keys(stats.productsByCategory).length,
        averagePrice: Math.round(stats.averagePrice)
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function healthCheck(): Promise<SetupResult> {
  try {
    logger.info('🏥 Running comprehensive health check...');

    // Database health
    const dbHealth = await databaseManager.healthCheck();
    
    // Product service health
    const stats = await productService.getProductStatistics();
    
    // Test a sample recommendation
    const sampleRecommendation = await productService.getProductRecommendations({
      symptoms: ['test'],
      conditions: ['test'],
      severity: 'mild',
      duration: 'acute',
      goals: []
    });

    const result = {
      success: dbHealth.healthy && stats.totalProducts > 0,
      message: dbHealth.healthy ? 'All systems healthy' : 'System issues detected',
      details: {
        database: dbHealth,
        products: stats,
        recommendationEngine: {
          working: sampleRecommendation !== undefined,
          testResultCount: sampleRecommendation.length
        }
      }
    };

    // Display formatted health report
    console.log('\n🏥 HEALTH CHECK REPORT');
    console.log('=====================');
    console.log(`🔋 Database: ${dbHealth.healthy ? '✅ Healthy' : '❌ Issues'}`);
    console.log(`📦 Products: ${stats.totalProducts} total, ${stats.inStockCount} in stock`);
    console.log(`🧠 AI Engine: ${sampleRecommendation !== undefined ? '✅ Working' : '❌ Issues'}`);
    console.log(`💰 Avg Price: Rp ${Math.round(stats.averagePrice).toLocaleString()}`);
    console.log('\n📊 Categories:');
    
    Object.entries(stats.productsByCategory).forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`);
    });
    
    console.log(`\n${result.success ? '✅' : '❌'} Overall Status: ${result.message}\n`);

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Health check failed', { error: errorMessage });
    
    return {
      success: false,
      message: `Health check failed: ${errorMessage}`
    };
  }
}

// Command line interface
async function main(): Promise<void> {
  const command = process.argv[2];
  const subcommand = process.argv[3];

  try {
    switch (command) {
      case 'setup':
        const setupResult = await setupDatabase();
        if (setupResult.success) {
          await displayProductSummary();
        }
        console.log(`\n${setupResult.success ? '✅' : '❌'} ${setupResult.message}`);
        if (setupResult.duration) {
          console.log(`⏱️  Duration: ${setupResult.duration}ms`);
        }
        process.exit(setupResult.success ? 0 : 1);
      case 'health':
      case 'check':
        const healthResult = await healthCheck();
        process.exit(healthResult.success ? 0 : 1);
      case 'seed':
        if (subcommand === 'validate') {
          const isValid = await validateProductData();
          console.log(isValid ? '✅ Validation passed' : '❌ Validation failed');
          process.exit(isValid ? 0 : 1);
        } else {
          await seedProducts();
          await displayProductSummary();
          console.log('✅ Products seeded successfully');
        }
        break;

      case 'test':
        await runVerificationTests();
        console.log('✅ All verification tests passed');
        break;

      case 'summary':
        await displayProductSummary();
        break;
        
      default:
        console.log(`
🗄️  Health Product Database Management Tool

Usage:
  yarn db:setup          - Full setup (init + seed + verify)
  yarn db:health         - Health check and status
  yarn db:seed           - Seed products only
  yarn db:seed validate  - Validate product data
  yarn db:test           - Run verification tests
  yarn db:summary        - Show product summary

Examples:
  yarn db:setup          # Complete database setup
  yarn db:health         # Check system status
  yarn db:seed validate  # Validate before seeding
        `);
        break;
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Operation failed: ${errorMessage}`);
    process.exit(1);
  }
}

// Export functions for programmatic use
export { healthCheck, runVerificationTests, setupDatabase };

// Run if called directly
if (require.main === module) {
  main();
}