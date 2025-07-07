export interface BusinessHours {
  id: string;
  day_of_week: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  is_open: boolean;
  open_time: string; // HH:MM format (24-hour)
  close_time: string; // HH:MM format (24-hour)
  is_24_hours: boolean;
  timezone: string; // e.g., "Asia/Jakarta"
  special_note?: string; // Optional note for special conditions
  created_at: string;
  updated_at: string;
}

export interface BusinessHoursConfig {
  dayOfWeek: number;
  isOpen: boolean;
  openTime?: string | undefined;
  closeTime?: string | undefined;
  is24Hours?: boolean;
  specialNote?: string;
}

export interface BusinessStatus {
  isOpen: boolean;
  nextOpenTime?: string | undefined;
  nextCloseTime?: string | undefined;
  message: string;
  currentTime: string;
  timezone: string;
}

export interface SpecialSchedule {
  id: string;
  date: string; // YYYY-MM-DD format
  is_open: boolean;
  open_time?: string; // HH:MM format
  close_time?: string; // HH:MM format
  is_24_hours: boolean;
  reason: string; // Holiday, Special Event, etc.
  created_at: string;
  updated_at: string;
}

export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday', 
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
] as const;

export const DEFAULT_TIMEZONE = 'Asia/Jakarta';