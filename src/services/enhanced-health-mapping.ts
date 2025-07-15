/**
 * Enhanced Health Mapping Service
 * Comprehensive Indonesian health term recognition with regional variations, severity context, and fuzzy matching
 */

import { logger } from '@/shared/logger';
import { 
  EnhancedHealthMapping, 
  HealthCategory, 
  ExtractedSymptom,
  ExtractedCondition,
  TemporalContext,
  ConversationTemplate,
  SeverityString
} from '@/types/health-intelligence';

export class EnhancedHealthMappingService {
  private healthMappings: Map<string, EnhancedHealthMapping> = new Map();
  private healthCategories: Map<string, HealthCategory> = new Map();
  private fuzzyMatchThreshold = 0.7;

  constructor() {
    this.initializeHealthMappings();
    this.initializeHealthCategories();
    logger.info('Enhanced Health Mapping Service initialized with comprehensive Indonesian health vocabulary');
  }

  private initializeHealthMappings(): void {
    const mappings: EnhancedHealthMapping[] = [
      // Digestive Issues - Enhanced with regional terms
      {
        term: 'maag',
        variations: ['mag', 'magh', 'sakit maag', 'maag kambuh', 'lambung sakit'],
        englishEquivalents: ['gastritis', 'stomach acid', 'acid reflux', 'GERD'],
        severity: 'any',
        category: 'digestive',
        contextClues: ['perih', 'nyeri', 'kembung', 'mual', 'lambung', 'ulu hati'],
        confidence: 0.9
      },
      {
        term: 'begah',
        variations: ['begah perut', 'perut begah', 'kembung begah', 'begah banget'],
        englishEquivalents: ['bloated', 'stuffed', 'overfull', 'distended'],
        severity: 'mild',
        category: 'digestive',
        contextClues: ['perut', 'kenyang', 'penuh', 'sesak'],
        confidence: 0.85
      },
      {
        term: 'eneg',
        variations: ['mual', 'pengen muntah', 'enek', 'mau muntah'],
        englishEquivalents: ['nauseous', 'sick', 'queasy'],
        severity: 'moderate',
        category: 'digestive',
        contextClues: ['muntah', 'perut', 'pusing', 'lambung'],
        confidence: 0.9
      },
      {
        term: 'mulas',
        variations: ['perut mulas', 'mulas perut', 'kram perut', 'nyeri perut'],
        englishEquivalents: ['stomach cramps', 'abdominal pain', 'digestive pain'],
        severity: 'moderate',
        category: 'digestive',
        contextClues: ['kram', 'nyeri', 'sakit', 'perut', 'lambung'],
        confidence: 0.88
      },

      // Energy/Fatigue - Colloquial Indonesian terms
      {
        term: 'lemes',
        variations: ['lemas', 'lemah', 'badan lemes', 'tenaga kurang', 'drop'],
        englishEquivalents: ['weak', 'fatigue', 'low energy', 'tired'],
        severity: 'moderate',
        category: 'energy',
        contextClues: ['capek', 'lelah', 'tenaga', 'stamina', 'badan'],
        confidence: 0.9
      },
      {
        term: 'capek',
        variations: ['cape', 'kecapean', 'capai', 'lelah banget'],
        englishEquivalents: ['tired', 'exhausted', 'fatigued'],
        severity: 'mild',
        category: 'energy',
        contextClues: ['lelah', 'istirahat', 'tidur', 'kerja'],
        confidence: 0.85
      },
      {
        term: 'ngantuk',
        variations: ['kantuk', 'mengantuk', 'pengen tidur', 'sleepy'],
        englishEquivalents: ['drowsy', 'sleepy', 'tired'],
        severity: 'mild',
        category: 'sleep',
        contextClues: ['tidur', 'mata', 'berat', 'istirahat'],
        confidence: 0.8
      },

      // Pain & Discomfort - Indonesian expressions
      {
        term: 'pegel',
        variations: ['pegal', 'pegel-pegel', 'badan pegal', 'otot pegal'],
        englishEquivalents: ['aching', 'sore', 'muscle pain', 'stiff'],
        severity: 'mild',
        category: 'musculoskeletal',
        contextClues: ['otot', 'badan', 'nyeri', 'kaku', 'sakit'],
        confidence: 0.85
      },
      {
        term: 'kliyengan',
        variations: ['pusing kliyengan', 'kepala kliyengan', 'berputar'],
        englishEquivalents: ['dizzy', 'lightheaded', 'vertigo'],
        severity: 'moderate',
        category: 'neurological',
        contextClues: ['pusing', 'kepala', 'mual', 'keseimbangan'],
        confidence: 0.88
      },

      // Respiratory - Regional variations
      {
        term: 'seseg',
        variations: ['hidung tersumbat', 'hidung mampet', 'pilek', 'ingus'],
        englishEquivalents: ['stuffy nose', 'nasal congestion', 'blocked nose'],
        severity: 'mild',
        category: 'respiratory',
        contextClues: ['hidung', 'napas', 'pilek', 'flu'],
        confidence: 0.82
      },

      // Diabetes - Enhanced detection
      {
        term: 'diabetes',
        variations: ['diabates', 'diabetis', 'kencing manis', 'gula darah tinggi', 'DM'],
        englishEquivalents: ['diabetes', 'high blood sugar', 'glucose'],
        severity: 'severe',
        category: 'metabolic',
        contextClues: ['gula', 'darah', 'kencing', 'haus', 'sering', 'buang air'],
        confidence: 0.95
      },
      {
        term: 'sering haus',
        variations: ['haus terus', 'banyak minum', 'mulut kering'],
        englishEquivalents: ['excessive thirst', 'polydipsia'],
        severity: 'moderate',
        category: 'metabolic',
        contextClues: ['diabetes', 'gula', 'minum', 'kering'],
        confidence: 0.75
      },

      // Blood Pressure
      {
        term: 'tensi naik',
        variations: ['tekanan darah tinggi', 'hipertensi', 'darah tinggi', 'tensi tinggi'],
        englishEquivalents: ['high blood pressure', 'hypertension'],
        severity: 'severe',
        category: 'cardiovascular',
        contextClues: ['jantung', 'kepala', 'pusing', 'berdebar'],
        confidence: 0.92
      },

      // Cholesterol
      {
        term: 'kolesterol',
        variations: ['kolestrol', 'lemak darah', 'kolesterol tinggi'],
        englishEquivalents: ['cholesterol', 'blood lipids'],
        severity: 'moderate',
        category: 'cardiovascular',
        contextClues: ['darah', 'jantung', 'lemak', 'pembuluh'],
        confidence: 0.9
      },

      // Mental Health
      {
        term: 'stress',
        variations: ['stres', 'tertekan', 'beban pikiran', 'pikiran berat'],
        englishEquivalents: ['stress', 'anxiety', 'mental pressure'],
        severity: 'moderate',
        category: 'mental_health',
        contextClues: ['pikiran', 'cemas', 'gelisah', 'tidur'],
        confidence: 0.85
      },

      // Sleep Issues
      {
        term: 'susah tidur',
        variations: ['insomnia', 'tidak bisa tidur', 'sulit tidur', 'begadang'],
        englishEquivalents: ['insomnia', 'sleep difficulty', 'sleeplessness'],
        severity: 'moderate',
        category: 'sleep',
        contextClues: ['malam', 'tidur', 'mata', 'istirahat'],
        confidence: 0.88
      },

      // Weight Management
      {
        term: 'berat badan naik',
        variations: ['gemuk', 'kegemukan', 'obesitas', 'berat berlebih'],
        englishEquivalents: ['weight gain', 'obesity', 'overweight'],
        severity: 'moderate',
        category: 'metabolic',
        contextClues: ['berat', 'diet', 'makan', 'olahraga'],
        confidence: 0.85
      },

      // Immunity
      {
        term: 'sering sakit',
        variations: ['mudah sakit', 'daya tahan lemah', 'imun turun', 'gampang flu'],
        englishEquivalents: ['frequent illness', 'low immunity', 'weak immune system'],
        severity: 'moderate',
        category: 'immunity',
        contextClues: ['flu', 'batuk', 'demam', 'imun', 'vitamin'],
        confidence: 0.8
      }
    ];

    // Index all mappings and variations
    mappings.forEach(mapping => {
      // Primary term
      this.healthMappings.set(mapping.term.toLowerCase(), mapping);
      
      // All variations
      mapping.variations.forEach(variation => {
        this.healthMappings.set(variation.toLowerCase(), mapping);
      });
    });

    logger.info(`Initialized ${mappings.length} enhanced health mappings with ${this.healthMappings.size} total searchable terms`);
  }

  private initializeHealthCategories(): void {
    const categories: HealthCategory[] = [
      {
        id: 'digestive',
        name: 'Masalah Pencernaan',
        urgencyLevel: 'soon',
        scoringWeights: {
          symptomMatch: 0.4,
          conditionMatch: 0.3,
          severityMultiplier: 1.2,
          durationBonus: 0.1,
          contextualRelevance: 0.2,
          userProfileAlignment: 0.1
        },
        followUpQuestions: [
          {
            id: 'digestive_duration',
            question: 'Keluhan ini sudah berapa lama? Baru hari ini atau sudah beberapa minggu?',
            category: 'duration',
            priority: 'high',
            expectedAnswerType: 'duration'
          },
          {
            id: 'digestive_triggers',
            question: 'Biasanya muncul setelah makan apa? Makanan pedas, asam, atau yang lain?',
            category: 'triggers',
            priority: 'medium',
            expectedAnswerType: 'descriptive'
          },
          {
            id: 'digestive_timing',
            question: 'Keluhan ini muncul kapan? Sebelum makan, sesudah makan, atau waktu tertentu?',
            category: 'triggers',
            priority: 'medium',
            expectedAnswerType: 'choice'
          }
        ]
      },
      {
        id: 'energy',
        name: 'Masalah Energi & Stamina',
        urgencyLevel: 'routine',
        scoringWeights: {
          symptomMatch: 0.3,
          conditionMatch: 0.2,
          severityMultiplier: 1.0,
          durationBonus: 0.2,
          contextualRelevance: 0.3,
          userProfileAlignment: 0.2
        },
        followUpQuestions: [
          {
            id: 'energy_pattern',
            question: 'Kapan biasanya merasa lemas? Pagi, siang, atau sepanjang hari?',
            category: 'symptoms',
            priority: 'high',
            expectedAnswerType: 'choice'
          },
          {
            id: 'energy_sleep',
            question: 'Tidur malam cukup nggak? Biasanya jam berapa tidur dan bangun?',
            category: 'lifestyle',
            priority: 'medium',
            expectedAnswerType: 'descriptive'
          }
        ]
      },
      {
        id: 'metabolic',
        name: 'Masalah Metabolik',
        urgencyLevel: 'urgent',
        scoringWeights: {
          symptomMatch: 0.5,
          conditionMatch: 0.4,
          severityMultiplier: 1.5,
          durationBonus: 0.2,
          contextualRelevance: 0.2,
          userProfileAlignment: 0.3
        },
        followUpQuestions: [
          {
            id: 'metabolic_symptoms',
            question: 'Ada gejala lain seperti sering haus, sering kencing, atau berat badan turun?',
            category: 'symptoms',
            priority: 'high',
            expectedAnswerType: 'boolean'
          },
          {
            id: 'metabolic_family',
            question: 'Ada keluarga yang punya diabetes atau masalah gula darah?',
            category: 'medical_history',
            priority: 'medium',
            expectedAnswerType: 'boolean'
          }
        ]
      }
    ];

    categories.forEach(category => {
      this.healthCategories.set(category.id, category);
    });
  }

  /**
   * Extract health terms from user message with enhanced accuracy
   */
  public extractHealthTerms(message: string): { symptoms: ExtractedSymptom[], conditions: ExtractedCondition[] } {
    const normalizedMessage = this.normalizeText(message);
    const symptoms: ExtractedSymptom[] = [];
    const conditions: ExtractedCondition[] = [];

    // Direct mapping lookup
    for (const [searchTerm, mapping] of this.healthMappings) {
      if (normalizedMessage.includes(searchTerm)) {
        const extraction = this.createExtraction(mapping, message, searchTerm, 1.0);
        
        if (this.isSymptom(mapping.category)) {
          symptoms.push(extraction as ExtractedSymptom);
        } else {
          conditions.push(extraction as ExtractedCondition);
        }
      }
    }

    // Fuzzy matching for typos and variations
    const fuzzyMatches = this.findFuzzyMatches(normalizedMessage);
    fuzzyMatches.forEach(match => {
      const extraction = this.createExtraction(match.mapping, message, match.matchedTerm, match.confidence);
      
      if (this.isSymptom(match.mapping.category)) {
        symptoms.push(extraction as ExtractedSymptom);
      } else {
        conditions.push(extraction as ExtractedCondition);
      }
    });

    // Remove duplicates and sort by confidence
    const uniqueSymptoms = this.removeDuplicateExtractions(symptoms);
    const uniqueConditions = this.removeDuplicateExtractions(conditions);

    logger.info('Health terms extracted', {
      message: message.substring(0, 100),
      symptomsFound: uniqueSymptoms.length,
      conditionsFound: uniqueConditions.length,
      totalMappingsChecked: this.healthMappings.size
    });

    return {
      symptoms: uniqueSymptoms.sort((a, b) => b.confidence - a.confidence),
      conditions: uniqueConditions.sort((a, b) => b.confidence - a.confidence)
    };
  }

  /**
   * Extract temporal context from user message
   */
  public extractTemporalContext(message: string): TemporalContext {
    const normalizedMessage = this.normalizeText(message);
    
    const durationPatterns = {
      'acute': ['hari ini', 'tadi', 'baru', 'mendadak', 'tiba-tiba'],
      'subacute': ['minggu ini', 'beberapa hari', 'seminggu'],
      'chronic': ['lama', 'bertahun', 'bulanan', 'kronik', 'terus-terusan']
    };

    const frequencyPatterns = {
      'occasional': ['kadang', 'sesekali', 'jarang'],
      'frequent': ['sering', 'kerap', 'lumayan sering'],
      'constant': ['terus', 'selalu', 'nonstop', 'tanpa henti']
    };

    const progressionPatterns = {
      'improving': ['membaik', 'berkurang', 'reda', 'agak mendingan'],
      'worsening': ['makin parah', 'bertambah', 'semakin', 'lebih sakit'],
      'stable': ['sama aja', 'gitu-gitu aja', 'stabil']
    };

    let duration: TemporalContext['duration'] = 'unknown';
    let frequency: TemporalContext['frequency'] = 'unknown';
    let progression: TemporalContext['progression'] = 'unknown';

    // Detect duration
    for (const [key, patterns] of Object.entries(durationPatterns)) {
      if (patterns.some(pattern => normalizedMessage.includes(pattern))) {
        duration = key as TemporalContext['duration'];
        break;
      }
    }

    // Detect frequency
    for (const [key, patterns] of Object.entries(frequencyPatterns)) {
      if (patterns.some(pattern => normalizedMessage.includes(pattern))) {
        frequency = key as TemporalContext['frequency'];
        break;
      }
    }

    // Detect progression
    for (const [key, patterns] of Object.entries(progressionPatterns)) {
      if (patterns.some(pattern => normalizedMessage.includes(pattern))) {
        progression = key as TemporalContext['progression'];
        break;
      }
    }

    return { duration, frequency, progression };
  }

  /**
   * Get health category for term
   */
  public getHealthCategory(categoryId: string): HealthCategory | undefined {
    return this.healthCategories.get(categoryId);
  }

  /**
   * Get follow-up questions for health categories
   */
  public getFollowUpQuestions(categoryIds: string[]): ConversationTemplate[] {
    const questions: ConversationTemplate[] = [];
    
    categoryIds.forEach(categoryId => {
      const category = this.healthCategories.get(categoryId);
      if (category) {
        questions.push(...category.followUpQuestions);
      }
    });

    // Sort by priority and return top questions
    return questions
      .sort((a, b) => {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 3); // Return top 3 questions
  }

  // Private helper methods
  private normalizeText(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private findFuzzyMatches(message: string): Array<{ mapping: EnhancedHealthMapping, matchedTerm: string, confidence: number }> {
    const matches: Array<{ mapping: EnhancedHealthMapping, matchedTerm: string, confidence: number }> = [];
    const words = message.split(' ');

    for (const [searchTerm, mapping] of this.healthMappings) {
      for (const word of words) {
        if (word.length > 3) { // Only fuzzy match longer words
          const similarity = this.calculateSimilarity(word, searchTerm);
          if (similarity >= this.fuzzyMatchThreshold) {
            matches.push({
              mapping,
              matchedTerm: word,
              confidence: similarity * mapping.confidence
            });
          }
        }
      }
    }

    return matches;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i]![0] = i;
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0]![j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1,
            matrix[i]![j - 1]! + 1,
            matrix[i - 1]![j]! + 1
          );
        }
      }
    }
    
    return matrix[str2.length]![str1.length]!;
  }

  private createExtraction(mapping: EnhancedHealthMapping, originalMessage: string, matchedTerm: string, confidence: number): ExtractedSymptom | ExtractedCondition {
    const severity = this.detectSeverity(originalMessage, mapping);
    
    const base = {
      term: mapping.term,
      originalText: matchedTerm,
      confidence: confidence * mapping.confidence,
      severity,
      mappedTerms: mapping.englishEquivalents,
      contextClues: mapping.contextClues.filter(clue => 
        originalMessage.toLowerCase().includes(clue)
      )
    };

    if (this.isSymptom(mapping.category)) {
      return base as ExtractedSymptom;
    } else {
      return {
        ...base,
        medicalCategory: mapping.category
      } as ExtractedCondition;
    }
  }

  private detectSeverity(message: string, mapping: EnhancedHealthMapping): SeverityString {
    const normalizedMessage = message.toLowerCase();
    
    const severityMarkers = {
      'severe': ['parah', 'sangat', 'banget', 'sekali', 'hebat', 'luar biasa'],
      'moderate': ['cukup', 'lumayan', 'agak', 'sedikit'],
      'mild': ['ringan', 'dikit', 'sedikit', 'tidak terlalu']
    };

    for (const [severity, markers] of Object.entries(severityMarkers)) {
      if (markers.some(marker => normalizedMessage.includes(marker))) {
        return severity;
      }
    }

    return mapping.severity;
  }

  private isSymptom(category: string): boolean {
    const symptomCategories = ['digestive', 'energy', 'sleep', 'musculoskeletal', 'neurological', 'respiratory'];
    return symptomCategories.includes(category);
  }

  private removeDuplicateExtractions<T extends { term: string, confidence: number }>(extractions: T[]): T[] {
    const uniqueMap = new Map<string, T>();
    
    extractions.forEach(extraction => {
      const existing = uniqueMap.get(extraction.term);
      if (!existing || extraction.confidence > existing.confidence) {
        uniqueMap.set(extraction.term, extraction);
      }
    });
    
    return Array.from(uniqueMap.values());
  }
}

export const enhancedHealthMappingService = new EnhancedHealthMappingService();