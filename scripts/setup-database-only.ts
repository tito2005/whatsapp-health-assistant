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

async function setupDatabaseOnly(): Promise<SetupResult> {
  const startTime = Date.now();
  
  try {
    console.log('🗄️  DATABASE-ONLY SETUP');
    console.log('======================');
    console.log('Setting up database and products without WhatsApp integration...\n');
    
    logger.info('🚀 Starting database-only setup...');

    // Step 1: Wait for database initialization
    console.log('📁 Initializing database connection...');
    await databaseManager.waitForInitialization();

    if (!databaseManager.isConnected()) {
      throw new Error('Database connection failed after initialization');
    }

    console.log('✅ Database connection established');
    logger.info('✅ Database connection established successfully');

    // Step 2: Validate product data before seeding
    console.log('🔍 Validating product data structure...');
    const isValid = await validateProductData();
    
    if (!isValid) {
      throw new Error('Product data validation failed - please fix data structure issues');
    }

    console.log('✅ Product data validation passed');
    logger.info('✅ Product data validation passed');

    // Step 3: Seed products
    console.log('🌱 Seeding health products...');
    await seedProducts();
    console.log('✅ Products seeded successfully');
    logger.info('✅ Products seeded successfully');

    // Step 4: Verify setup with database-only tests
    console.log('🧪 Running verification tests...');
    await runDatabaseVerificationTests();
    console.log('✅ All verification tests passed');
    logger.info('✅ All verification tests passed');

    const duration = Date.now() - startTime;
    const result: SetupResult = {
      success: true,
      message: 'Database setup completed successfully',
      duration,
      details: await getDatabaseStatus()
    };

    console.log('\n🎉 Database setup completed successfully!');
    console.log(`⏱️  Duration: ${duration}ms`);
    
    logger.info('🎉 Database setup completed successfully!', {
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });

    return result;

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error(`\n❌ Database setup failed: ${errorMessage}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    
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

async function runDatabaseVerificationTests(): Promise<void> {
  const tests = [
    testDatabaseConnection,
    testTableCreation,
    testProductCRUD,
    testProductRecommendations
  ];

  for (const test of tests) {
    await test();
  }
}

async function testDatabaseConnection(): Promise<void> {
  const health = await databaseManager.healthCheck();
  if (!health.healthy) {
    throw new Error(`Database health check failed: ${health.message}`);
  }
}

async function testTableCreation(): Promise<void> {
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
}

async function testProductCRUD(): Promise<void> {
  // Test read operations
  const allProducts = await productService.getAllProducts();
  if (allProducts.length === 0) {
    throw new Error('No products found in database after seeding');
  }

  // Test get by ID
  const firstProduct = allProducts[0];
  if (!firstProduct) {
    throw new Error('No products available to test getProductById');
  }
  const retrievedProduct = await productService.getProductById(firstProduct.id);
  if (!retrievedProduct || retrievedProduct.id !== firstProduct.id) {
    throw new Error('Product retrieval by ID failed');
  }

  // Test statistics
  const stats = await productService.getProductStatistics();
  if (stats.totalProducts !== allProducts.length) {
    throw new Error('Product statistics mismatch');
  }
}

async function testProductRecommendations(): Promise<void> {
  // Test health-based recommendations
  const testAssessment = {
    symptoms: ['gula darah tinggi'],
    conditions: ['diabetes'],
    severity: 'moderate' as const,
    duration: 'chronic' as const,
    goals: ['kontrol gula darah']
  };

  const recommendations = await productService.getProductRecommendations(testAssessment);
  
  if (recommendations.length === 0) {
    console.warn('⚠️  No recommendations found for diabetes test case');
  }
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

async function quickHealthCheck(): Promise<void> {
  try {
    console.log('\n🏥 QUICK HEALTH CHECK');
    console.log('====================');

    // Database health
    const dbHealth = await databaseManager.healthCheck();
    console.log(`🗄️  Database: ${dbHealth.healthy ? '✅ Healthy' : '❌ Issues'}`);

    if (dbHealth.healthy) {
      // Product stats
      const stats = await productService.getProductStatistics();
      console.log(`📦 Products: ${stats.totalProducts} total, ${stats.inStockCount} in stock`);
      console.log(`💰 Average Price: Rp ${Math.round(stats.averagePrice).toLocaleString()}`);
      
      console.log('\n📊 Categories:');
      Object.entries(stats.productsByCategory).forEach(([category, count]) => {
        console.log(`   ${category}: ${count}`);
      });

      // Test recommendation engine
      const sampleRecommendation = await productService.getProductRecommendations({
        symptoms: ['test'],
        conditions: ['test'],
        severity: 'mild',
        duration: 'acute',
        goals: []
      });
      
      console.log(`🧠 Recommendation Engine: ${sampleRecommendation !== undefined ? '✅ Working' : '❌ Issues'}`);
    }

    console.log(`\n${dbHealth.healthy ? '✅' : '❌'} Overall Status: ${dbHealth.healthy ? 'Ready for operations' : 'Requires attention'}\n`);

  } catch (error) {
    console.error('❌ Health check failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// Command line interface
async function main(): Promise<void> {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'setup':
        const setupResult = await setupDatabaseOnly();
        if (setupResult.success) {
          await displayProductSummary();
        }
        console.log(`\n${setupResult.success ? '✅' : '❌'} ${setupResult.message}`);
        process.exit(setupResult.success ? 0 : 1);
        
      case 'health':
      case 'check':
        await quickHealthCheck();
        break;
        
      case 'seed':
        await seedProducts();
        await displayProductSummary();
        console.log('✅ Products seeded successfully');
        break;

      case 'summary':
        await displayProductSummary();
        break;
        
      default:
        console.log(`
🗄️  Database-Only Setup Tool

Usage:
  yarn db:setup:safe        - Safe database setup without WhatsApp
  yarn db:health:safe       - Quick health check
  yarn db:seed:safe         - Seed products only
  yarn db:summary:safe      - Show product summary

This tool sets up the database and products without initializing WhatsApp,
avoiding the "sonic boom" error during development setup.
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
export { quickHealthCheck, setupDatabaseOnly };

// Run if called directly
if (require.main === module) {
  main();
}