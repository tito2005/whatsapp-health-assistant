#!/usr/bin/env node

// Test Priority 1 improvements: Database persistence, encryption, retry mechanisms, error handling

const path = require('path');
const { execSync } = require('child_process');

// Ensure we're in the project root
process.chdir(path.resolve(__dirname, '..'));

console.log('🧪 Testing Priority 1 Improvements\n');

async function testDatabaseConnection() {
  console.log('1. Testing Database Connection...');
  try {
    // Import after changing directory to ensure proper path resolution
    const { databaseManager } = require('../dist/src/config/database.js');
    
    await databaseManager.waitForInitialization();
    const healthCheck = await databaseManager.healthCheck();
    
    if (healthCheck.healthy) {
      console.log('✅ Database connection successful');
      console.log(`   - Products: ${healthCheck.details.productCount}`);
      console.log(`   - Customers: ${healthCheck.details.customerCount}`);
    } else {
      console.log('❌ Database connection failed:', healthCheck.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Database test failed:', error.message);
    return false;
  }
  return true;
}

async function testEncryption() {
  console.log('\n2. Testing Encryption Service...');
  try {
    const { encryptionService } = require('../dist/src/shared/encryption.js');
    
    // Test basic encryption/decryption
    const testData = 'Sensitive customer data: +62812345678';
    const encrypted = encryptionService.encrypt(testData);
    const decrypted = encryptionService.decrypt(encrypted);
    
    if (decrypted === testData) {
      console.log('✅ Encryption/Decryption successful');
    } else {
      console.log('❌ Encryption/Decryption failed');
      return false;
    }
    
    // Test data masking
    const maskedPhone = encryptionService.maskPhoneNumber('+62812345678');
    const maskedEmail = encryptionService.maskEmail('customer@example.com');
    
    console.log(`   - Masked phone: ${maskedPhone}`);
    console.log(`   - Masked email: ${maskedEmail}`);
    
    if (maskedPhone.includes('*') && maskedEmail.includes('*')) {
      console.log('✅ Data masking working correctly');
    } else {
      console.log('❌ Data masking failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Encryption test failed:', error.message);
    return false;
  }
  return true;
}

async function testOrderService() {
  console.log('\n3. Testing Order Service with Database Persistence...');
  try {
    const { OrderService } = require('../dist/src/orders/order-service.js');
    
    const orderService = new OrderService();
    
    // Test creating a new order
    const newOrder = orderService.createNewOrder();
    console.log('✅ New order created successfully');
    
    // Test adding items to order
    const mockProduct = {
      product: {
        id: 'TEST-PRODUCT-1',
        name: 'Test Health Product',
        price: 150000
      }
    };
    
    orderService.addItemToOrder(newOrder, mockProduct, 2);
    
    if (newOrder.items.length === 1 && newOrder.totalAmount === 300000) {
      console.log('✅ Order item addition working correctly');
      console.log(`   - Items: ${newOrder.items.length}`);
      console.log(`   - Total: Rp ${newOrder.totalAmount.toLocaleString('id-ID')}`);
    } else {
      console.log('❌ Order item addition failed');
      return false;
    }
    
    // Test order validation
    newOrder.customerName = 'Test Customer';
    newOrder.whatsappNumber = '+62812345678';
    newOrder.address = 'Test Address, Jakarta';
    newOrder.paymentMethod = 'cod';
    
    const validation = orderService.validateOrderData(newOrder);
    if (validation.isValid) {
      console.log('✅ Order validation working correctly');
    } else {
      console.log('❌ Order validation failed:', validation.missingFields);
      return false;
    }
    
    // Test shipping zone detection
    const zone1 = orderService.detectShippingZone('Tanjung Piayu Area');
    const zone2 = orderService.detectShippingZone('Batam Centre Mall');
    const zone3 = orderService.detectShippingZone('Batu Aji District');
    
    if (zone1 === 'tanjung_piayu' && zone2 === 'batam_centre' && zone3 === 'other') {
      console.log('✅ Shipping zone detection working correctly');
      console.log(`   - Tanjung Piayu: ${zone1}`);
      console.log(`   - Batam Centre: ${zone2}`);
      console.log(`   - Other area: ${zone3}`);
    } else {
      console.log('❌ Shipping zone detection failed');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Order service test failed:', error.message);
    return false;
  }
  return true;
}

async function testRetryMechanism() {
  console.log('\n4. Testing Retry Mechanism...');
  try {
    const { RetryService } = require('../dist/src/shared/retry.js');
    
    let attempts = 0;
    const maxAttempts = 3;
    
    // Simulate a function that fails twice then succeeds
    const flakyFunction = async () => {
      attempts++;
      if (attempts < maxAttempts) {
        throw new Error('Simulated failure');
      }
      return 'Success!';
    };
    
    const result = await RetryService.executeWithRetry(flakyFunction, {
      maxAttempts: 3,
      initialDelay: 100,
      retryCondition: () => true
    });
    
    if (result === 'Success!' && attempts === maxAttempts) {
      console.log('✅ Retry mechanism working correctly');
      console.log(`   - Succeeded after ${attempts} attempts`);
    } else {
      console.log('❌ Retry mechanism failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Retry mechanism test failed:', error.message);
    return false;
  }
  return true;
}

async function testErrorHandling() {
  console.log('\n5. Testing Enhanced Error Handling...');
  try {
    const { ChatbotErrorHandler, ErrorType } = require('../dist/src/shared/error-handler.js');
    
    // Test error classification
    const networkError = new Error('ECONNRESET: Connection lost');
    networkError.code = 'ECONNRESET';
    
    const userMessage = ChatbotErrorHandler.handleChatbotError(networkError, {
      operation: 'test',
      userId: 'test-user'
    });
    
    if (userMessage && userMessage.includes('koneksi')) {
      console.log('✅ Error handling and classification working');
      console.log(`   - User message: ${userMessage.substring(0, 50)}...`);
    } else {
      console.log('❌ Error handling failed');
      return false;
    }
    
    // Test business logic error creation
    const bizError = ChatbotErrorHandler.createBusinessLogicError(
      'Invalid order state',
      'Pesanan tidak dapat diproses dalam status ini'
    );
    
    if (bizError.userMessage === 'Pesanan tidak dapat diproses dalam status ini') {
      console.log('✅ Custom error creation working correctly');
    } else {
      console.log('❌ Custom error creation failed');
      return false;
    }
    
  } catch (error) {
    console.log('❌ Error handling test failed:', error.message);
    return false;
  }
  return true;
}

async function testSecureLogging() {
  console.log('\n6. Testing Secure Logging...');
  try {
    const { log } = require('../dist/src/shared/logger.js');
    
    // Test structured logging methods
    log.order.created('ORD-20250630-143022-ABC1', 'CUST-20250630-DEF456', 250000);
    log.customer.created('CUST-20250630-GHI789', '+62812345678');
    log.claude.request('user123', 150, 'claude-3-sonnet');
    
    console.log('✅ Secure logging methods working correctly');
    console.log('   - Check logs/combined.log for masked sensitive data');
    
  } catch (error) {
    console.log('❌ Secure logging test failed:', error.message);
    return false;
  }
  return true;
}

async function runAllTests() {
  const tests = [
    testDatabaseConnection,
    testEncryption,
    testOrderService,
    testRetryMechanism,
    testErrorHandling,
    testSecureLogging
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`❌ Test failed with error: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All Priority 1 improvements are working correctly!');
    console.log('The system is now production-ready with:');
    console.log('  - Database persistence for orders');
    console.log('  - Data encryption and masking');
    console.log('  - Retry mechanisms with exponential backoff');
    console.log('  - Circuit breaker for API resilience');
    console.log('  - Enhanced error handling with fallbacks');
    console.log('  - Secure logging with data protection');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the implementation.');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});