/**
 * Health Intelligence System Tests
 * Test suite for enhanced health mapping, contextual scoring, and smart conversation flow
 */

import { enhancedHealthMappingService } from '../services/enhanced-health-mapping';
import { smartConversationEngine } from '../services/smart-conversation-engine';
import { contextualScoringEngine } from '../services/contextual-scoring-engine';

describe('Health Intelligence System', () => {
  
  describe('Enhanced Health Mapping', () => {
    test('should extract Indonesian colloquial health terms', () => {
      const testMessage = 'Badan gw lemes banget, perut juga begah abis makan';
      const result = enhancedHealthMappingService.extractHealthTerms(testMessage);
      
      expect(result.symptoms.length).toBeGreaterThan(0);
      expect(result.symptoms.some(s => s.term === 'lemes')).toBe(true);
      expect(result.symptoms.some(s => s.term === 'begah')).toBe(true);
    });

    test('should handle typos with fuzzy matching', () => {
      const testMessage = 'Diabates saya kambuh, kolestrol juga tinggi';
      const result = enhancedHealthMappingService.extractHealthTerms(testMessage);
      
      expect(result.conditions.length).toBeGreaterThan(0);
      expect(result.conditions.some(c => c.term === 'diabetes')).toBe(true);
      expect(result.conditions.some(c => c.term === 'kolesterol')).toBe(true);
    });

    test('should extract temporal context', () => {
      const testMessage = 'Maag saya sudah 2 minggu ini sering kambuh';
      const temporal = enhancedHealthMappingService.extractTemporalContext(testMessage);
      
      expect(temporal.duration).toBe('subacute');
      expect(temporal.frequency).toBe('frequent');
    });
  });

  describe('Smart Conversation Engine', () => {
    test('should generate appropriate follow-up questions', () => {
      const mockContext = {
        userId: 'test-user',
        messages: [],
        state: 'health_inquiry' as any
      };

      const mockHealthData = {
        symptoms: [{ term: 'maag', severity: 'moderate', confidence: 0.9 }],
        conditions: [],
        temporalContext: { duration: 'unknown', frequency: 'unknown', progression: 'unknown' },
        severityAssessment: { overall: 'moderate', urgency: 'routine' },
        userProfile: { communicationPreference: 'conversational' }
      } as any;

      const analysis = smartConversationEngine.analyzeConversation(
        'Maag saya sakit',
        mockContext,
        mockHealthData
      );

      expect(analysis.recommendedQuestions.length).toBeGreaterThan(0);
      expect(analysis.nextBestAction).toBeDefined();
    });
  });

  describe('Contextual Scoring Engine', () => {
    test('should score products based on health context', () => {
      const mockProduct = {
        id: 'test-product',
        name: 'Gastritis Relief',
        price: 100000,
        category: 'digestive_health',
        benefits: ['Mengatasi maag', 'Menenangkan lambung'],
        metadata: {
          healthConditions: ['gastritis', 'acid reflux'],
          symptoms: ['stomach pain', 'heartburn']
        }
      } as any;

      const mockAssessment = {
        symptoms: [{ term: 'maag', severity: 'moderate', confidence: 0.9, mappedTerms: ['gastritis'] }],
        conditions: [],
        severity: 'moderate',
        temporalContext: { duration: 'acute', frequency: 'frequent', progression: 'stable' }
      } as any;

      const result = contextualScoringEngine.calculateContextualScore(
        mockProduct,
        mockAssessment
      );

      expect(result.relevanceScore).toBeGreaterThan(0.2);
      expect(result.contextualReasons.length).toBeGreaterThan(0);
    });
  });

  describe('Integration Tests', () => {
    test('should process complete health inquiry flow', async () => {
      // Test the complete flow from message to recommendations
      const testMessage = 'Perut saya begah dan sering mual setelah makan';
      
      // Extract health terms
      const healthTerms = enhancedHealthMappingService.extractHealthTerms(testMessage);
      expect(healthTerms.symptoms.length).toBeGreaterThan(0);
      
      // Check if digestive symptoms are detected
      const hasDigestiveSymptoms = healthTerms.symptoms.some(s => 
        ['begah', 'mual', 'eneg'].includes(s.term)
      );
      expect(hasDigestiveSymptoms).toBe(true);
    });
  });
});

// Performance tests
describe('Performance Tests', () => {
  test('health mapping should process within reasonable time', () => {
    const start = Date.now();
    const testMessage = 'Badan lemes, perut begah, diabetes tinggi, kolesterol naik';
    
    enhancedHealthMappingService.extractHealthTerms(testMessage);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100); // Should complete within 100ms
  });
});

// Edge cases
describe('Edge Cases', () => {
  test('should handle empty messages gracefully', () => {
    const result = enhancedHealthMappingService.extractHealthTerms('');
    expect(result.symptoms).toEqual([]);
    expect(result.conditions).toEqual([]);
  });

  test('should handle non-health related messages', () => {
    const result = enhancedHealthMappingService.extractHealthTerms('Halo, apa kabar? Cuaca hari ini cerah');
    expect(result.symptoms.length).toBe(0);
    expect(result.conditions.length).toBe(0);
  });

  test('should handle mixed Indonesian-English messages', () => {
    const result = enhancedHealthMappingService.extractHealthTerms('I have diabetes dan perut saya juga kembung');
    expect(result.conditions.some(c => c.term === 'diabetes')).toBe(true);
    expect(result.conditions.length).toBeGreaterThan(0);
  });
});