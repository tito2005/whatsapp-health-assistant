import { BusinessHoursService } from '@/services/business-hours-service';
import { databaseManager } from '@/config/database';
// import { logger } from '@/shared/logger';

describe('Business Hours Service Tests', () => {
  let businessHoursService: BusinessHoursService;

  beforeAll(async () => {
    // Wait for database initialization
    await databaseManager.waitForInitialization();
    businessHoursService = new BusinessHoursService();
  });

  afterAll(async () => {
    await databaseManager.close();
  });

  describe('Basic Business Hours Management', () => {
    test('should setup default business hours', async () => {
      await businessHoursService.setupDefaultHours();
      
      const allHours = await businessHoursService.getAllBusinessHours();
      expect(allHours).toHaveLength(7); // 7 days of the week
      
      // Check Monday (should be open 9-17)
      const monday = await businessHoursService.getBusinessHours(1);
      expect(monday?.is_open).toBe(true);
      expect(monday?.open_time).toBe('09:00');
      expect(monday?.close_time).toBe('17:00');
      
      // Check Sunday (should be closed)
      const sunday = await businessHoursService.getBusinessHours(0);
      expect(sunday?.is_open).toBe(false);
    });

    test('should update business hours for specific day', async () => {
      // Update Monday to be 24 hours
      const updated = await businessHoursService.updateBusinessHours(1, {
        dayOfWeek: 1,
        isOpen: true,
        is24Hours: true
      });
      
      expect(updated.is_24_hours).toBe(true);
      expect(updated.is_open).toBe(true);
      
      // Revert back
      await businessHoursService.updateBusinessHours(1, {
        dayOfWeek: 1,
        isOpen: true,
        openTime: '09:00',
        closeTime: '17:00',
        is24Hours: false
      });
    });

    test('should get current status', async () => {
      const status = await businessHoursService.getCurrentStatus();
      
      expect(status).toHaveProperty('isOpen');
      expect(status).toHaveProperty('message');
      expect(status).toHaveProperty('currentTime');
      expect(status).toHaveProperty('timezone');
      expect(typeof status.isOpen).toBe('boolean');
    });

    test('should get formatted schedule', async () => {
      const schedule = await businessHoursService.getFormattedSchedule();
      
      expect(schedule).toContain('JAM OPERASIONAL');
      expect(schedule).toContain('Monday');
      expect(schedule).toContain('Sunday');
      expect(schedule).toContain('Status saat ini');
    });

    test('should get status message', async () => {
      const statusMessage = await businessHoursService.getStatusMessage();
      
      expect(statusMessage).toContain('Toko');
      expect(statusMessage.length).toBeGreaterThan(10);
    });
  });

  describe('Special Schedules', () => {
    test('should add special schedule', async () => {
      const testDate = '2024-12-25';
      const special = await businessHoursService.addSpecialSchedule(
        testDate,
        false,
        'Christmas Holiday'
      );
      
      expect(special.date).toBe(testDate);
      expect(special.is_open).toBe(false);
      expect(special.reason).toBe('Christmas Holiday');
    });

    test('should get special schedule', async () => {
      const testDate = '2024-12-25';
      const special = await businessHoursService.getSpecialSchedule(testDate);
      
      expect(special).not.toBeNull();
      expect(special?.date).toBe(testDate);
      expect(special?.reason).toBe('Christmas Holiday');
    });

    test('should handle special schedule in status check', async () => {
      // This would need to mock the current date to test properly
      // For now, just verify the method doesn't throw
      const status = await businessHoursService.getCurrentStatus();
      expect(status).toBeDefined();
    });
  });

  describe('Time Validation', () => {
    test('should validate time ranges correctly', async () => {
      // Test with valid hours
      const validHours = await businessHoursService.updateBusinessHours(2, {
        dayOfWeek: 2,
        isOpen: true,
        openTime: '08:00',
        closeTime: '20:00'
      });
      
      expect(validHours.open_time).toBe('08:00');
      expect(validHours.close_time).toBe('20:00');
    });

    test('should handle cross-midnight hours', async () => {
      // Test 24-hour service
      const nightHours = await businessHoursService.updateBusinessHours(3, {
        dayOfWeek: 3,
        isOpen: true,
        is24Hours: true
      });
      
      expect(nightHours.is_24_hours).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid day of week', async () => {
      const invalidDay = await businessHoursService.getBusinessHours(8);
      expect(invalidDay).toBeNull();
    });

    test('should handle non-existent special schedule', async () => {
      const nonExistent = await businessHoursService.getSpecialSchedule('2099-01-01');
      expect(nonExistent).toBeNull();
    });
  });
});

// Manual test functions for development
export async function testBusinessHoursManually(): Promise<void> {
  try {
    console.log('🧪 Manual Business Hours Testing');
    console.log('=================================');
    
    await databaseManager.waitForInitialization();
    const service = new BusinessHoursService();
    
    // Test 1: Setup default hours
    console.log('\n1. Setting up default hours...');
    await service.setupDefaultHours();
    console.log('✅ Default hours setup complete');
    
    // Test 2: Get current status
    console.log('\n2. Getting current status...');
    const status = await service.getCurrentStatus();
    console.log(`Status: ${status.isOpen ? 'OPEN 🟢' : 'CLOSED 🔴'}`);
    console.log(`Time: ${status.currentTime}`);
    console.log(`Message: ${status.message}`);
    
    // Test 3: Get formatted schedule
    console.log('\n3. Getting formatted schedule...');
    const schedule = await service.getFormattedSchedule();
    console.log(schedule);
    
    // Test 4: Test special schedule
    console.log('\n4. Testing special schedule...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    await service.addSpecialSchedule(
      tomorrowStr!,
      false,
      'Test Holiday'
    );
    console.log(`✅ Added special schedule for ${tomorrowStr}`);
    
    // Test 5: Update business hours
    console.log('\n5. Testing business hours update...');
    // const originalSunday = await service.getBusinessHours(0);
    
    await service.updateBusinessHours(0, {
      dayOfWeek: 0,
      isOpen: true,
      openTime: '10:00',
      closeTime: '14:00'
    });
    console.log('✅ Updated Sunday hours to 10:00-14:00');
    
    // Revert Sunday back to closed
    await service.updateBusinessHours(0, {
      dayOfWeek: 0,
      isOpen: false
    });
    console.log('✅ Reverted Sunday back to closed');
    
    // Test 6: Status message
    console.log('\n6. Getting status message...');
    const statusMessage = await service.getStatusMessage();
    console.log('Status Message:');
    console.log(statusMessage);
    
    console.log('\n✅ All manual tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Manual test failed:', error);
    throw error;
  }
}

// Performance test
export async function testBusinessHoursPerformance(): Promise<void> {
  try {
    console.log('⚡ Business Hours Performance Test');
    console.log('==================================');
    
    await databaseManager.waitForInitialization();
    const service = new BusinessHoursService();
    
    // Test status check performance
    const iterations = 100;
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      await service.getCurrentStatus();
    }
    
    const endTime = performance.now();
    const avgTime = (endTime - startTime) / iterations;
    
    console.log(`\nChecked status ${iterations} times`);
    console.log(`Average time per check: ${avgTime.toFixed(2)}ms`);
    console.log(`Total time: ${(endTime - startTime).toFixed(2)}ms`);
    
    if (avgTime < 50) {
      console.log('✅ Performance: GOOD');
    } else if (avgTime < 100) {
      console.log('⚠️ Performance: ACCEPTABLE');
    } else {
      console.log('❌ Performance: NEEDS IMPROVEMENT');
    }
    
  } catch (error) {
    console.error('❌ Performance test failed:', error);
    throw error;
  }
}

// Run manual tests if called directly
if (require.main === module) {
  const testType = process.argv[2] || 'manual';
  
  switch (testType) {
    case 'manual':
      testBusinessHoursManually()
        .then(() => process.exit(0))
        .catch(error => {
          console.error(error);
          process.exit(1);
        });
      break;
      
    case 'performance':
      testBusinessHoursPerformance()
        .then(() => process.exit(0))
        .catch(error => {
          console.error(error);
          process.exit(1);
        });
      break;
      
    default:
      console.log('Usage: npm run test:business-hours [manual|performance]');
      process.exit(1);
  }
}