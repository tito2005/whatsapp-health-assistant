#!/usr/bin/env ts-node

import { contextValidator, ValidationContext } from './context-validator';
import { businessHoursService } from '@/utils/business-hours';
import { fallbackMessageService } from './fallback-messages';

// Simple test scenarios for validation system
async function testValidationSystem() {
  console.log('🧪 Testing Context Validation System\n');

  // Test 1: Wrong product response
  console.log('Test 1: Wrong Product Response');
  const test1Context: ValidationContext = {
    userQuery: 'superfood rasa apa aja?',
    aiResponse: 'mGanik 3Peptide tersedia dalam kemasan 330g dengan harga Rp 350,000',
    conversationHistory: [
      { role: 'user', content: 'mau tanya tentang superfood', timestamp: new Date() },
      { role: 'assistant', content: 'Ada yang bisa dibantu tentang superfood?', timestamp: new Date() }
    ],
    expectedProduct: 'mganik superfood'
  };

  const result1 = await contextValidator.validateResponse(test1Context);
  console.log('Result:', {
    isValid: result1.isValid,
    shouldEscalate: result1.shouldEscalate,
    confidence: result1.confidence,
    issues: result1.issues.map(i => ({ type: i.type, severity: i.severity, description: i.description }))
  });

  // Test 2: Conversation restart
  console.log('\nTest 2: Conversation Restart');
  const test2Context: ValidationContext = {
    userQuery: 'harga berapa?',
    aiResponse: 'Selamat malam! Perkenalkan saya Maya, customer service Arver ID',
    conversationHistory: [
      { role: 'user', content: 'mau tanya hotto purto', timestamp: new Date() },
      { role: 'assistant', content: 'Hotto Purto bagus untuk kesehatan', timestamp: new Date() },
      { role: 'user', content: 'manfaatnya apa aja?', timestamp: new Date() },
      { role: 'assistant', content: 'Manfaat Hotto Purto antara lain...', timestamp: new Date() }
    ]
  };

  const result2 = await contextValidator.validateResponse(test2Context);
  console.log('Result:', {
    isValid: result2.isValid,
    shouldEscalate: result2.shouldEscalate,
    confidence: result2.confidence,
    issues: result2.issues.map(i => ({ type: i.type, severity: i.severity, description: i.description }))
  });

  // Test 3: Valid response
  console.log('\nTest 3: Valid Response');
  const test3Context: ValidationContext = {
    userQuery: 'superfood ada rasa apa aja?',
    aiResponse: 'mGanik Superfood tersedia dalam 2 varian rasa: Kurma dan Labu. Harga 289k per box',
    conversationHistory: [
      { role: 'user', content: 'mau tanya superfood', timestamp: new Date() },
      { role: 'assistant', content: 'Ada yang bisa dibantu tentang superfood?', timestamp: new Date() }
    ],
    expectedProduct: 'mganik superfood'
  };

  const result3 = await contextValidator.validateResponse(test3Context);
  console.log('Result:', {
    isValid: result3.isValid,
    shouldEscalate: result3.shouldEscalate,
    confidence: result3.confidence,
    issues: result3.issues.map(i => ({ type: i.type, severity: i.severity, description: i.description }))
  });

  // Test business hours
  console.log('\n📅 Testing Business Hours');
  const businessStatus = businessHoursService.isBusinessHours();
  console.log('Business Hours Status:', {
    isBusinessHours: businessStatus.isBusinessHours,
    currentTime: businessStatus.currentTime,
    nextBusinessTime: businessStatus.nextBusinessTime,
    timeUntilBusiness: businessStatus.timeUntilBusiness
  });

  // Test fallback messages
  console.log('\n💬 Testing Fallback Messages');
  const fallbackMsg1 = fallbackMessageService.getFallbackMessage('product', true);
  const fallbackMsg2 = fallbackMessageService.getPoliteEscalationMessage('superfood rasa apa aja?');
  const fallbackMsg3 = fallbackMessageService.getOffHoursMessage('Senin 9 AM WIB');

  console.log('Product Fallback:', fallbackMsg1.message);
  console.log('Polite Escalation:', fallbackMsg2);
  console.log('Off Hours:', fallbackMsg3);

  console.log('\n✅ Validation system tests completed');
}

// Run tests if called directly
if (require.main === module) {
  testValidationSystem()
    .then(() => {
      console.log('\n🎉 All validation tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Validation tests failed:', error);
      process.exit(1);
    });
}

export { testValidationSystem };