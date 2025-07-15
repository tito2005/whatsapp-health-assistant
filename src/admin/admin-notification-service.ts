import { logger } from '@/shared/logger';
import { config } from '@/config/environment';
import { ValidationResult } from '@/validation/context-validator';
import { WhatsAppService } from '@/whatsapp/whatsapp-service';
import nodemailer from 'nodemailer';

export interface EscalationData {
  id: string;
  customerPhone: string;
  userQuery: string;
  aiResponse: string;
  validationResult: ValidationResult;
  conversationContext: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  timestamp: Date;
  status: 'pending' | 'notified' | 'resolved';
  businessHours: boolean;
}

export interface NotificationResult {
  success: boolean;
  whatsappSent: boolean;
  emailSent: boolean;
  error?: string | undefined;
}

export class AdminNotificationService {
  private emailTransporter: nodemailer.Transporter | null = null;
  private whatsappService: WhatsAppService | null = null;

  constructor() {
    this.initializeEmailTransporter();
  }

  public setWhatsAppService(whatsappService: WhatsAppService): void {
    this.whatsappService = whatsappService;
  }

  private initializeEmailTransporter(): void {
    try {
      // Configure email transporter (using Gmail SMTP as example)
      this.emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.adminEmail,
          pass: config.adminEmailPassword
        }
      });

      logger.info('Email transporter initialized for admin notifications');
    } catch (error) {
      logger.warn('Failed to initialize email transporter', { error });
      // Continue without email - WhatsApp will be primary notification method
    }
  }

  public async sendEscalationNotification(escalationData: EscalationData): Promise<NotificationResult> {
    logger.info('Sending escalation notification', {
      escalationId: escalationData.id,
      customerPhone: escalationData.customerPhone,
      businessHours: escalationData.businessHours
    });

    let whatsappSent = false;
    let emailSent = false;
    let error: string | undefined;

    try {
      // Always try WhatsApp first (primary notification method)
      whatsappSent = await this.sendWhatsAppNotification(escalationData);

      // Send email as backup (if available)
      if (this.emailTransporter) {
        emailSent = await this.sendEmailNotification(escalationData);
      }

      const success = whatsappSent || emailSent;

      if (success) {
        logger.info('Escalation notification sent successfully', {
          escalationId: escalationData.id,
          whatsappSent,
          emailSent
        });
      } else {
        error = 'All notification methods failed';
        logger.error('Failed to send escalation notification', {
          escalationId: escalationData.id,
          error
        });
      }

      return {
        success,
        whatsappSent,
        emailSent,
        error
      };

    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Escalation notification error', {
        escalationId: escalationData.id,
        error
      });

      return {
        success: false,
        whatsappSent: false,
        emailSent: false,
        error
      };
    }
  }

  private async sendWhatsAppNotification(escalationData: EscalationData): Promise<boolean> {
    if (!this.whatsappService) {
      logger.warn('WhatsApp service not available for admin notification');
      return false;
    }

    try {
      const message = this.formatWhatsAppMessage(escalationData);
      
      // Send to admin phone number
      const adminPhone = config.businessPhone2; // 081277721866
      
      await this.whatsappService.sendMessage(adminPhone, message);
      
      logger.info('WhatsApp escalation notification sent', {
        escalationId: escalationData.id,
        adminPhone: adminPhone.substring(0, 8) + '***'
      });

      return true;

    } catch (error) {
      logger.error('Failed to send WhatsApp escalation notification', {
        escalationId: escalationData.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  private formatWhatsAppMessage(escalationData: EscalationData): string {
    const timestamp = escalationData.timestamp.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const issuesSummary = escalationData.validationResult.issues
      .filter(issue => ['critical', 'high'].includes(issue.severity))
      .map(issue => `• ${issue.description}`)
      .join('\n');

    const contextMessages = escalationData.conversationContext
      .slice(-3) // Last 3 messages for context
      .map(msg => `${msg.role === 'user' ? '👤' : '🤖'} ${msg.content}`)
      .join('\n\n');

    return `🚨 *CHATBOT ESCALATION*

👤 *Customer:* ${escalationData.customerPhone}
⏰ *Time:* ${timestamp} WIB
🎯 *Confidence:* ${Math.round(escalationData.validationResult.confidence * 100)}%

📝 *User Query:*
${escalationData.userQuery}

🤖 *Bot Response:*
${escalationData.aiResponse.substring(0, 200)}${escalationData.aiResponse.length > 200 ? '...' : ''}

⚠️ *Issues Detected:*
${issuesSummary}

💬 *Recent Context:*
${contextMessages}

---
⚡ *ACTION REQUIRED:* Please reply directly to customer at ${escalationData.customerPhone}

#escalation #${escalationData.id}`;
  }

  private async sendEmailNotification(escalationData: EscalationData): Promise<boolean> {
    if (!this.emailTransporter) {
      return false;
    }

    try {
      const htmlContent = this.formatEmailContent(escalationData);
      
      const mailOptions = {
        from: process.env.ADMIN_EMAIL_USER || 'chatbot@arverid.com',
        to: 'arverid@gmail.com',
        subject: `🚨 Chatbot Escalation - Customer ${escalationData.customerPhone}`,
        html: htmlContent
      };

      await this.emailTransporter.sendMail(mailOptions);
      
      logger.info('Email escalation notification sent', {
        escalationId: escalationData.id
      });

      return true;

    } catch (error) {
      logger.error('Failed to send email escalation notification', {
        escalationId: escalationData.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  private formatEmailContent(escalationData: EscalationData): string {
    const timestamp = escalationData.timestamp.toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const issuesHtml = escalationData.validationResult.issues
      .map(issue => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; background-color: ${this.getIssueSeverityColor(issue.severity)};">
            <strong>${issue.type}</strong>
          </td>
          <td style="padding: 8px; border: 1px solid #ddd;">
            ${issue.severity.toUpperCase()}
          </td>
          <td style="padding: 8px; border: 1px solid #ddd;">
            ${issue.description}
          </td>
        </tr>
      `).join('');

    const contextHtml = escalationData.conversationContext
      .slice(-5) // Last 5 messages for email
      .map(msg => `
        <div style="margin: 10px 0; padding: 10px; background-color: ${msg.role === 'user' ? '#e3f2fd' : '#f3e5f5'}; border-radius: 5px;">
          <strong>${msg.role === 'user' ? '👤 Customer' : '🤖 Chatbot'}:</strong><br>
          ${msg.content}
          <small style="color: #666; display: block; margin-top: 5px;">
            ${msg.timestamp.toLocaleString('id-ID')}
          </small>
        </div>
      `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Chatbot Escalation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px;">
            🚨 Chatbot Escalation Alert
        </h1>
        
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #856404;">Escalation Details</h3>
            <p><strong>Customer Phone:</strong> ${escalationData.customerPhone}</p>
            <p><strong>Timestamp:</strong> ${timestamp} WIB</p>
            <p><strong>Escalation ID:</strong> ${escalationData.id}</p>
            <p><strong>Validation Confidence:</strong> ${Math.round(escalationData.validationResult.confidence * 100)}%</p>
            <p><strong>Business Hours:</strong> ${escalationData.businessHours ? 'Yes' : 'No'}</p>
        </div>

        <div style="margin: 20px 0;">
            <h3>📝 User Query</h3>
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3;">
                ${escalationData.userQuery}
            </div>
        </div>

        <div style="margin: 20px 0;">
            <h3>🤖 Bot Response</h3>
            <div style="background-color: #f3e5f5; padding: 15px; border-radius: 5px; border-left: 4px solid #9c27b0;">
                ${escalationData.aiResponse}
            </div>
        </div>

        <div style="margin: 20px 0;">
            <h3>⚠️ Validation Issues</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
                <thead>
                    <tr style="background-color: #f5f5f5;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Issue Type</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Severity</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Description</th>
                    </tr>
                </thead>
                <tbody>
                    ${issuesHtml}
                </tbody>
            </table>
        </div>

        <div style="margin: 20px 0;">
            <h3>💬 Conversation Context</h3>
            ${contextHtml}
        </div>

        <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #155724;">⚡ Action Required</h3>
            <p>Please contact the customer directly at <strong>${escalationData.customerPhone}</strong> to resolve their inquiry.</p>
            <p>The customer is not aware that their query was escalated - they just received a standard "technical issue" message.</p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
            WhatsApp Health Assistant - Automated Escalation System<br>
            Generated: ${new Date().toLocaleString('id-ID')} WIB
        </div>
    </div>
</body>
</html>`;
  }

  private getIssueSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#ffebee';
      case 'high': return '#fff3e0';
      case 'medium': return '#fffde7';
      case 'low': return '#f3e5f5';
      default: return '#f5f5f5';
    }
  }

  public async sendQueuedNotifications(queuedEscalations: EscalationData[]): Promise<void> {
    if (queuedEscalations.length === 0) {
      return;
    }

    logger.info('Sending queued escalation notifications', {
      count: queuedEscalations.length
    });

    // Send summary message for multiple escalations
    if (queuedEscalations.length > 1) {
      await this.sendBatchNotification(queuedEscalations);
    } else {
      await this.sendEscalationNotification(queuedEscalations[0]!);
    }
  }

  private async sendBatchNotification(escalations: EscalationData[]): Promise<void> {
    if (!this.whatsappService) {
      logger.warn('WhatsApp service not available for batch notification');
      return;
    }

    try {
      const batchMessage = this.formatBatchMessage(escalations);
      const adminPhone = config.businessPhone2;
      
      await this.whatsappService.sendMessage(adminPhone, batchMessage);
      
      // Send individual notifications for each escalation
      for (const escalation of escalations) {
        await this.sendEscalationNotification(escalation);
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info('Batch escalation notifications sent', {
        count: escalations.length
      });

    } catch (error) {
      logger.error('Failed to send batch escalation notifications', { error });
    }
  }

  private formatBatchMessage(escalations: EscalationData[]): string {
    const timestamp = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const escalationsList = escalations
      .map((esc, index) => `${index + 1}. ${esc.customerPhone} - ${esc.userQuery.substring(0, 50)}...`)
      .join('\n');

    return `🚨 *BATCH ESCALATION ALERT*

⏰ *Morning Briefing:* ${timestamp} WIB
📊 *Total Escalations:* ${escalations.length}

*Overnight/Off-hours escalations:*
${escalationsList}

---
Individual notifications will follow for each escalation.

#batch-escalation`;
  }

  public async testNotificationSystem(): Promise<{ whatsapp: boolean; email: boolean }> {
    logger.info('Testing admin notification system');

    const testEscalation: EscalationData = {
      id: 'test-' + Date.now(),
      customerPhone: '+6281234567890',
      userQuery: 'Test escalation - superfood rasa apa aja?',
      aiResponse: 'Test response about wrong product',
      validationResult: {
        isValid: false,
        confidence: 0.3,
        issues: [{
          type: 'wrong_product' as any,
          severity: 'high',
          description: 'Test validation issue'
        }],
        shouldEscalate: true
      },
      conversationContext: [{
        role: 'user',
        content: 'Test message',
        timestamp: new Date()
      }],
      timestamp: new Date(),
      status: 'pending',
      businessHours: true
    };

    const result = await this.sendEscalationNotification(testEscalation);
    
    return {
      whatsapp: result.whatsappSent,
      email: result.emailSent
    };
  }
}

export const adminNotificationService = new AdminNotificationService();