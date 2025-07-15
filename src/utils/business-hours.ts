import { logger } from '@/shared/logger';

export interface BusinessHoursConfig {
  timezone: string;
  weekdays: {
    start: string; // HH:MM format
    end: string;   // HH:MM format
  };
  weekends: {
    enabled: boolean;
    start?: string;
    end?: string;
  };
  holidays: string[]; // YYYY-MM-DD format
}

export interface BusinessHoursStatus {
  isBusinessHours: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  currentTime: string;
  nextBusinessTime?: string | undefined;
  timeUntilBusiness?: string | undefined;
}

export class BusinessHoursService {
  private config: BusinessHoursConfig;

  constructor(config?: Partial<BusinessHoursConfig>) {
    this.config = {
      timezone: 'Asia/Jakarta',
      weekdays: {
        start: '09:00',
        end: '18:00'
      },
      weekends: {
        enabled: false
      },
      holidays: [
        // Common Indonesian holidays 2025
        '2025-01-01', // New Year
        '2025-02-12', // Chinese New Year
        '2025-03-29', // Good Friday
        '2025-03-31', // Eid al-Fitr (estimated)
        '2025-04-01', // Eid al-Fitr Holiday
        '2025-05-01', // Labor Day
        '2025-05-29', // Ascension Day
        '2025-06-05', // Eid al-Adha (estimated)
        '2025-06-26', // Islamic New Year (estimated)
        '2025-08-17', // Independence Day
        '2025-09-05', // Prophet Muhammad Birthday (estimated)
        '2025-12-25', // Christmas
      ],
      ...config
    };

    logger.info('BusinessHoursService initialized', {
      timezone: this.config.timezone,
      weekdayHours: `${this.config.weekdays.start}-${this.config.weekdays.end}`,
      weekendsEnabled: this.config.weekends.enabled
    });
  }

  public isBusinessHours(date?: Date): BusinessHoursStatus {
    const now = date || new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: this.config.timezone }));
    
    const currentTime = this.formatTime(jakartaTime);
    const isWeekend = this.isWeekend(jakartaTime);
    const isHoliday = this.isHoliday(jakartaTime);

    let isBusinessHours = false;

    if (!isHoliday) {
      if (isWeekend) {
        // Weekend logic
        if (this.config.weekends.enabled && this.config.weekends.start && this.config.weekends.end) {
          isBusinessHours = this.isTimeInRange(
            currentTime, 
            this.config.weekends.start, 
            this.config.weekends.end
          );
        }
      } else {
        // Weekday logic
        isBusinessHours = this.isTimeInRange(
          currentTime,
          this.config.weekdays.start,
          this.config.weekdays.end
        );
      }
    }

    const nextBusinessTime = this.getNextBusinessTime(jakartaTime);
    const timeUntilBusiness = this.getTimeUntilBusiness(jakartaTime, nextBusinessTime);

    const status: BusinessHoursStatus = {
      isBusinessHours,
      isWeekend,
      isHoliday,
      currentTime: `${currentTime} WIB`,
      nextBusinessTime: nextBusinessTime ? `${this.formatTime(nextBusinessTime)} WIB` : undefined,
      timeUntilBusiness
    };

    logger.debug('Business hours status checked', status);

    return status;
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
  }

  private isHoliday(date: Date): boolean {
    const dateString = this.formatDate(date);
    return this.config.holidays.includes(dateString);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]!;
  }

  private formatTime(date: Date): string {
    return date.toTimeString().substring(0, 5); // HH:MM
  }

  private parseTime(timeString: string): { hours: number; minutes: number } {
    const [hours, minutes] = timeString.split(':').map(Number);
    return { hours: hours!, minutes: minutes! };
  }

  private isTimeInRange(currentTime: string, startTime: string, endTime: string): boolean {
    const current = this.parseTime(currentTime);
    const start = this.parseTime(startTime);
    const end = this.parseTime(endTime);

    const currentMinutes = current.hours * 60 + current.minutes;
    const startMinutes = start.hours * 60 + start.minutes;
    const endMinutes = end.hours * 60 + end.minutes;

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  private getNextBusinessTime(currentDate: Date): Date | null {
    const current = new Date(currentDate);
    
    // Try to find next business time within the next 7 days
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(current);
      checkDate.setDate(current.getDate() + i);
      
      if (this.isHoliday(checkDate)) {
        continue;
      }

      const isWeekend = this.isWeekend(checkDate);
      let businessStart: string;

      if (isWeekend) {
        if (!this.config.weekends.enabled || !this.config.weekends.start) {
          continue;
        }
        businessStart = this.config.weekends.start;
      } else {
        businessStart = this.config.weekdays.start;
      }

      // If it's today, check if business hours haven't started yet
      if (i === 0) {
        const currentTime = this.formatTime(current);
        if (this.isTimeInRange(currentTime, businessStart, isWeekend ? this.config.weekends.end! : this.config.weekdays.end)) {
          // Currently in business hours
          return null;
        }
        if (currentTime < businessStart) {
          // Business hours haven't started today
          const businessStartTime = new Date(checkDate);
          const startParts = this.parseTime(businessStart);
          businessStartTime.setHours(startParts.hours, startParts.minutes, 0, 0);
          return businessStartTime;
        }
        // Business hours already ended today, check next day
        continue;
      }

      // For future days, return the business start time
      const businessStartTime = new Date(checkDate);
      const startParts = this.parseTime(businessStart);
      businessStartTime.setHours(startParts.hours, startParts.minutes, 0, 0);
      return businessStartTime;
    }

    return null; // No business hours found in next 7 days
  }

  private getTimeUntilBusiness(currentDate: Date, nextBusinessTime: Date | null): string | undefined {
    if (!nextBusinessTime) {
      return undefined;
    }

    const diffMs = nextBusinessTime.getTime() - currentDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours >= 24) {
      const diffDays = Math.floor(diffHours / 24);
      const remainingHours = diffHours % 24;
      
      if (remainingHours === 0) {
        return `${diffDays} hari`;
      } else {
        return `${diffDays} hari ${remainingHours} jam`;
      }
    } else if (diffHours > 0) {
      if (diffMinutes === 0) {
        return `${diffHours} jam`;
      } else {
        return `${diffHours} jam ${diffMinutes} menit`;
      }
    } else {
      return `${diffMinutes} menit`;
    }
  }

  public getBusinessHoursMessage(): string {
    const status = this.isBusinessHours();
    
    if (status.isBusinessHours) {
      return 'Tim customer service sedang online dan siap membantu Anda.';
    }

    if (status.isHoliday) {
      return `Hari ini adalah hari libur. Customer service akan kembali aktif ${status.nextBusinessTime || 'pada hari kerja berikutnya'}.`;
    }

    if (status.isWeekend && !this.config.weekends.enabled) {
      return `Customer service tidak aktif di akhir pekan. Kami akan kembali melayani Senin pukul ${this.config.weekdays.start} WIB.`;
    }

    if (status.timeUntilBusiness) {
      return `Customer service akan aktif kembali dalam ${status.timeUntilBusiness} (${status.nextBusinessTime}).`;
    }

    return 'Customer service sedang tidak aktif. Silakan coba lagi nanti.';
  }

  public shouldQueueEscalation(): boolean {
    return !this.isBusinessHours().isBusinessHours;
  }

  public getNextBusinessHoursText(): string {
    const status = this.isBusinessHours();
    
    if (status.isBusinessHours) {
      return 'sekarang (sedang aktif)';
    }

    return status.nextBusinessTime || 'belum ditentukan';
  }

  // Utility method for testing different times
  public checkBusinessHoursAt(dateTime: string): BusinessHoursStatus {
    const testDate = new Date(dateTime);
    return this.isBusinessHours(testDate);
  }

  // Method to update holidays dynamically
  public updateHolidays(holidays: string[]): void {
    this.config.holidays = holidays;
    logger.info('Business hours holidays updated', {
      holidayCount: holidays.length
    });
  }

  // Method to update business hours
  public updateBusinessHours(newConfig: Partial<BusinessHoursConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Business hours configuration updated', {
      timezone: this.config.timezone,
      weekdayHours: `${this.config.weekdays.start}-${this.config.weekdays.end}`,
      weekendsEnabled: this.config.weekends.enabled
    });
  }

  public getConfig(): BusinessHoursConfig {
    return { ...this.config };
  }
}

// Create default instance
export const businessHoursService = new BusinessHoursService();

// Export utility function for quick checks
export function isCurrentlyBusinessHours(): boolean {
  return businessHoursService.isBusinessHours().isBusinessHours;
}

export function shouldQueueNotification(): boolean {
  return businessHoursService.shouldQueueEscalation();
}