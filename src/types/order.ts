export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  shippingAddress: Address;
  orderDate: Date;
  estimatedDelivery?: Date;
  notes?: string;
  metadata: Record<string, any>;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  totalPrice: number;
}

export type OrderStatus = 
  | 'pending'
  | 'collecting_info'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'cod' | 'bank_transfer' | 'ewallet';

export interface Address {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// Enhanced order types for your specific business
export interface OrderCollection {
  customerName?: string;
  whatsappNumber?: string;
  address?: string;
  paymentMethod?: 'cod' | 'bank_transfer' | 'transfer';
  shippingZone?: 'tanjung_piayu' | 'batam_centre' | 'other';
  shippingOption?: 'batam_courier' | 'instant';
  items: OrderCartItem[];
  totalAmount: number;
  shippingCost: number;
  isComplete: boolean;
  notes: string | undefined;
  orderStep: 'cart' | 'customer_info' | 'shipping' | 'confirmation' | undefined;
}

export interface OrderCartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface ShippingZone {
  name: string;
  zone: 'tanjung_piayu' | 'batam_centre' | 'other';
  paymentMethods: PaymentMethod[];
  shippingOptions: ShippingOption[];
}

export interface ShippingOption {
  type: 'batam_courier' | 'instant' | 'cod_instant';
  name: string;
  cost: number;
  description: string;
  estimatedDelivery: string;
}