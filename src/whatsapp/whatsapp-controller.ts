import { AppError } from '@/shared/error-handler';
import { logger } from '@/shared/logger';
import type { ApiResponse } from '@/types/common';
import { Request, Response } from 'express';
import { WhatsAppService } from './whatsapp-service';

export class WhatsAppController {
  private getWhatsAppService(req: Request): WhatsAppService {
    const service = req.app.locals.whatsappService;
    if (!service) {
      throw new AppError('WhatsApp service not initialized', 500);
    }
    return service;
  }

  public getStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const whatsappService = this.getWhatsAppService(req);
      const status = await whatsappService.getConnectionStatus();

      const response: ApiResponse = {
        success: true,
        message: 'WhatsApp status retrieved successfully',
        data: status
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error getting WhatsApp status', { error });
      throw new AppError('Failed to get status', 500);
    }
  };

  public getQRCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const whatsappService = this.getWhatsAppService(req);
      const qrCode = await whatsappService.getQRCode();

      if (!qrCode) {
        const response: ApiResponse = {
          success: false,
          message: 'No QR code available. WhatsApp might already be connected.',
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'QR code retrieved successfully',
        data: { qrCode },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error getting QR code', { error });
      throw new AppError('Failed to get QR code', 500);
    }
  };

  public displayQRCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const whatsappService = this.getWhatsAppService(req);
      const qrCode = await whatsappService.getQRCode();

      if (!qrCode) {
         res.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>WhatsApp Connected</title>
              <meta http-equiv="refresh" content="5">
              <style>
                body {
                  font-family: Arial, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  background-color: #f0f2f5;
                }
                .container {
                  text-align: center;
                  background: white;
                  padding: 2rem;
                  border-radius: 8px;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .status {
                  color: #25D366;
                  font-size: 1.2rem;
                  margin-top: 1rem;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>WhatsApp Connected! ✅</h1>
                <p class="status">Your WhatsApp is successfully connected.</p>
                <p>You can close this window.</p>
              </div>
            </body>
          </html>
        `);
      }

      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>WhatsApp QR Code</title>
            <meta http-equiv="refresh" content="10">
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background-color: #f0f2f5;
              }
              .container {
                text-align: center;
                background: white;
                padding: 2rem;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              h1 {
                color: #1f1f1f;
                margin-bottom: 1rem;
              }
              .qr-container {
                margin: 2rem 0;
                padding: 1rem;
                background: #fff;
                border-radius: 8px;
              }
              .instructions {
                text-align: left;
                margin: 2rem 0;
                padding: 1rem;
                background: #f8f9fa;
                border-radius: 8px;
              }
              .instructions li {
                margin: 0.5rem 0;
              }
              button {
                background: #25D366;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 1rem;
              }
              button:hover {
                background: #128C7E;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Scan QR Code with WhatsApp</h1>
              <div class="qr-container">
                <img src="${qrCode}" alt="WhatsApp QR Code" />
              </div>
              <div class="instructions">
                <strong>Instructions:</strong>
                <ol>
                  <li>Open WhatsApp on your phone</li>
                  <li>Go to <strong>Settings → Linked Devices</strong></li>
                  <li>Tap <strong>"Link Device"</strong></li>
                  <li>Scan this QR code</li>
                </ol>
                <button onclick="location.reload()">Refresh QR Code</button>
              </div>
            </div>
          </body>
        </html>
      `);
      return;
    } catch (error) {
      logger.error('Error displaying QR code', { error });
      res.status(500).send('Error displaying QR code');
    }
  };

  public sendMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      const whatsappService = this.getWhatsAppService(req);
      const { to, message } = req.body;

      if (!to || !message) {
        throw new AppError('Missing required fields: to, message', 400);
      }

      await whatsappService.sendMessage(to, message);

      const response: ApiResponse = {
        success: true,
        message: 'Message sent successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error sending message', { error });
      throw new AppError('Failed to send message', 500);
    }
  };

  public disconnect = async (req: Request, res: Response): Promise<void> => {
    try {
      const whatsappService = this.getWhatsAppService(req);
      await whatsappService.disconnect();

      const response: ApiResponse = {
        success: true,
        message: 'WhatsApp disconnected successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error disconnecting WhatsApp', { error });
      throw new AppError('Failed to disconnect', 500);
    }
  };

  // New endpoint to clear conversation
  public clearConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber } = req.params;
      
      if (!phoneNumber) {
        throw new AppError('Phone number is required', 400);
      }

      // Access conversation manager through the service
      const whatsappService = this.getWhatsAppService(req);
      const conversationManager = (whatsappService as any).conversationManager;
      
      await conversationManager.clearConversation(phoneNumber);

      const response: ApiResponse = {
        success: true,
        message: 'Conversation cleared successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error clearing conversation', { error });
      throw new AppError('Failed to clear conversation', 500);
    }
  };

  // New endpoint to get conversation summary
  public getConversationSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phoneNumber } = req.params;
      
      if (!phoneNumber) {
        throw new AppError('Phone number is required', 400);
      }

      const whatsappService = this.getWhatsAppService(req);
      const conversationManager = (whatsappService as any).conversationManager;
      
      const summary = await conversationManager.getConversationSummary(phoneNumber);

      const response: ApiResponse = {
        success: true,
        message: 'Conversation summary retrieved successfully',
        data: summary,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error getting conversation summary', { error });
      throw new AppError('Failed to get conversation summary', 500);
    }
  };
}