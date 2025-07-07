import { logger } from '@/shared/logger';
import { maskForLogging } from '@/shared/encryption';
import { NextFunction, Request, Response } from 'express';

export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CLAUDE_API_ERROR = 'CLAUDE_API_ERROR',
  WHATSAPP_ERROR = 'WHATSAPP_ERROR',
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// These exports are available from ErrorType enum
// Commented out to avoid ESLint unused variable warnings
// export const {
//   VALIDATION_ERROR,
//   AUTHENTICATION_ERROR,
//   AUTHORIZATION_ERROR,
//   RATE_LIMIT_ERROR,
//   NETWORK_ERROR,
//   DATABASE_ERROR,
//   CLAUDE_API_ERROR,
//   WHATSAPP_ERROR,
//   BUSINESS_LOGIC_ERROR,
//   SYSTEM_ERROR,
//   UNKNOWN_ERROR
// } = ErrorType;
 

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// These exports are available from ErrorSeverity enum
// Commented out to avoid ESLint unused variable warnings
// export const {
//   LOW,
//   MEDIUM,
//   HIGH,
//   CRITICAL
// } = ErrorSeverity;
 

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly type: ErrorType | undefined;
  public readonly severity: ErrorSeverity | undefined;
  public readonly retryable: boolean | undefined;
  public readonly userMessage: string | undefined;
  public readonly metadata: Record<string, any> | undefined;

  constructor(
    message: string, 
    statusCode: number, 
    isOperational = true,
    options?: {
      type?: ErrorType;
      severity?: ErrorSeverity;
      retryable?: boolean;
      userMessage?: string;
      metadata?: Record<string, any>;
    }
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.type = options?.type;
    this.severity = options?.severity;
    this.retryable = options?.retryable;
    this.userMessage = options?.userMessage;
    this.metadata = options?.metadata;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    isOperational = error.isOperational;
  }

  // Log error
  logger.error('Error occurred', {
    error: {
      message: error.message,
      stack: error.stack,
      statusCode,
      isOperational,
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
    }),
  });
};

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

export const asyncHandler = (
  fn: (_req: Request, _res: Response, _next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// WhatsApp-specific error handler for chatbot scenarios
export class ChatbotErrorHandler {
  private static fallbackResponses: Map<ErrorType, string[]> = new Map([
    [ErrorType.CLAUDE_API_ERROR, [
      'Maaf, sistem AI sedang mengalami gangguan. Silakan coba lagi dalam beberapa saat.',
      'Ada kendala teknis dengan layanan AI. Tim kami sedang menanganinya.',
      'Sistem sedang sibuk. Mohon tunggu sebentar dan coba lagi ya.'
    ]],
    [ErrorType.DATABASE_ERROR, [
      'Maaf, ada gangguan pada sistem database. Silakan coba lagi.',
      'Terjadi kendala teknis. Data Anda aman, mohon coba beberapa saat lagi.',
      'Sistem sedang dalam perbaikan. Silakan hubungi admin jika masalah berlanjut.'
    ]],
    [ErrorType.WHATSAPP_ERROR, [
      'Maaf, ada masalah dengan koneksi WhatsApp. Silakan coba kirim pesan lagi.',
      'Koneksi WhatsApp tidak stabil. Mohon tunggu sebentar.',
      'Ada gangguan pada layanan WhatsApp. Tim teknis sedang menangani.'
    ]],
    [ErrorType.NETWORK_ERROR, [
      'Koneksi internet bermasalah. Silakan periksa koneksi Anda.',
      'Jaringan sedang tidak stabil. Mohon coba lagi dalam beberapa menit.',
      'Ada kendala koneksi. Pastikan internet Anda aktif dan coba lagi.'
    ]],
    [ErrorType.RATE_LIMIT_ERROR, [
      'Anda mengirim pesan terlalu cepat. Mohon tunggu sebentar sebelum mengirim lagi.',
      'Sistem membatasi kecepatan pesan untuk menjaga kualitas layanan.',
      'Terlalu banyak permintaan. Silakan coba lagi dalam 1-2 menit.'
    ]],
    [ErrorType.VALIDATION_ERROR, [
      'Ada kesalahan dalam format data yang Anda kirim. Silakan periksa kembali.',
      'Data yang dimasukkan tidak sesuai format. Mohon dicek lagi.',
      'Format pesan tidak valid. Silakan ikuti petunjuk yang diberikan.'
    ]],
    [ErrorType.BUSINESS_LOGIC_ERROR, [
      'Ada kesalahan dalam proses bisnis. Silakan hubungi admin.',
      'Terjadi kendala dalam memproses permintaan Anda.',
      'Mohon maaf, ada masalah dengan proses yang Anda lakukan.'
    ]],
    [ErrorType.SYSTEM_ERROR, [
      'Sistem sedang mengalami gangguan. Tim teknis sudah diberitahu.',
      'Terjadi kesalahan sistem. Mohon coba lagi atau hubungi support.',
      'Ada masalah teknis yang sedang kami perbaiki.'
    ]]
  ]);

  /**
   * Handle chatbot errors and return user-friendly message
   */
  public static handleChatbotError(
    error: Error,
    context?: {
      userId?: string;
      operation?: string;
      additionalData?: Record<string, any>;
    }
  ): string {
    const appError = this.normalizeError(error);
    
    // Log error with appropriate level based on severity
    this.logError(appError, context);

    // Return user-friendly message
    return this.getUserMessage(appError);
  }

  /**
   * Convert any error to normalized AppError format
   */
  private static normalizeError(error: Error): AppError {
    if (error instanceof AppError && error.type) {
      return error;
    }

    // Determine error type based on error characteristics
    const type = this.classifyError(error);
    const severity = this.determineSeverity(type, error);
    const statusCode = this.getStatusCode(error);

    return new AppError(
      error.message,
      statusCode,
      true,
      {
        type,
        severity,
        retryable: this.isRetryable(type),
        metadata: { originalError: error.name }
      }
    );
  }

  /**
   * Log error with appropriate level and context
   */
  private static logError(
    error: AppError,
    context?: {
      userId?: string;
      operation?: string;
      additionalData?: Record<string, any>;
    }
  ): void {
    const logData = {
      type: error.type,
      severity: error.severity,
      statusCode: error.statusCode,
      retryable: error.retryable,
      userId: context?.userId ? maskForLogging(context.userId, 'general') : undefined,
      operation: context?.operation,
      metadata: error.metadata,
      additionalData: context?.additionalData,
      stack: error.stack
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error('Critical chatbot error occurred', logData);
        break;
      case ErrorSeverity.HIGH:
        logger.error('High severity chatbot error', logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('Medium severity chatbot error', logData);
        break;
      case ErrorSeverity.LOW:
        logger.info('Low severity chatbot error', logData);
        break;
      default:
        logger.warn('Unclassified chatbot error', logData);
    }
  }

  /**
   * Get user-friendly error message for WhatsApp
   */
  private static getUserMessage(error: AppError): string {
    // Use custom user message if provided
    if (error.userMessage) {
      return error.userMessage;
    }

    // Get fallback messages for error type
    const errorType = error.type || ErrorType.UNKNOWN_ERROR;
    const fallbackMessages = this.fallbackResponses.get(errorType);
    if (fallbackMessages && fallbackMessages.length > 0) {
      // Return random fallback message to avoid repetition
      const randomIndex = Math.floor(Math.random() * fallbackMessages.length);
      return fallbackMessages[randomIndex] || 'Terjadi kesalahan sistem.';
    }

    // Default fallback
    return 'Maaf, terjadi kesalahan yang tidak terduga. Silakan coba lagi atau hubungi admin jika masalah berlanjut.';
  }

  /**
   * Classify error type based on error characteristics
   */
  private static classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();
    const errorCode = (error as any).code;

    // Network errors
    if (errorCode === 'ECONNRESET' || 
        errorCode === 'ECONNREFUSED' ||
        errorCode === 'ETIMEDOUT' ||
        errorCode === 'ENOTFOUND' ||
        message.includes('network') ||
        message.includes('connection')) {
      return ErrorType.NETWORK_ERROR;
    }

    // Claude API errors
    if (message.includes('anthropic') ||
        message.includes('claude') ||
        message.includes('api') && message.includes('rate limit') ||
        message.includes('overloaded')) {
      return ErrorType.CLAUDE_API_ERROR;
    }

    // Database errors
    if (message.includes('database') ||
        message.includes('sqlite') ||
        errorCode?.startsWith('SQLITE_') ||
        message.includes('sql')) {
      return ErrorType.DATABASE_ERROR;
    }

    // WhatsApp/Baileys errors
    if (message.includes('baileys') ||
        message.includes('whatsapp') ||
        message.includes('qr') ||
        errorName.includes('baileys')) {
      return ErrorType.WHATSAPP_ERROR;
    }

    // Rate limiting
    if (message.includes('rate limit') ||
        message.includes('too many requests') ||
        (error as any).statusCode === 429) {
      return ErrorType.RATE_LIMIT_ERROR;
    }

    // Authentication/Authorization
    if ((error as any).statusCode === 401 ||
        message.includes('unauthorized') ||
        message.includes('authentication')) {
      return ErrorType.AUTHENTICATION_ERROR;
    }

    if ((error as any).statusCode === 403 ||
        message.includes('forbidden') ||
        message.includes('authorization')) {
      return ErrorType.AUTHORIZATION_ERROR;
    }

    // Validation errors
    if ((error as any).statusCode === 400 ||
        message.includes('validation') ||
        message.includes('invalid') ||
        errorName.includes('validation')) {
      return ErrorType.VALIDATION_ERROR;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * Determine error severity
   */
  private static determineSeverity(type: ErrorType, error: Error): ErrorSeverity {
    // Critical errors that require immediate attention
    if (type === ErrorType.SYSTEM_ERROR ||
        type === ErrorType.DATABASE_ERROR ||
        (error as any).statusCode >= 500) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors
    if (type === ErrorType.CLAUDE_API_ERROR ||
        type === ErrorType.WHATSAPP_ERROR ||
        type === ErrorType.AUTHENTICATION_ERROR) {
      return ErrorSeverity.HIGH;
    }

    // Medium severity errors
    if (type === ErrorType.NETWORK_ERROR ||
        type === ErrorType.BUSINESS_LOGIC_ERROR ||
        type === ErrorType.AUTHORIZATION_ERROR) {
      return ErrorSeverity.MEDIUM;
    }

    // Low severity errors
    return ErrorSeverity.LOW;
  }

  /**
   * Get appropriate HTTP status code from error
   */
  private static getStatusCode(error: Error): number {
    if ((error as any).statusCode) {
      return (error as any).statusCode;
    }
    if ((error as any).status) {
      return (error as any).status;
    }
    return 500; // Default to internal server error
  }

  /**
   * Check if error type is retryable
   */
  private static isRetryable(type: ErrorType): boolean {
    const retryableTypes = [
      ErrorType.NETWORK_ERROR,
      ErrorType.CLAUDE_API_ERROR,
      ErrorType.DATABASE_ERROR,
      ErrorType.RATE_LIMIT_ERROR
    ];

    return retryableTypes.includes(type);
  }

  /**
   * Create specific error types for common scenarios
   */
  public static createClaudeApiError(
    message: string,
    originalError?: Error
  ): AppError {
    return new AppError(
      message,
      503,
      true,
      {
        type: ErrorType.CLAUDE_API_ERROR,
        severity: ErrorSeverity.HIGH,
        retryable: true,
        userMessage: 'Maaf, sistem AI sedang mengalami gangguan. Silakan coba lagi dalam beberapa saat.',
        metadata: { originalError: originalError?.name }
      }
    );
  }

  public static createDatabaseError(
    message: string,
    originalError?: Error
  ): AppError {
    return new AppError(
      message,
      500,
      true,
      {
        type: ErrorType.DATABASE_ERROR,
        severity: ErrorSeverity.CRITICAL,
        retryable: true,
        userMessage: 'Terjadi kendala teknis. Data Anda aman, mohon coba beberapa saat lagi.',
        metadata: { originalError: originalError?.name }
      }
    );
  }

  public static createValidationError(
    message: string,
    field?: string
  ): AppError {
    return new AppError(
      message,
      400,
      true,
      {
        type: ErrorType.VALIDATION_ERROR,
        severity: ErrorSeverity.LOW,
        retryable: false,
        userMessage: 'Data yang dimasukkan tidak sesuai format. Mohon dicek lagi.',
        metadata: { field }
      }
    );
  }

  public static createBusinessLogicError(
    message: string,
    userMessage?: string
  ): AppError {
    return new AppError(
      message,
      422,
      true,
      {
        type: ErrorType.BUSINESS_LOGIC_ERROR,
        severity: ErrorSeverity.MEDIUM,
        retryable: false,
        userMessage: userMessage || 'Terjadi kendala dalam memproses permintaan Anda.',
        metadata: {}
      }
    );
  }

  /**
   * Handle async operation with error handling for WhatsApp context
   */
  public static async handleAsync<T>(
    operation: () => Promise<T>,
    context?: {
      userId?: string;
      operation?: string;
      additionalData?: Record<string, any>;
    }
  ): Promise<{ success: true; data: T } | { success: false; error: string }> {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      const userMessage = this.handleChatbotError(error as Error, context);
      return { success: false, error: userMessage };
    }
  }
}