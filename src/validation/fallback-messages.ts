import { logger } from '@/shared/logger';
import { config } from '@/config/environment';

export interface FallbackMessage {
  message: string;
  includeAdminContact: boolean;
  includeBusinessHours: boolean;
}

export class FallbackMessageService {
  private static fallbackMessages: Record<string, string[]> = {
    // Technical issues
    technical: [
      'Maaf Kak, ada kendala teknis sementara.',
      'Maaf Kak, sistem sedang mengalami gangguan.',
      'Maaf Kak, ada masalah teknis yang sedang kami perbaiki.',
    ],
    
    // Validation failures
    validation: [
      'Maaf Kak, ada sedikit kendala dalam memproses permintaan Anda.',
      'Maaf Kak, sistem perlu waktu sebentar untuk memahami pertanyaan Anda.',
      'Maaf Kak, ada kendala dalam memberikan informasi yang tepat.',
    ],
    
    // Context confusion
    context: [
      'Maaf Kak, bisa tolong ulangi pertanyaannya? Biar saya bisa bantu lebih baik.',
      'Maaf Kak, sepertinya ada kesalahan dalam pemahaman. Bisa dijelaskan lagi?',
      'Maaf Kak, saya kurang memahami maksudnya. Bisa diperjelas?',
    ],
    
    // Product confusion
    product: [
      'Maaf Kak, untuk informasi produk yang lebih akurat, biar admin yang bantu ya.',
      'Maaf Kak, untuk detail produk yang tepat, silakan hubungi admin kami.',
      'Maaf Kak, agar tidak ada kesalahan informasi, biar admin yang jawab ya.',
    ]
  };

  public static getFallbackMessage(
    type: 'technical' | 'validation' | 'context' | 'product' = 'technical',
    businessHours: boolean = true
  ): FallbackMessage {
    try {
      // Get random message from category
      const messages = this.fallbackMessages[type] || this.fallbackMessages.technical;
      const randomMessage = messages?.[Math.floor(Math.random() * messages.length)] || 'Maaf Kak, ada kendala teknis sementara.';

      // Build complete message
      let fullMessage = randomMessage;

      // Add admin contact information
      if (businessHours) {
        fullMessage += ` Tim customer service sudah diberitahu dan akan segera membantu. Atau bisa langsung hubungi admin di ${config.businessPhone2} ya 😊`;
      } else {
        fullMessage += ` Silakan hubungi admin di ${config.businessPhone2} untuk bantuan langsung, atau tunggu hingga jam kerja untuk respons otomatis 😊`;
      }

      return {
        message: fullMessage,
        includeAdminContact: true,
        includeBusinessHours: !businessHours
      };

    } catch (error) {
      logger.error('Failed to generate fallback message', { error });
      
      // Ultimate fallback
      return {
        message: `Maaf Kak, ada kendala teknis. Silakan hubungi admin di ${config.businessPhone2} untuk bantuan langsung 😊`,
        includeAdminContact: true,
        includeBusinessHours: false
      };
    }
  }

  public static getEscalationMessage(
    issueType: 'wrong_product' | 'conversation_restart' | 'context_bleeding' | 'general' = 'general',
    businessHours: boolean = true
  ): string {
    const baseMessages = {
      wrong_product: 'Maaf Kak, untuk memastikan informasi produk yang tepat',
      conversation_restart: 'Maaf Kak, ada sedikit gangguan dalam percakapan',
      context_bleeding: 'Maaf Kak, agar tidak ada kebingungan informasi',
      general: 'Maaf Kak, ada kendala teknis sementara'
    };

    const baseMessage = baseMessages[issueType];
    
    if (businessHours) {
      return `${baseMessage}, biar admin yang bantu langsung ya. Tim sudah diberitahu dan akan segera merespons. Atau hubungi ${config.businessPhone2} untuk bantuan immediate 😊`;
    } else {
      return `${baseMessage}, silakan hubungi admin di ${config.businessPhone2} atau tunggu hingga jam kerja (9 AM - 6 PM WIB) untuk bantuan otomatis 😊`;
    }
  }

  public static getBusinessHoursMessage(): string {
    return `Customer service aktif Senin-Jumat, 9 AM - 6 PM WIB. Di luar jam kerja, silakan hubungi ${config.businessPhone2} untuk bantuan darurat atau tunggu respons otomatis saat jam kerja 😊`;
  }

  public static getValidationErrorMessage(confidence: number): string {
    if (confidence < 0.3) {
      return this.getFallbackMessage('validation', true).message;
    } else if (confidence < 0.6) {
      return this.getFallbackMessage('context', true).message;
    } else {
      return this.getFallbackMessage('technical', true).message;
    }
  }

  /**
   * Get a polite message explaining the escalation without alarming the customer
   */
  public static getPoliteEscalationMessage(userQuery: string): string {
    const query = userQuery.toLowerCase();
    
    // Tailor message based on query type
    if (query.includes('rasa') || query.includes('varian') || query.includes('flavor')) {
      return `Maaf Kak, untuk informasi detail tentang varian dan rasa produk, biar admin yang kasih info lengkapnya ya. Tim sudah diberitahu dan akan segera membantu. Atau langsung hubungi ${config.businessPhone2} 😊`;
    }
    
    if (query.includes('harga') || query.includes('price') || query.includes('berapa')) {
      return `Maaf Kak, untuk informasi harga terbaru dan penawaran khusus, biar admin yang kasih info akuratnya ya. Tim sudah diberitahu. Atau langsung hubungi ${config.businessPhone2} 😊`;
    }
    
    if (query.includes('efek') || query.includes('manfaat') || query.includes('khasiat')) {
      return `Maaf Kak, untuk informasi detail manfaat dan efek produk, biar admin yang jelaskan lebih lengkap ya. Tim sudah diberitahu dan akan segera membantu. Atau langsung hubungi ${config.businessPhone2} 😊`;
    }
    
    // Generic polite escalation
    return `Maaf Kak, untuk memastikan Anda mendapat informasi yang paling akurat, biar admin yang bantu langsung ya. Tim sudah diberitahu dan akan segera merespons. Atau langsung hubungi ${config.businessPhone2} 😊`;
  }

  /**
   * Get message for off-hours escalations
   */
  public static getOffHoursMessage(nextBusinessTime?: string): string {
    if (nextBusinessTime) {
      return `Maaf Kak, customer service akan aktif kembali ${nextBusinessTime}. Untuk bantuan darurat, bisa hubungi ${config.businessPhone2}. Pertanyaan Anda sudah tersimpan dan akan diproses saat jam kerja 😊`;
    }
    
    return `Maaf Kak, customer service aktif Senin-Jumat 9 AM - 6 PM WIB. Untuk bantuan darurat, hubungi ${config.businessPhone2}. Pertanyaan Anda sudah tersimpan 😊`;
  }
}

export const fallbackMessageService = FallbackMessageService;