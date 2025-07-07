import { logger } from '@/shared/logger';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
  retryCondition?: (_error: any) => boolean;
  onRetry?: (_attempt: number, _error: any) => void;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeout?: number;
  monitoringPeriod?: number;
  halfOpenMaxCalls?: number;
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

// These exports are available from CircuitBreakerState enum
// Commented out to avoid ESLint unused variable warnings
// export const {
//   CLOSED,
//   OPEN,
//   HALF_OPEN
// } = CircuitBreakerState;
 

export class RetryService {
  /**
   * Execute a function with exponential backoff retry
   */
  public static async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      backoffFactor = 2,
      jitter = true,
      retryCondition = () => true,
      onRetry
    } = options;

    let lastError: any;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await fn();
        
        // Log successful execution if there were previous failures
        if (attempt > 1) {
          logger.info('Operation succeeded after retry', { 
            attempt, 
            totalAttempts: maxAttempts 
          });
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        logger.warn('Operation failed, checking retry conditions', {
          attempt,
          maxAttempts,
          error: error instanceof Error ? error.message : String(error)
        });

        // Check if we should retry this error
        if (!retryCondition(error)) {
          logger.error('Retry condition not met, throwing error', { error });
          throw error;
        }

        // Don't wait on the last attempt
        if (attempt === maxAttempts) {
          break;
        }

        // Call onRetry callback if provided
        if (onRetry) {
          try {
            onRetry(attempt, error);
          } catch (callbackError) {
            logger.warn('onRetry callback failed', { callbackError });
          }
        }

        // Calculate delay with exponential backoff
        const currentDelay = Math.min(delay, maxDelay);
        const actualDelay = jitter 
          ? currentDelay * (0.5 + Math.random() * 0.5) // Add jitter (50-100% of delay)
          : currentDelay;

        logger.info('Retrying operation', {
          attempt,
          nextAttempt: attempt + 1,
          delayMs: Math.round(actualDelay)
        });

        await this.sleep(actualDelay);
        delay *= backoffFactor;
      }
    }

    logger.error('Operation failed after all retry attempts', {
      maxAttempts,
      finalError: lastError instanceof Error ? lastError.message : String(lastError)
    });
    
    throw lastError;
  }

  /**
   * Create a retry wrapper for a function
   */
  public static createRetryWrapper<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    options: RetryOptions = {}
  ): (..._args: T) => Promise<R> {
    return async (..._args: T): Promise<R> => {
      return this.executeWithRetry(() => fn(..._args), options);
    };
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Default retry condition for network/API errors
   */
  public static isRetryableError(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND') {
      return true;
    }

    // HTTP errors that are typically retryable
    if (error.response?.status) {
      const status = error.response.status;
      return status >= 500 || // Server errors
             status === 429 || // Rate limiting
             status === 408 || // Request timeout
             status === 409;   // Conflict (sometimes retryable)
    }

    // Claude API specific errors
    if (error.message?.includes('rate limit') ||
        error.message?.includes('timeout') ||
        error.message?.includes('overloaded')) {
      return true;
    }

    return false;
  }

  /**
   * Default retry condition for database errors
   */
  public static isDatabaseRetryableError(error: any): boolean {
    // SQLite specific errors
    if (error.code === 'SQLITE_BUSY' ||
        error.code === 'SQLITE_LOCKED' ||
        error.message?.includes('database is locked')) {
      return true;
    }

    // General database connection errors
    if (error.message?.includes('connection') ||
        error.message?.includes('timeout')) {
      return true;
    }

    return false;
  }
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;
  
  private readonly failureThreshold: number;
  private readonly recoveryTimeout: number;
  private readonly halfOpenMaxCalls: number;
  
  constructor(
    private _name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute
    this.halfOpenMaxCalls = options.halfOpenMaxCalls || 3;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
        logger.info('Circuit breaker transitioning to HALF_OPEN', { 
          name: this._name 
        });
      } else {
        const error = new Error(`Circuit breaker is OPEN for ${this._name}`);
        logger.warn('Circuit breaker rejecting call', { 
          name: this._name,
          state: this.state 
        });
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.halfOpenMaxCalls) {
        this.reset();
        logger.info('Circuit breaker reset to CLOSED', { 
          name: this._name,
          successCount: this.successCount 
        });
      }
    } else {
      this.reset();
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      logger.warn('Circuit breaker opened from HALF_OPEN', { 
        name: this._name,
        failureCount: this.failureCount 
      });
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      logger.warn('Circuit breaker opened due to failure threshold', { 
        name: this._name,
        failureCount: this.failureCount,
        threshold: this.failureThreshold 
      });
    }
  }

  /**
   * Reset circuit breaker to closed state
   */
  private reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
  }

  /**
   * Check if we should attempt to reset the circuit breaker
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.recoveryTimeout;
  }

  /**
   * Get current circuit breaker status
   */
  public getStatus(): {
    name: string;
    state: CircuitBreakerState;
    failureCount: number;
    lastFailureTime: number;
    successCount: number;
  } {
    return {
      name: this._name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }

  /**
   * Force circuit breaker to open state (for testing/manual intervention)
   */
  public forceOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    this.lastFailureTime = Date.now();
    logger.warn('Circuit breaker forced to OPEN state', { name: this._name });
  }

  /**
   * Force circuit breaker to closed state (for testing/manual intervention)
   */
  public forceClose(): void {
    this.reset();
    logger.info('Circuit breaker forced to CLOSED state', { name: this._name });
  }
}

// Singleton circuit breaker instances for common services
export const claudeCircuitBreaker = new CircuitBreaker('claude-api', {
  failureThreshold: 3,
  recoveryTimeout: 30000, // 30 seconds
  halfOpenMaxCalls: 2
});

export const databaseCircuitBreaker = new CircuitBreaker('database', {
  failureThreshold: 5,
  recoveryTimeout: 10000, // 10 seconds
  halfOpenMaxCalls: 3
});

// Helper functions for common retry scenarios
export const retryClaudeApiCall = async <T>(
  fn: () => Promise<T>
): Promise<T> => {
  return claudeCircuitBreaker.execute(() =>
    RetryService.executeWithRetry(fn, {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      retryCondition: RetryService.isRetryableError,
      onRetry: (attempt, error) => {
        logger.warn('Retrying Claude API call', {
          attempt,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })
  );
};

export const retryDatabaseOperation = async <T>(
  fn: () => Promise<T>
): Promise<T> => {
  return databaseCircuitBreaker.execute(() =>
    RetryService.executeWithRetry(fn, {
      maxAttempts: 3,
      initialDelay: 500,
      maxDelay: 5000,
      retryCondition: RetryService.isDatabaseRetryableError,
      onRetry: (attempt, error) => {
        logger.warn('Retrying database operation', {
          attempt,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })
  );
};

export default RetryService;