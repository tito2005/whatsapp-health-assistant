import { logger } from '@/shared/logger';
import { databaseManager } from '@/config/database';
import { EscalationData, adminNotificationService } from '@/admin/admin-notification-service';
import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';

export interface QueuedEscalation {
  id: string;
  customerPhone: string;
  userQuery: string;
  aiResponse: string;
  validationIssues: string; // JSON string
  conversationContext: string; // JSON string
  timestamp: Date;
  status: 'queued' | 'notified' | 'resolved';
  businessHours: boolean;
  retryCount: number;
  lastRetryAt?: Date;
  resolvedAt?: Date;
  adminNotes?: string;
}

export class EscalationQueueService {
  private isInitialized = false;
  private processingQueue = false;

  constructor() {
    void this.initializeQueue();
    this.setupCronJobs();
  }

  private async initializeQueue(): Promise<void> {
    try {
      await databaseManager.waitForInitialization();
      await this.createEscalationTable();
      this.isInitialized = true;
      
      logger.info('EscalationQueueService initialized successfully');
      
      // Process any pending escalations on startup
      await this.processQueuedEscalations();
      
    } catch (error) {
      logger.error('Failed to initialize EscalationQueueService', { error });
    }
  }

  private async createEscalationTable(): Promise<void> {
    const connection = databaseManager.getConnection();
    
    await connection.run(`
      CREATE TABLE IF NOT EXISTS escalations (
        id TEXT PRIMARY KEY,
        customer_phone TEXT NOT NULL,
        user_query TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        validation_issues TEXT NOT NULL,
        conversation_context TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        business_hours BOOLEAN NOT NULL DEFAULT 0,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_retry_at DATETIME,
        resolved_at DATETIME,
        admin_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    await connection.run(`
      CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations (status)
    `);
    await connection.run(`
      CREATE INDEX IF NOT EXISTS idx_escalations_timestamp ON escalations (timestamp)
    `);
    await connection.run(`
      CREATE INDEX IF NOT EXISTS idx_escalations_customer ON escalations (customer_phone)
    `);

    logger.info('Escalation table and indexes created successfully');
  }

  private setupCronJobs(): void {
    // Process queued escalations every morning at 9 AM (WIB)
    cron.schedule('0 9 * * 1-5', async () => {
      logger.info('Running scheduled escalation processing (9 AM WIB)');
      await this.processQueuedEscalations();
    }, {
      timezone: 'Asia/Jakarta'
    });

    // Check for stuck escalations every hour during business hours
    cron.schedule('0 9-17 * * 1-5', async () => {
      await this.checkStuckEscalations();
    }, {
      timezone: 'Asia/Jakarta'
    });

    logger.info('Escalation queue cron jobs scheduled');
  }

  public async queueEscalation(escalationData: EscalationData): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('EscalationQueueService not initialized');
    }

    try {
      const connection = databaseManager.getConnection();
      const escalationId = uuidv4();
      
      const queuedEscalation: QueuedEscalation = {
        id: escalationId,
        customerPhone: escalationData.customerPhone,
        userQuery: escalationData.userQuery,
        aiResponse: escalationData.aiResponse,
        validationIssues: JSON.stringify(escalationData.validationResult.issues),
        conversationContext: JSON.stringify(escalationData.conversationContext),
        timestamp: escalationData.timestamp,
        status: 'queued',
        businessHours: escalationData.businessHours,
        retryCount: 0
      };

      await connection.run(`
        INSERT INTO escalations (
          id, customer_phone, user_query, ai_response, validation_issues,
          conversation_context, timestamp, status, business_hours, retry_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        queuedEscalation.id,
        queuedEscalation.customerPhone,
        queuedEscalation.userQuery,
        queuedEscalation.aiResponse,
        queuedEscalation.validationIssues,
        queuedEscalation.conversationContext,
        queuedEscalation.timestamp.toISOString(),
        queuedEscalation.status,
        queuedEscalation.businessHours ? 1 : 0,
        queuedEscalation.retryCount
      ]);

      logger.info('Escalation queued successfully', {
        escalationId,
        customerPhone: escalationData.customerPhone,
        businessHours: escalationData.businessHours
      });

      // If it's business hours, process immediately
      if (escalationData.businessHours) {
        void setImmediate(() => void this.processEscalation(escalationId));
      }

      return escalationId;

    } catch (error) {
      logger.error('Failed to queue escalation', {
        customerPhone: escalationData.customerPhone,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  public async processQueuedEscalations(): Promise<void> {
    if (this.processingQueue) {
      logger.info('Queue processing already in progress, skipping');
      return;
    }

    this.processingQueue = true;

    try {
      const connection = databaseManager.getConnection();
      
      // Get all queued escalations
      const queuedEscalations = await connection.all(`
        SELECT * FROM escalations 
        WHERE status = 'queued' 
        ORDER BY timestamp ASC
      `) as QueuedEscalation[];

      if (queuedEscalations.length === 0) {
        logger.info('No queued escalations to process');
        return;
      }

      logger.info('Processing queued escalations', {
        count: queuedEscalations.length
      });

      // Send batch notification if multiple escalations
      if (queuedEscalations.length > 1) {
        await this.sendBatchNotification(queuedEscalations);
      }

      // Process each escalation
      for (const escalation of queuedEscalations) {
        await this.processEscalation(escalation.id);
        
        // Add delay between notifications to avoid rate limiting
        await this.delay(2000);
      }

      logger.info('Finished processing queued escalations', {
        processed: queuedEscalations.length
      });

    } catch (error) {
      logger.error('Failed to process queued escalations', { error });
    } finally {
      this.processingQueue = false;
    }
  }

  private async processEscalation(escalationId: string): Promise<void> {
    try {
      const connection = databaseManager.getConnection();
      
      // Get escalation data
      const escalationRow = await connection.get(`
        SELECT * FROM escalations WHERE id = ?
      `, [escalationId]) as QueuedEscalation | undefined;

      if (!escalationRow) {
        logger.warn('Escalation not found', { escalationId });
        return;
      }

      if (escalationRow.status !== 'queued') {
        logger.info('Escalation already processed', {
          escalationId,
          status: escalationRow.status
        });
        return;
      }

      // Convert to EscalationData format
      const escalationData: EscalationData = {
        id: escalationRow.id,
        customerPhone: escalationRow.customerPhone,
        userQuery: escalationRow.userQuery,
        aiResponse: escalationRow.aiResponse,
        validationResult: {
          isValid: false,
          confidence: 0,
          issues: JSON.parse(escalationRow.validationIssues),
          shouldEscalate: true
        },
        conversationContext: JSON.parse(escalationRow.conversationContext),
        timestamp: new Date(escalationRow.timestamp),
        status: 'pending',
        businessHours: escalationRow.businessHours
      };

      // Send notification
      const notificationResult = await adminNotificationService.sendEscalationNotification(escalationData);

      if (notificationResult.success) {
        // Mark as notified
        await connection.run(`
          UPDATE escalations 
          SET status = 'notified', last_retry_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [escalationId]);

        logger.info('Escalation processed successfully', {
          escalationId,
          whatsappSent: notificationResult.whatsappSent,
          emailSent: notificationResult.emailSent
        });
      } else {
        // Increment retry count
        await connection.run(`
          UPDATE escalations 
          SET retry_count = retry_count + 1, last_retry_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [escalationId]);

        logger.error('Failed to process escalation', {
          escalationId,
          error: notificationResult.error,
          retryCount: escalationRow.retryCount + 1
        });
      }

    } catch (error) {
      logger.error('Error processing escalation', {
        escalationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async sendBatchNotification(escalations: QueuedEscalation[]): Promise<void> {
    // Convert to EscalationData format for batch notification
    const escalationDataList: EscalationData[] = escalations.map(esc => ({
      id: esc.id,
      customerPhone: esc.customerPhone,
      userQuery: esc.userQuery,
      aiResponse: esc.aiResponse,
      validationResult: {
        isValid: false,
        confidence: 0,
        issues: JSON.parse(esc.validationIssues),
        shouldEscalate: true
      },
      conversationContext: JSON.parse(esc.conversationContext),
      timestamp: new Date(esc.timestamp),
      status: 'pending',
      businessHours: esc.businessHours
    }));

    await adminNotificationService.sendQueuedNotifications(escalationDataList);
  }

  private async checkStuckEscalations(): Promise<void> {
    try {
      const connection = databaseManager.getConnection();
      
      // Find escalations that have been queued for more than 24 hours
      const stuckEscalations = await connection.all(`
        SELECT * FROM escalations 
        WHERE status = 'queued' 
        AND datetime(timestamp) < datetime('now', '-1 day')
        AND retry_count < 3
      `) as QueuedEscalation[];

      if (stuckEscalations.length > 0) {
        logger.warn('Found stuck escalations', {
          count: stuckEscalations.length,
          escalationIds: stuckEscalations.map(e => e.id)
        });

        // Retry stuck escalations
        for (const escalation of stuckEscalations) {
          await this.processEscalation(escalation.id);
        }
      }

    } catch (error) {
      logger.error('Failed to check stuck escalations', { error });
    }
  }

  public async getQueueStatus(): Promise<{
    total: number;
    queued: number;
    notified: number;
    resolved: number;
    failed: number;
  }> {
    try {
      const connection = databaseManager.getConnection();
      
      const stats = await connection.all(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued,
          SUM(CASE WHEN status = 'notified' THEN 1 ELSE 0 END) as notified,
          SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
          SUM(CASE WHEN retry_count >= 3 THEN 1 ELSE 0 END) as failed
        FROM escalations
      `);

      return stats[0] || { total: 0, queued: 0, notified: 0, resolved: 0, failed: 0 };

    } catch (error) {
      logger.error('Failed to get queue status', { error });
      return { total: 0, queued: 0, notified: 0, resolved: 0, failed: 0 };
    }
  }

  public async markEscalationResolved(escalationId: string, adminNotes?: string): Promise<void> {
    try {
      const connection = databaseManager.getConnection();
      
      await connection.run(`
        UPDATE escalations 
        SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [adminNotes || null, escalationId]);

      logger.info('Escalation marked as resolved', {
        escalationId,
        adminNotes: adminNotes ? 'provided' : 'none'
      });

    } catch (error) {
      logger.error('Failed to mark escalation as resolved', {
        escalationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  public async getEscalationHistory(customerPhone: string, limit = 10): Promise<QueuedEscalation[]> {
    try {
      const connection = databaseManager.getConnection();
      
      const escalations = await connection.all(`
        SELECT * FROM escalations 
        WHERE customer_phone = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `, [customerPhone, limit]) as QueuedEscalation[];

      return escalations;

    } catch (error) {
      logger.error('Failed to get escalation history', {
        customerPhone,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  public async cleanupOldEscalations(): Promise<void> {
    try {
      const connection = databaseManager.getConnection();
      
      // Delete escalations older than 30 days
      const result = await connection.run(`
        DELETE FROM escalations 
        WHERE datetime(timestamp) < datetime('now', '-30 days')
      `);

      logger.info('Old escalations cleaned up', {
        deletedCount: result.changes || 0
      });

    } catch (error) {
      logger.error('Failed to cleanup old escalations', { error });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async forceProcessQueue(): Promise<void> {
    logger.info('Force processing escalation queue');
    await this.processQueuedEscalations();
  }

  public isQueueProcessing(): boolean {
    return this.processingQueue;
  }
}

export const escalationQueueService = new EscalationQueueService();