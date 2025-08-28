export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'partial' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  business: {
    name: string;
    sector: string;
    aiRole: string;
  };
  services: {
    whatsapp: {
      connected: boolean;
      [key: string]: any;
    };
    database: {
      healthy: boolean;
      [key: string]: any;
    };
    ai: {
      healthy: boolean;
      service: string;
      model: string;
      [key: string]: any;
    };
  };
  version: string;
}