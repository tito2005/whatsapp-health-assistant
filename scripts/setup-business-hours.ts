import { databaseManager } from '@/config/database';
import { businessHoursService } from '@/services/business-hours-service';
import { logger } from '@/shared/logger';

async function setupBusinessHours(): Promise<void> {
  try {
    logger.info('Setting up business hours...');

    // Wait for database initialization
    await databaseManager.waitForInitialization();

    // Check if business hours already exist
    const existingHours = await businessHoursService.getAllBusinessHours();
    if (existingHours.length > 0) {
      logger.info('Business hours already configured', { 
        count: existingHours.length,
        action: 'skipping_setup'
      });
      
      // Show existing business hours
      const schedule = await businessHoursService.getFormattedSchedule();
      console.log('\n📅 Current Business Hours:');
      console.log(schedule);
      
      return;
    }

    logger.info('No business hours found, setting up default schedule...');

    // Setup default business hours
    await businessHoursService.setupDefaultHours();

    // Verify setup
    const newHours = await businessHoursService.getAllBusinessHours();
    logger.info('Business hours setup completed', {
      hoursConfigured: newHours.length
    });

    // Display the configured schedule
    const schedule = await businessHoursService.getFormattedSchedule();
    console.log('\n✅ Business Hours Setup Complete!');
    console.log(schedule);

    // Show current status
    const currentStatus = await businessHoursService.getCurrentStatus();
    console.log(`\n🕒 Current Status: ${currentStatus.isOpen ? '🟢 OPEN' : '🔴 CLOSED'}`);
    console.log(`⏰ Current Time: ${currentStatus.currentTime}`);
    
    if (!currentStatus.isOpen && currentStatus.nextOpenTime) {
      console.log(`🔓 Next Open: ${currentStatus.nextOpenTime}`);
    }

  } catch (error) {
    logger.error('Failed to setup business hours', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

// Add some example special schedules
async function addExampleSpecialSchedules(): Promise<void> {
  try {
    logger.info('Adding example special schedules...');

    // Example: Holiday closure
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Add New Year holiday (example)
    const newYear = '2025-01-01';
    await businessHoursService.addSpecialSchedule(
      newYear,
      false,
      'Libur Tahun Baru'
    );

    // Add example special opening hours
    // const today = new Date().toISOString().split('T')[0];
    // Don't override today, just show how it would work
    
    logger.info('Example special schedules added');
    console.log('\n📅 Example Special Schedules:');
    console.log(`• ${newYear}: Libur Tahun Baru (TUTUP)`);
    console.log('\n💡 You can add more special schedules using the businessHoursService.addSpecialSchedule() method');

  } catch (error) {
    logger.error('Failed to add example special schedules', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Function to update specific day hours
async function updateBusinessHours(): Promise<void> {
  try {
    console.log('\n🔧 Business Hours Management');
    console.log('=====================================');
    
    // Example of how to update hours
    console.log('To update business hours, you can use:');
    console.log('');
    console.log('await businessHoursService.updateBusinessHours(dayOfWeek, {');
    console.log('  dayOfWeek: 0, // 0=Sunday, 1=Monday, etc.');
    console.log('  isOpen: true,');
    console.log('  openTime: "09:00",');
    console.log('  closeTime: "17:00",');
    console.log('  is24Hours: false');
    console.log('});');
    console.log('');
    
    // Show current configuration
    const allHours = await businessHoursService.getAllBusinessHours();
    console.log('Current Configuration:');
    allHours.forEach(hour => {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const status = hour.is_open ? 
        (hour.is_24_hours ? '24 Hours' : `${hour.open_time} - ${hour.close_time}`) : 
        'CLOSED';
      console.log(`  ${dayNames[hour.day_of_week]}: ${status}`);
    });

  } catch (error) {
    logger.error('Failed to show business hours management info', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Main execution
async function main(): Promise<void> {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'status':
        await businessHoursService.getCurrentStatus().then(status => {
          console.log('📊 Business Hours Status');
          console.log('========================');
          console.log(`Status: ${status.isOpen ? '🟢 OPEN' : '🔴 CLOSED'}`);
          console.log(`Current Time: ${status.currentTime}`);
          console.log(`Message: ${status.message}`);
          if (status.nextOpenTime) {
            console.log(`Next Open: ${status.nextOpenTime}`);
          }
          if (status.nextCloseTime) {
            console.log(`Closes At: ${status.nextCloseTime}`);
          }
        });
        break;

      case 'schedule':
        const schedule = await businessHoursService.getFormattedSchedule();
        console.log(schedule);
        break;

      case 'examples':
        await setupBusinessHours();
        await addExampleSpecialSchedules();
        break;

      case 'manage':
        await updateBusinessHours();
        break;

      default:
        await setupBusinessHours();
        console.log('\n💡 Available commands:');
        console.log('  npm run setup:business-hours status    - Check current status');
        console.log('  npm run setup:business-hours schedule  - Show weekly schedule');
        console.log('  npm run setup:business-hours examples  - Add example special schedules');
        console.log('  npm run setup:business-hours manage    - Show management info');
        break;
    }

    console.log('\n✅ Business hours operation completed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Business hours operation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { setupBusinessHours, addExampleSpecialSchedules, updateBusinessHours };