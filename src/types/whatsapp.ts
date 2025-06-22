export interface WhatsAppMessage {
  id: string;
  from: string;
  body: string;
  timestamp: number;
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  isFromMe: boolean;
}

export interface WhatsAppContact {
  id: string;
  name?: string;
  phone: string;
  isGroup: boolean;
}

export interface WhatsAppClient {
  sendMessage: (to: string, message: string) => Promise<void>;
  isConnected: () => boolean;
  getQRCode: () => Promise<string | null>;
  disconnect: () => Promise<void>;
}
