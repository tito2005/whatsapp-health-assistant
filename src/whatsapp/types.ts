export interface BaileysMessage {
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    imageMessage?: any;
    audioMessage?: any;
    videoMessage?: any;
    documentMessage?: any;
  };
  messageTimestamp: number;
}

export interface ConnectionStatus {
  connected: boolean;
  sessionId: string;
  lastConnected: string;
  reconnectAttempts: number;
  hasQRCode: boolean;
}

export interface QRCodeData {
  qrCode: string;
  expiresAt: Date;
}

// Helper function to format phone numbers
export const formatPhoneNumber = (phone: string): string => {
  // Remove any non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Add country code if missing (assuming Indonesian numbers)
  if (digits.startsWith('8')) {
    return `62${digits}@s.whatsapp.net`;
  }
  
  if (digits.startsWith('628')) {
    return `${digits}@s.whatsapp.net`;
  }
  
  return `${digits}@s.whatsapp.net`;
};

// Helper function to extract phone number from JID
export const extractPhoneNumber = (jid: string): string => {
  return jid.split('@')[0] || jid;
};