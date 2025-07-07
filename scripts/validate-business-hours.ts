/**
 * Business Hours Validation Script
 * This script validates the business hours implementation without running the full test suite
 */

import { databaseManager } from '@/config/database';
import { BusinessHoursService } from '@/services/business-hours-service';
// import { logger } from '@/shared/logger';

interface ValidationResult {
  test: string;
  passed: boolean;
  error?: string | undefined;
  details?: any;
}

class BusinessHoursValidator {
  private service: BusinessHoursService;
  private results: ValidationResult[] = [];

  constructor() {
    this.service = new BusinessHoursService();
  }

  private addResult(test: string, passed: boolean, error?: string | undefined, details?: any): void {
    this.results.push({ test, passed, error: error || undefined, details });
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${test}`);
    if (error) {
      console.log(`   Error: ${error}`);
    }
    if (details) {
      console.log(`   Details:`, details);
    }
  }

  async validate(): Promise<void> {
    console.log('🔍 Starting Business Hours Validation');
    console.log('=====================================\n');

    try {
      // Test 1: Database connection
      await this.validateDatabaseConnection();
      
      // Test 2: Service instantiation
      await this.validateServiceInstantiation();
      
      // Test 3: Basic operations
      await this.validateBasicOperations();
      
      // Test 4: Business hours logic
      await this.validateBusinessLogic();
      
      // Test 5: Error handling
      await this.validateErrorHandling();

    } catch (error) {
      this.addResult('Overall validation', false, error instanceof Error ? error.message : 'Unknown error');
    }

    this.printSummary();
  }

  private async validateDatabaseConnection(): Promise<void> {
    try {
      await databaseManager.waitForInitialization();
      const connection = databaseManager.getConnection();
      
      // Test database tables exist
      const tables = await connection.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('business_hours', 'special_schedules')
      `);
      
      if (tables.length === 2) {
        this.addResult('Database connection and tables', true);
      } else {
        this.addResult('Database connection and tables', false, 'Missing required tables', { tablesFound: tables.length });
      }
    } catch (error) {
      this.addResult('Database connection', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async validateServiceInstantiation(): Promise<void> {
    try {
      const service = new BusinessHoursService();
      if (service && typeof service.getCurrentStatus === 'function') {
        this.addResult('Service instantiation', true);
      } else {
        this.addResult('Service instantiation', false, 'Service missing expected methods');
      }
    } catch (error) {
      this.addResult('Service instantiation', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async validateBasicOperations(): Promise<void> {
    try {
      // Test setup default hours
      await this.service.setupDefaultHours();
      this.addResult('Setup default hours', true);

      // Test get all business hours
      const allHours = await this.service.getAllBusinessHours();
      if (allHours.length === 7) {
        this.addResult('Get all business hours', true, undefined, { hoursCount: allHours.length });
      } else {
        this.addResult('Get all business hours', false, 'Expected 7 days', { hoursCount: allHours.length });
      }

      // Test get specific day
      const monday = await this.service.getBusinessHours(1);
      if (monday && monday.day_of_week === 1) {
        this.addResult('Get specific day hours', true);
      } else {
        this.addResult('Get specific day hours', false, 'Monday hours not found or invalid');
      }

    } catch (error) {
      this.addResult('Basic operations', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async validateBusinessLogic(): Promise<void> {
    try {
      // Test current status
      const status = await this.service.getCurrentStatus();
      if (status && typeof status.isOpen === 'boolean' && status.message && status.currentTime) {
        this.addResult('Get current status', true, undefined, { 
          isOpen: status.isOpen, 
          timezone: status.timezone 
        });
      } else {
        this.addResult('Get current status', false, 'Invalid status response', status);
      }

      // Test status message
      const statusMessage = await this.service.getStatusMessage();
      if (statusMessage && statusMessage.includes('Toko') && statusMessage.length > 10) {
        this.addResult('Get status message', true);
      } else {
        this.addResult('Get status message', false, 'Invalid status message', { messageLength: statusMessage?.length });
      }

      // Test formatted schedule
      const schedule = await this.service.getFormattedSchedule();
      if (schedule && schedule.includes('JAM OPERASIONAL') && schedule.includes('Monday')) {
        this.addResult('Get formatted schedule', true);
      } else {
        this.addResult('Get formatted schedule', false, 'Invalid schedule format');
      }

    } catch (error) {
      this.addResult('Business logic', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async validateErrorHandling(): Promise<void> {
    try {
      // Test invalid day
      const invalidDay = await this.service.getBusinessHours(8);
      if (invalidDay === null) {
        this.addResult('Invalid day handling', true);
      } else {
        this.addResult('Invalid day handling', false, 'Should return null for invalid day');
      }

      // Test non-existent special schedule
      const nonExistent = await this.service.getSpecialSchedule('2099-01-01');
      if (nonExistent === null) {
        this.addResult('Non-existent special schedule', true);
      } else {
        this.addResult('Non-existent special schedule', false, 'Should return null for non-existent date');
      }

    } catch (error) {
      this.addResult('Error handling', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private printSummary(): void {
    console.log('\n📊 Validation Summary');
    console.log('====================');
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const percentage = Math.round((passed / total) * 100);
    
    console.log(`Tests Passed: ${passed}/${total} (${percentage}%)`);
    
    if (passed === total) {
      console.log('🎉 All validations passed! Business hours system is ready.');
    } else {
      console.log('⚠️  Some validations failed. Check the errors above.');
      
      console.log('\nFailed Tests:');
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`  ❌ ${result.test}: ${result.error}`);
      });
    }
    
    console.log('\n💡 Next Steps:');
    console.log('1. Run the full application to test WhatsApp integration');
    console.log('2. Test business hours messages with real WhatsApp messages');
    console.log('3. Configure your actual business hours using the setup script');
  }
}

// Performance test
async function performanceTest(): Promise<void> {
  console.log('\n⚡ Performance Test');
  console.log('==================');
  
  const service = new BusinessHoursService();
  const iterations = 50;
  
  console.log(`Running ${iterations} status checks...`);
  
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    await service.getCurrentStatus();
  }
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / iterations;
  
  console.log(`Total time: ${totalTime.toFixed(2)}ms`);
  console.log(`Average time per check: ${avgTime.toFixed(2)}ms`);
  
  if (avgTime < 10) {
    console.log('✅ Performance: EXCELLENT');
  } else if (avgTime < 25) {
    console.log('✅ Performance: GOOD');
  } else if (avgTime < 50) {
    console.log('⚠️  Performance: ACCEPTABLE');
  } else {
    console.log('❌ Performance: NEEDS IMPROVEMENT');
  }
}

// Integration test with WhatsApp service simulation
async function integrationTest(): Promise<void> {
  console.log('\n🔗 Integration Test');
  console.log('==================');
  
  try {
    // Simulate WhatsApp service integration
    const businessService = new BusinessHoursService();
    
    // Test scenarios
    const scenarios = [
      { message: 'halo', description: 'New conversation' },
      { message: 'jam berapa buka?', description: 'Business hours inquiry' },
      { message: 'mau pesan produk', description: 'Order attempt' },
      { message: 'lanjut konsultasi tadi', description: 'Continuing conversation' }
    ];
    
    console.log('Testing message scenarios:');
    
    for (const scenario of scenarios) {
      const status = await businessService.getCurrentStatus();
      const statusMessage = await businessService.getStatusMessage();
      
      console.log(`\n📱 Scenario: ${scenario.description}`);
      console.log(`   Message: "${scenario.message}"`);
      console.log(`   Status: ${status.isOpen ? 'OPEN 🟢' : 'CLOSED 🔴'}`);
      console.log(`   Response would include: ${statusMessage.substring(0, 50)}...`);
    }
    
    console.log('\n✅ Integration test completed');
    
  } catch (error) {
    console.log(`❌ Integration test failed: ${error}`);
  }
}

// Main execution
async function main(): Promise<void> {
  const testType = process.argv[2] || 'validate';
  
  try {
    switch (testType) {
      case 'validate':
        const validator = new BusinessHoursValidator();
        await validator.validate();
        break;
        
      case 'performance':
        await databaseManager.waitForInitialization();
        await performanceTest();
        break;
        
      case 'integration':
        await databaseManager.waitForInitialization();
        await integrationTest();
        break;
        
      case 'all':
        const allValidator = new BusinessHoursValidator();
        await allValidator.validate();
        await performanceTest();
        await integrationTest();
        break;
        
      default:
        console.log('Usage: ts-node scripts/validate-business-hours.ts [validate|performance|integration|all]');
        process.exit(1);
    }
    
    console.log('\n🎯 Validation completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Auto-run if called directly
if (require.main === module) {
  main();
}

export { BusinessHoursValidator, performanceTest, integrationTest };