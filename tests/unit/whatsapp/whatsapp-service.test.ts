import { WhatsAppService } from '@/whatsapp/whatsapp-service';

describe('WhatsAppService', () => {
  let whatsappService: WhatsAppService;

  beforeEach(() => {
    whatsappService = new WhatsAppService();
  });

  describe('processIncomingMessage', () => {
    it('should process valid text message', async () => {
      const mockMessageData = {
        key: {
          id: 'test-id',
          remoteJid: '628123456789@s.whatsapp.net',
          fromMe: false,
        },
        message: {
          conversation: 'Hello, I need health advice',
        },
        messageTimestamp: Date.now(),
      };

      // Mock the sendMessage method
      jest.spyOn(whatsappService, 'sendMessage').mockResolvedValue();

      await expect(
        whatsappService.processIncomingMessage(mockMessageData)
      ).resolves.not.toThrow();
    });

    it('should skip messages from self', async () => {
      const mockMessageData = {
        key: {
          id: 'test-id',
          remoteJid: '628123456789@s.whatsapp.net',
          fromMe: true,
        },
        message: {
          conversation: 'This is from me',
        },
        messageTimestamp: Date.now(),
      };

      const sendMessageSpy = jest.spyOn(whatsappService, 'sendMessage');
      
      await whatsappService.processIncomingMessage(mockMessageData);
      
      expect(sendMessageSpy).not.toHaveBeenCalled();
    });
  });

  describe('getConnectionStatus', () => {
    it('should return connection status object', async () => {
      const status = await whatsappService.getConnectionStatus();
      
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('lastConnected');
      expect(status).toHaveProperty('sessionId');
    });
  });
});