import { asyncHandler } from '@/shared/error-handler';
import { Router } from 'express';
import { WhatsAppController } from './whatsapp-controller';

const router = Router();
const controller = new WhatsAppController();

// Existing routes
router.get('/status', asyncHandler(controller.getStatus));
router.get('/qr', asyncHandler(controller.getQRCode));
router.get('/qr/display', asyncHandler(controller.displayQRCode));
router.post('/send', asyncHandler(controller.sendMessage));
router.post('/disconnect', asyncHandler(controller.disconnect));

// New conversation management routes
router.delete('/conversation/:phoneNumber', asyncHandler(controller.clearConversation));
router.get('/conversation/:phoneNumber/summary', asyncHandler(controller.getConversationSummary));

export { router as whatsappRoutes };
