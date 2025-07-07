import { databaseManager } from '@/config/database';
import { logger } from '@/shared/logger';
import { BusinessHours, BusinessHoursConfig, BusinessStatus, SpecialSchedule, DAYS_OF_WEEK, DEFAULT_TIMEZONE } from '@/types/business-hours';
import { v4 as uuidv4 } from 'uuid';

export class BusinessHoursService {
  constructor() {}

  /**
   * Get current business status (open/closed)
   */
  public async getCurrentStatus(): Promise<BusinessStatus> {
    try {
      const now = new Date();
      const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: DEFAULT_TIMEZONE }));
      const currentDay = jakartaTime.getDay(); // 0 = Sunday
      const currentTime = jakartaTime.toTimeString().slice(0, 5); // HH:MM format
      const currentDateStr = jakartaTime.toISOString().split('T')[0]; // YYYY-MM-DD

      // Check for special schedule first (holidays, special events)
      const specialSchedule = await this.getSpecialSchedule(currentDateStr!);
      if (specialSchedule) {
        return await this.getStatusFromSpecialSchedule(specialSchedule, currentTime, jakartaTime);
      }

      // Get regular business hours for current day
      const businessHours = await this.getBusinessHours(currentDay);
      if (!businessHours) {
        return {
          isOpen: false,
          message: 'Jam operasional belum diatur untuk hari ini',
          currentTime: jakartaTime.toLocaleString('id-ID', { timeZone: DEFAULT_TIMEZONE }),
          timezone: DEFAULT_TIMEZONE
        };
      }

      return await this.getStatusFromBusinessHours(businessHours, currentTime, jakartaTime);

    } catch (error) {
      logger.error('Failed to get current business status', { error });
      return {
        isOpen: false,
        message: 'Tidak dapat mengecek status toko saat ini',
        currentTime: new Date().toLocaleString('id-ID', { timeZone: DEFAULT_TIMEZONE }),
        timezone: DEFAULT_TIMEZONE
      };
    }
  }

  /**
   * Get business hours for a specific day
   */
  public async getBusinessHours(dayOfWeek: number): Promise<BusinessHours | null> {
    try {
      const connection = databaseManager.getConnection();
      const result = await connection.get(
        'SELECT * FROM business_hours WHERE day_of_week = ?',
        [dayOfWeek]
      );
      return result || null;
    } catch (error) {
      logger.error('Failed to get business hours', { dayOfWeek, error });
      return null;
    }
  }

  /**
   * Get all business hours (full week)
   */
  public async getAllBusinessHours(): Promise<BusinessHours[]> {
    try {
      const connection = databaseManager.getConnection();
      const results = await connection.all(
        'SELECT * FROM business_hours ORDER BY day_of_week'
      );
      return results || [];
    } catch (error) {
      logger.error('Failed to get all business hours', { error });
      return [];
    }
  }

  /**
   * Update business hours for a specific day
   */
  public async updateBusinessHours(dayOfWeek: number, config: BusinessHoursConfig): Promise<BusinessHours> {
    try {
      const connection = databaseManager.getConnection();
      
      // Check if entry exists
      const existing = await this.getBusinessHours(dayOfWeek);
      
      if (existing) {
        // Update existing
        await connection.run(`
          UPDATE business_hours 
          SET is_open = ?, open_time = ?, close_time = ?, is_24_hours = ?, special_note = ?, updated_at = CURRENT_TIMESTAMP
          WHERE day_of_week = ?
        `, [
          config.isOpen,
          config.openTime || null,
          config.closeTime || null,
          config.is24Hours || false,
          config.specialNote || null,
          dayOfWeek
        ]);

        logger.info('Business hours updated', { dayOfWeek, config });
      } else {
        // Create new
        const id = uuidv4();
        await connection.run(`
          INSERT INTO business_hours (id, day_of_week, is_open, open_time, close_time, is_24_hours, timezone, special_note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id,
          dayOfWeek,
          config.isOpen,
          config.openTime || null,
          config.closeTime || null,
          config.is24Hours || false,
          DEFAULT_TIMEZONE,
          config.specialNote || null
        ]);

        logger.info('Business hours created', { dayOfWeek, config });
      }

      // Return updated hours
      const updated = await this.getBusinessHours(dayOfWeek);
      if (!updated) {
        throw new Error('Failed to retrieve updated business hours');
      }

      return updated;
    } catch (error) {
      logger.error('Failed to update business hours', { dayOfWeek, config, error });
      throw error;
    }
  }

  /**
   * Set up default business hours (Monday-Friday 9-17, Saturday 9-15, Sunday closed)
   */
  public async setupDefaultHours(): Promise<void> {
    try {
      const defaultHours = [
        { day: 0, isOpen: false }, // Sunday - Closed
        { day: 1, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Monday
        { day: 2, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Tuesday
        { day: 3, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Wednesday
        { day: 4, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Thursday
        { day: 5, isOpen: true, openTime: '09:00', closeTime: '17:00' }, // Friday
        { day: 6, isOpen: true, openTime: '09:00', closeTime: '15:00' }, // Saturday
      ];

      for (const hour of defaultHours) {
        await this.updateBusinessHours(hour.day, {
          dayOfWeek: hour.day,
          isOpen: hour.isOpen,
          openTime: hour.openTime || undefined,
          closeTime: hour.closeTime || undefined,
          is24Hours: false
        });
      }

      logger.info('Default business hours setup completed');
    } catch (error) {
      logger.error('Failed to setup default business hours', { error });
      throw error;
    }
  }

  /**
   * Get special schedule for a specific date
   */
  public async getSpecialSchedule(date: string): Promise<SpecialSchedule | null> {
    try {
      const connection = databaseManager.getConnection();
      const result = await connection.get(
        'SELECT * FROM special_schedules WHERE date = ?',
        [date]
      );
      return result || null;
    } catch (error) {
      logger.error('Failed to get special schedule', { date, error });
      return null;
    }
  }

  /**
   * Add special schedule (holiday, special event, etc.)
   */
  public async addSpecialSchedule(
    date: string,
    isOpen: boolean,
    reason: string,
    openTime?: string,
    closeTime?: string,
    is24Hours = false
  ): Promise<SpecialSchedule> {
    try {
      const connection = databaseManager.getConnection();
      const id = uuidv4();

      await connection.run(`
        INSERT INTO special_schedules (id, date, is_open, open_time, close_time, is_24_hours, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [id, date, isOpen, openTime || null, closeTime || null, is24Hours, reason]);

      const created = await this.getSpecialSchedule(date);
      if (!created) {
        throw new Error('Failed to retrieve created special schedule');
      }

      logger.info('Special schedule created', { date, isOpen, reason });
      return created;
    } catch (error) {
      logger.error('Failed to add special schedule', { date, isOpen, reason, error });
      throw error;
    }
  }

  /**
   * Get user-friendly status message
   */
  public async getStatusMessage(): Promise<string> {
    const status = await this.getCurrentStatus();
    
    if (status.isOpen) {
      if (status.nextCloseTime) {
        return `🚚 *Pengiriman tersedia hingga jam ${status.nextCloseTime} WIB*\n\nChat dan konsultasi tetap tersedia 24/7! 😊`;
      } else {
        return `🚚 *Pengiriman dan konsultasi tersedia 24 jam*\n\nSilakan pesan kapan saja! 😊`;
      }
    } else {
      if (status.nextOpenTime) {
        return `🚚 *Pengiriman dimulai kembali ${status.nextOpenTime}*\n\nTetap bisa order dan konsultasi sekarang, pengiriman diproses jam kerja ya! 😊`;
      } else {
        return `🚚 *Pengiriman pada jam kerja*\n\nChat dan konsultasi tetap tersedia 24/7! 😊`;
      }
    }
  }

  /**
   * Get formatted business hours for display
   */
  public async getFormattedSchedule(): Promise<string> {
    try {
      const allHours = await this.getAllBusinessHours();
      if (allHours.length === 0) {
        return '*Jam Operasional belum diatur*';
      }

      let schedule = '*📅 JAM OPERASIONAL*\n\n';
      
      for (let day = 0; day < 7; day++) {
        const dayName = DAYS_OF_WEEK[day];
        const hours = allHours.find(h => h.day_of_week === day);
        
        if (!hours || !hours.is_open) {
          schedule += `${dayName}: TUTUP\n`;
        } else if (hours.is_24_hours) {
          schedule += `${dayName}: 24 Jam\n`;
        } else {
          schedule += `${dayName}: ${hours.open_time} - ${hours.close_time} WIB\n`;
        }
      }

      // Add current status
      const currentStatus = await this.getCurrentStatus();
      schedule += `\n*Status saat ini:* ${currentStatus.isOpen ? '🟢 BUKA' : '🔴 TUTUP'}`;
      
      return schedule;
    } catch (error) {
      logger.error('Failed to get formatted schedule', { error });
      return '*Error: Tidak dapat menampilkan jadwal*';
    }
  }

  private async getStatusFromBusinessHours(hours: BusinessHours, currentTime: string, jakartaTime: Date): Promise<BusinessStatus> {
    if (!hours.is_open) {
      return {
        isOpen: false,
        nextOpenTime: await this.getNextOpenTime(jakartaTime),
        message: `Pengiriman tidak tersedia hari ${DAYS_OF_WEEK[hours.day_of_week]} (chat tetap aktif)`,
        currentTime: jakartaTime.toLocaleString('id-ID', { timeZone: DEFAULT_TIMEZONE }),
        timezone: DEFAULT_TIMEZONE
      };
    }

    if (hours.is_24_hours) {
      return {
        isOpen: true,
        message: 'Pengiriman dan konsultasi tersedia 24 jam',
        currentTime: jakartaTime.toLocaleString('id-ID', { timeZone: DEFAULT_TIMEZONE }),
        timezone: DEFAULT_TIMEZONE
      };
    }

    const isCurrentlyOpen = this.isTimeInRange(currentTime, hours.open_time, hours.close_time);
    
    return {
      isOpen: isCurrentlyOpen,
      nextOpenTime: isCurrentlyOpen ? undefined : await this.getNextOpenTime(jakartaTime),
      nextCloseTime: isCurrentlyOpen ? hours.close_time : undefined,
      message: isCurrentlyOpen ? 
        `Pengiriman tersedia (${hours.open_time} - ${hours.close_time} WIB)` :
        `Pengiriman jam kerja (${hours.open_time} - ${hours.close_time} WIB, chat tetap aktif)`,
      currentTime: jakartaTime.toLocaleString('id-ID', { timeZone: DEFAULT_TIMEZONE }),
      timezone: DEFAULT_TIMEZONE
    };
  }

  private async getStatusFromSpecialSchedule(schedule: SpecialSchedule, currentTime: string, jakartaTime: Date): Promise<BusinessStatus> {
    if (!schedule.is_open) {
      return {
        isOpen: false,
        nextOpenTime: await this.getNextOpenTime(jakartaTime),
        message: `Pengiriman tidak tersedia - ${schedule.reason} (chat tetap aktif)`,
        currentTime: jakartaTime.toLocaleString('id-ID', { timeZone: DEFAULT_TIMEZONE }),
        timezone: DEFAULT_TIMEZONE
      };
    }

    if (schedule.is_24_hours) {
      return {
        isOpen: true,
        message: `Pengiriman dan konsultasi tersedia 24 jam - ${schedule.reason}`,
        currentTime: jakartaTime.toLocaleString('id-ID', { timeZone: DEFAULT_TIMEZONE }),
        timezone: DEFAULT_TIMEZONE
      };
    }

    const isCurrentlyOpen = this.isTimeInRange(currentTime, schedule.open_time!, schedule.close_time!);
    
    return {
      isOpen: isCurrentlyOpen,
      nextCloseTime: isCurrentlyOpen ? schedule.close_time || undefined : undefined,
      message: `${schedule.reason} - Pengiriman ${isCurrentlyOpen ? 'tersedia' : 'jam kerja'} (${schedule.open_time} - ${schedule.close_time} WIB)`,
      currentTime: jakartaTime.toLocaleString('id-ID', { timeZone: DEFAULT_TIMEZONE }),
      timezone: DEFAULT_TIMEZONE
    };
  }

  private isTimeInRange(currentTime: string, openTime: string, closeTime: string): boolean {
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const [openHour, openMinute] = openTime.split(':').map(Number);
    const [closeHour, closeMinute] = closeTime.split(':').map(Number);

    if (currentHour === undefined || currentMinute === undefined ||
        openHour === undefined || openMinute === undefined ||
        closeHour === undefined || closeMinute === undefined) {
      return false;
    }

    const currentMinutes = currentHour * 60 + currentMinute;
    const openMinutes = openHour * 60 + openMinute;
    const closeMinutes = closeHour * 60 + closeMinute;

    // Handle cross-midnight times (e.g., 22:00 - 02:00)
    if (closeMinutes < openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    }

    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  }

  private async getNextOpenTime(currentTime: Date): Promise<string | undefined> {
    try {
      const allHours = await this.getAllBusinessHours();
      const currentDay = currentTime.getDay();
      
      // Check remaining days in the week
      for (let i = 1; i <= 7; i++) {
        const checkDay = (currentDay + i) % 7;
        const dayHours = allHours.find(h => h.day_of_week === checkDay);
        
        if (dayHours && dayHours.is_open) {
          const dayName = DAYS_OF_WEEK[checkDay];
          if (dayHours.is_24_hours) {
            return i === 1 ? 'besok' : dayName;
          } else {
            const timeStr = i === 1 ? `besok jam ${dayHours.open_time}` : `${dayName} jam ${dayHours.open_time}`;
            return timeStr + ' WIB';
          }
        }
      }
      
      return undefined;
    } catch (error) {
      logger.error('Failed to get next open time', { error });
      return undefined;
    }
  }
}

export const businessHoursService = new BusinessHoursService();