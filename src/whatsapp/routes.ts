import { asyncHandler } from '@/shared/error-handler';
import { Router } from 'express';
import { WhatsAppController } from './whatsapp-controller';

const router = Router();
const whatsappController = new WhatsAppController();

// Webhook endpoint for receiving messages
router.post('/webhook', asyncHandler(whatsappController.handleWebhook));

// Get connection status
router.get('/status', asyncHandler(whatsappController.getStatus));

// Get QR code for authentication
router.get('/qr', asyncHandler(whatsappController.getQRCode));
// Add this new route for displaying QR as HTML
router.get('/qr-display', asyncHandler(whatsappController.displayQRCode));

// Send manual message (for testing)
router.post('/send', asyncHandler(whatsappController.sendMessage));

// Disconnect WhatsApp
router.post('/disconnect', asyncHandler(whatsappController.disconnect));

export { router as whatsappRoutes };
