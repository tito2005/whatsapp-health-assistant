export interface WhatsAppMessage {
  id: string;
  from: string;
  body: string;
  timestamp: number;
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  isFromMe: boolean;
  messageInfo?: {
    isGroup: boolean;
    participant?: string;
    pushName?: string;
    quotedMessage: boolean;
    hasMedia: boolean;
    messageType: string;
  };
}

export interface WhatsAppContact {
  id: string;
  name?: string;
  phone: string;
  isGroup: boolean;
}

export interface WhatsAppClient {
  sendMessage: (_to: string, _message: string) => Promise<void>;
  isConnected: () => boolean;
  getQRCode: () => Promise<string | null>;
  disconnect: () => Promise<void>;
}
