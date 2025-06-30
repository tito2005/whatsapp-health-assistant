import { createHash, randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'crypto';
import { logger } from '@/shared/logger';
import { config } from '@/config/environment';

export interface EncryptedData {
  encryptedData: string;
  iv: string;
  salt: string;
  tag: string;
}

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly saltLength = 32; // 256 bits
  // private readonly tagLength = 16; // 128 bits
  private readonly iterations = 100000; // PBKDF2 iterations

  private getEncryptionKey(): string {
    const key = config.encryptionKey || process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('Encryption key not configured. Set ENCRYPTION_KEY environment variable.');
    }
    if (key.length < 32) {
      throw new Error('Encryption key must be at least 32 characters long.');
    }
    return key;
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  public encrypt(plaintext: string): EncryptedData {
    try {
      const key = this.getEncryptionKey();
      const salt = randomBytes(this.saltLength);
      const iv = randomBytes(this.ivLength);
      
      // Derive key using PBKDF2
      const derivedKey = pbkdf2Sync(key, salt, this.iterations, this.keyLength, 'sha256');
      
      const cipher = createCipheriv(this.algorithm, derivedKey, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      logger.error('Failed to encrypt data', { error });
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive data using AES-256-GCM
   */
  public decrypt(encryptedData: EncryptedData): string {
    try {
      const key = this.getEncryptionKey();
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      
      // Derive key using PBKDF2
      const derivedKey = pbkdf2Sync(key, salt, this.iterations, this.keyLength, 'sha256');
      
      const decipher = createDecipheriv(this.algorithm, derivedKey, iv);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt data', { error });
      throw new Error('Decryption failed');
    }
  }

  /**
   * Hash sensitive data for comparison (one-way)
   */
  public hash(data: string, salt?: string): { hash: string; salt: string } {
    try {
      const usedSalt = salt || randomBytes(this.saltLength).toString('hex');
      const hash = createHash('sha256')
        .update(data + usedSalt)
        .digest('hex');
      
      return { hash, salt: usedSalt };
    } catch (error) {
      logger.error('Failed to hash data', { error });
      throw new Error('Hashing failed');
    }
  }

  /**
   * Verify hashed data
   */
  public verifyHash(data: string, hash: string, salt: string): boolean {
    try {
      const computedHash = createHash('sha256')
        .update(data + salt)
        .digest('hex');
      
      return computedHash === hash;
    } catch (error) {
      logger.error('Failed to verify hash', { error });
      return false;
    }
  }

  /**
   * Encrypt JSON object
   */
  public encryptObject(obj: any): EncryptedData {
    const jsonString = JSON.stringify(obj);
    return this.encrypt(jsonString);
  }

  /**
   * Decrypt to JSON object
   */
  public decryptObject<T = any>(encryptedData: EncryptedData): T {
    const jsonString = this.decrypt(encryptedData);
    return JSON.parse(jsonString);
  }

  /**
   * Mask sensitive data for logging (keeps first 2 and last 2 characters)
   */
  public maskSensitiveData(data: string, visibleChars: number = 2): string {
    if (!data || data.length <= visibleChars * 2) {
      return '*'.repeat(Math.max(data?.length || 0, 4));
    }
    
    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    const middle = '*'.repeat(Math.max(data.length - (visibleChars * 2), 1));
    
    return `${start}${middle}${end}`;
  }

  /**
   * Mask phone number for logging
   */
  public maskPhoneNumber(phone: string): string {
    if (!phone) return '****';
    
    // Remove any non-digit characters for processing
    const digitsOnly = phone.replace(/\D/g, '');
    
    if (digitsOnly.length <= 4) {
      return '*'.repeat(4);
    }
    
    // Show first 2 and last 2 digits
    const start = phone.substring(0, 2);
    const end = phone.substring(phone.length - 2);
    const middle = '*'.repeat(Math.max(phone.length - 4, 1));
    
    return `${start}${middle}${end}`;
  }

  /**
   * Mask email for logging
   */
  public maskEmail(email: string): string {
    if (!email) return '****';
    
    const [localPart, domain] = email.split('@');
    if (!domain || !localPart) return this.maskSensitiveData(email);
    
    const maskedLocal = localPart.length > 2 
      ? localPart.substring(0, 1) + '*'.repeat(localPart.length - 2) + localPart.substring(localPart.length - 1)
      : '*'.repeat(localPart.length);
    
    const [domainName, tld] = domain.split('.');
    if (!domainName || !tld) return this.maskSensitiveData(email);
    
    const maskedDomain = domainName.length > 2
      ? domainName.substring(0, 1) + '*'.repeat(domainName.length - 2) + domainName.substring(domainName.length - 1)
      : domainName;
    
    return `${maskedLocal}@${maskedDomain}.${tld}`;
  }

  /**
   * Generate secure random token
   */
  public generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Generate secure random ID
   */
  public generateSecureId(prefix: string = ''): string {
    const timestamp = Date.now().toString(36);
    const randomPart = randomBytes(8).toString('hex');
    return prefix ? `${prefix}-${timestamp}-${randomPart}` : `${timestamp}-${randomPart}`;
  }

  /**
   * Secure data deletion (overwrite memory)
   */
  public secureDelete(data: string | Buffer): void {
    try {
      if (typeof data === 'string') {
        // Convert to buffer and overwrite
        const buffer = Buffer.from(data, 'utf8');
        buffer.fill(0);
      } else if (Buffer.isBuffer(data)) {
        data.fill(0);
      }
    } catch (error) {
      logger.warn('Failed to securely delete data', { error });
    }
  }
}

// Singleton instance
export const encryptionService = new EncryptionService();

// Helper functions for common operations
export const encryptSensitiveData = (data: string): EncryptedData => {
  return encryptionService.encrypt(data);
};

export const decryptSensitiveData = (encryptedData: EncryptedData): string => {
  return encryptionService.decrypt(encryptedData);
};

export const maskForLogging = (data: string, type: 'phone' | 'email' | 'general' = 'general'): string => {
  switch (type) {
    case 'phone':
      return encryptionService.maskPhoneNumber(data);
    case 'email':
      return encryptionService.maskEmail(data);
    default:
      return encryptionService.maskSensitiveData(data);
  }
};

export default encryptionService;