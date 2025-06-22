import { AppError } from '@/shared/error-handler';
import { logger } from '@/shared/logger';
import type { ApiResponse } from '@/types/common';
import { Request, Response } from 'express';
import { WhatsAppService } from './whatsapp-service';

export class WhatsAppController {
  private whatsappService: WhatsAppService;

  constructor() {
    this.whatsappService = new WhatsAppService();
  }

  public handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const messageData = req.body;
      
      logger.info('Received WhatsApp webhook', { messageData });

      // Process the incoming message
      await this.whatsappService.processIncomingMessage(messageData);

      const response: ApiResponse = {
        success: true,
        message: 'Message processed successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error processing WhatsApp webhook', { error });
      throw new AppError('Failed to process message', 500);
    }
  };

  public getStatus = async (_req: Request, res: Response): Promise<void> => {
    try {
      const status = await this.whatsappService.getConnectionStatus();
      
      const response: ApiResponse = {
        success: true,
        message: 'WhatsApp status retrieved',
        data: status,
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error getting WhatsApp status', { error });
      throw new AppError('Failed to get status', 500);
    }
  };

  public getQRCode = async (_req: Request, res: Response): Promise<void> => {
    try {
      const qrCode = await this.whatsappService.getQRCode();
      
      if (!qrCode) {
        throw new AppError('QR code not available', 404);
      }

      const response: ApiResponse = {
        success: true,
        message: 'QR code generated',
        data: { qrCode },
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error getting QR code', { error });
      throw new AppError('Failed to get QR code', 500);
    }
};

public displayQRCode = async (_req: Request, res: Response): Promise<void> => {
  try {
    const qrCode = await this.whatsappService.getQRCode();
    
    if (!qrCode) {
      res.status(404).send(`
        <html>
          <body style="text-align: center; font-family: Arial;">
            <h2>❌ QR Code Not Available</h2>
            <p>Please restart the server to generate a new QR code.</p>
            <button onclick="location.reload()">Refresh</button>
          </body>
        </html>
      `);
      return;
    }

    // Display QR code as HTML
    res.send(`
      <html>
        <head>
          <title>WhatsApp QR Code</title>
          <style>
            body { 
              text-align: center; 
              font-family: Arial, sans-serif; 
              padding: 20px;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              display: inline-block;
            }
            img { 
              border: 3px solid #25D366; 
              border-radius: 10px;
              padding: 10px;
              background: white;
            }
            .instructions {
              margin-top: 20px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>📱 WhatsApp QR Code</h2>
            <img src="${qrCode}" alt="WhatsApp QR Code" />
            
            <div class="instructions">
              <h3>How to connect:</h3>
              <ol style="text-align: left; display: inline-block;">
                <li>Open WhatsApp on your phone</li>
                <li>Go to <strong>Settings → Linked Devices</strong></li>
                <li>Tap <strong>"Link Device"</strong></li>
                <li>Scan this QR code</li>
              </ol>
              <button onclick="location.reload()" style="
                background: #25D366; 
                color: white; 
                border: none; 
                padding: 10px 20px; 
                border-radius: 5px; 
                cursor: pointer;
                margin-top: 10px;
              ">Refresh QR Code</button>
            </div>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error('Error displaying QR code', { error });
    res.status(500).send('Error displaying QR code');
  }
};

public sendMessage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { to, message } = req.body;

      if (!to || !message) {
        throw new AppError('Missing required fields: to, message', 400);
      }

      await this.whatsappService.sendMessage(to, message);

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

  public disconnect = async (_req: Request, res: Response): Promise<void> => {
    try {
      await this.whatsappService.disconnect();

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
}
