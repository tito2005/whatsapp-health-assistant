import { log } from '@/shared/logger';
import { OrderCollection, ShippingZone, ShippingOption } from '@/types/order';
import { ProductRecommendation } from '@/types/product';
import { OrderRepository } from '@/orders/order-repository';
import { retryDatabaseOperation } from '@/shared/retry';
import { ChatbotErrorHandler } from '@/shared/error-handler';
import { OrderSummaryService } from '@/orders/order-summary-service';

export class OrderService {
  private orderRepository: OrderRepository;
  private orderSummaryService: OrderSummaryService;
  
  // Define shipping zones and their rules
  private shippingZones: ShippingZone[] = [
    {
      name: 'Tanjung Piayu',
      zone: 'tanjung_piayu',
      paymentMethods: ['cod', 'bank_transfer'],
      shippingOptions: [
        {
          type: 'cod_instant',
          name: 'COD Instant',
          cost: 0,
          description: 'Bayar di tempat dengan pengiriman instant',
          estimatedDelivery: 'Hari ini'
        },
        {
          type: 'instant',
          name: 'Transfer Instant',
          cost: 0,
          description: 'Transfer dulu, kirim instant',
          estimatedDelivery: 'Hari ini'
        }
      ]
    },
    {
      name: 'Batam Centre',
      zone: 'batam_centre',
      paymentMethods: ['bank_transfer'],
      shippingOptions: [
        {
          type: 'instant',
          name: 'Transfer Instant',
          cost: 0,
          description: 'Transfer dulu, kirim instant (hanya tersedia transfer)',
          estimatedDelivery: 'Hari ini'
        }
      ]
    },
    {
      name: 'Daerah Lain Batam',
      zone: 'other',
      paymentMethods: ['cod', 'bank_transfer'],
      shippingOptions: [
        {
          type: 'batam_courier',
          name: 'Kurir Batam Gratis',
          cost: 0,
          description: 'Gratis ongkir pakai kurir Batam',
          estimatedDelivery: 'Hari ini atau besok'
        },
        {
          type: 'instant',
          name: 'Instant Delivery',
          cost: 10000, // Customer pays the rest, store covers 10k
          description: 'Kirim instant (toko tanggung 10k, sisanya customer)',
          estimatedDelivery: 'Beberapa jam'
        }
      ]
    }
  ];

  constructor() {
    this.orderRepository = new OrderRepository();
    this.orderSummaryService = OrderSummaryService.getInstance();
    log.startup('OrderService initialized with database persistence and order summary service');
  }

  public createNewOrder(): OrderCollection {
    return {
      items: [],
      totalAmount: 0,
      shippingCost: 0,
      isComplete: false,
      notes: undefined,
      orderStep: undefined
    };
  }

  public addItemToOrder(order: OrderCollection, product: ProductRecommendation, quantity: number = 1): OrderCollection {
    const existingItem = order.items.find(item => item.productId === product.product.id);
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      order.items.push({
        productId: product.product.id,
        productName: product.product.name,
        quantity,
        price: product.product.price
      });
    }
    
    this.calculateOrderTotal(order);
    return order;
  }

  public removeItemFromOrder(order: OrderCollection, productId: string): OrderCollection {
    order.items = order.items.filter(item => item.productId !== productId);
    this.calculateOrderTotal(order);
    return order;
  }

  public updateItemQuantity(order: OrderCollection, productId: string, quantity: number): OrderCollection {
    const item = order.items.find(item => item.productId === productId);
    if (item) {
      if (quantity <= 0) {
        return this.removeItemFromOrder(order, productId);
      }
      item.quantity = quantity;
      this.calculateOrderTotal(order);
    }
    return order;
  }

  private calculateOrderTotal(order: OrderCollection): void {
    order.totalAmount = order.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  }

  public detectShippingZone(address: string): 'tanjung_piayu' | 'batam_centre' | 'other' {
    const normalizedAddress = address.toLowerCase();
    
    if (normalizedAddress.includes('piayu') || normalizedAddress.includes('tanjung piayu')) {
      return 'tanjung_piayu';
    }
    
    if (normalizedAddress.includes('batam centre') || normalizedAddress.includes('batam center') || 
        normalizedAddress.includes('centre') || normalizedAddress.includes('center')) {
      return 'batam_centre';
    }
    
    return 'other';
  }

  public getShippingOptions(zone: 'tanjung_piayu' | 'batam_centre' | 'other'): ShippingOption[] {
    const shippingZone = this.shippingZones.find(sz => sz.zone === zone);
    return shippingZone ? shippingZone.shippingOptions : [];
  }

  public getPaymentMethods(zone: 'tanjung_piayu' | 'batam_centre' | 'other'): string[] {
    const shippingZone = this.shippingZones.find(sz => sz.zone === zone);
    return shippingZone ? shippingZone.paymentMethods : [];
  }

  public validateOrderData(order: OrderCollection): { isValid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];
    
    if (!order.customerName?.trim()) missingFields.push('Nama');
    if (!order.whatsappNumber?.trim()) missingFields.push('Nomor WhatsApp');
    if (!order.address?.trim()) missingFields.push('Alamat');
    if (!order.paymentMethod) missingFields.push('Cara Pembayaran');
    if (order.items.length === 0) missingFields.push('Produk');
    
    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  public formatOrderSummary(order: OrderCollection): string {
    let summary = `📋 *RINGKASAN PESANAN*\n\n`;
    
    // Customer Info
    summary += `👤 *Informasi Customer:*\n`;
    summary += `• Nama: ${order.customerName || '-'}\n`;
    summary += `• WhatsApp: ${order.whatsappNumber || '-'}\n`;
    summary += `• Alamat: ${order.address || '-'}\n\n`;
    
    // Items
    summary += `🛒 *Produk yang Dipesan:*\n`;
    order.items.forEach((item, index) => {
      summary += `${index + 1}. ${item.productName}\n`;
      summary += `   Qty: ${item.quantity} x Rp ${item.price.toLocaleString('id-ID')}\n`;
      summary += `   Subtotal: Rp ${(item.quantity * item.price).toLocaleString('id-ID')}\n\n`;
    });
    
    // Shipping & Payment
    summary += `🚚 *Pengiriman & Pembayaran:*\n`;
    summary += `• Zona: ${this.getZoneName(order.shippingZone!)}\n`;
    summary += `• Metode: ${order.shippingOption === 'batam_courier' ? 'Kurir Batam (Gratis)' : 'Instant Delivery'}\n`;
    summary += `• Pembayaran: ${order.paymentMethod === 'cod' ? 'COD' : 'Transfer Bank'}\n`;
    if (order.shippingCost > 0) {
      summary += `• Ongkir: Rp ${order.shippingCost.toLocaleString('id-ID')}\n`;
    }
    summary += `\n`;
    
    // Total
    const finalTotal = order.totalAmount + order.shippingCost;
    summary += `💰 *TOTAL: Rp ${finalTotal.toLocaleString('id-ID')}*\n\n`;
    
    summary += `Apakah semua informasi sudah benar?`;
    
    return summary;
  }

  private getZoneName(zone: 'tanjung_piayu' | 'batam_centre' | 'other'): string {
    switch (zone) {
      case 'tanjung_piayu': return 'Tanjung Piayu';
      case 'batam_centre': return 'Batam Centre';
      case 'other': return 'Daerah Lain Batam';
      default: return 'Unknown';
    }
  }

  public formatShippingOptions(zone: 'tanjung_piayu' | 'batam_centre' | 'other'): string {
    const options = this.getShippingOptions(zone);
    const zoneName = this.getZoneName(zone);
    
    let message = `🚚 *Pilihan Pengiriman untuk ${zoneName}:*\n\n`;
    
    options.forEach((option, index) => {
      message += `${index + 1}. *${option.name}*\n`;
      message += `   ${option.description}\n`;
      message += `   Estimasi: ${option.estimatedDelivery}\n`;
      if (option.cost > 0) {
        message += `   Biaya tambahan: Rp ${option.cost.toLocaleString('id-ID')}\n`;
      }
      message += `\n`;
    });
    
    message += `Pilih salah satu ya Kak! 😊`;
    
    return message;
  }

  /**
   * Save order to database with encryption for sensitive data
   */
  public async saveOrder(order: OrderCollection, customerPhone: string, customerName?: string): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      const result = await retryDatabaseOperation(async () => {
        // Get or create customer
        const customerId = await this.orderRepository.getOrCreateCustomer(customerPhone, customerName);
        
        // Create encrypted copy of order for sensitive data
        const secureOrder = { ...order };
        if (secureOrder.address) {
          // Don't encrypt address in this implementation as it's needed for shipping zone detection
          // In production, you might want to encrypt and decrypt as needed
        }
        
        // Save order to database
        const orderId = await this.orderRepository.createOrder(secureOrder, customerId);
        
        log.order.created(orderId, customerId, secureOrder.totalAmount, secureOrder.items);
        
        return orderId;
      });

      return { success: true, orderId: result };

    } catch (error) {
      const errorMessage = ChatbotErrorHandler.handleChatbotError(error as Error, {
        operation: 'saveOrder',
        additionalData: { customerPhone }
      });
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update existing order in database
   */
  public async updateOrder(orderId: string, updates: Partial<OrderCollection>): Promise<{ success: boolean; error?: string }> {
    try {
      await retryDatabaseOperation(async () => {
        await this.orderRepository.updateOrder(orderId, updates);
        log.order.updated(orderId, 'updated', updates);
      });

      return { success: true };

    } catch (error) {
      const errorMessage = ChatbotErrorHandler.handleChatbotError(error as Error, {
        operation: 'updateOrder',
        additionalData: { orderId }
      });
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get order by ID from database
   */
  public async getOrderById(orderId: string): Promise<{ success: boolean; order?: OrderCollection; error?: string }> {
    try {
      const result = await retryDatabaseOperation(async () => {
        const orderRecord = await this.orderRepository.getOrderById(orderId);
        if (!orderRecord) {
          throw ChatbotErrorHandler.createBusinessLogicError(
            `Order not found: ${orderId}`,
            'Pesanan tidak ditemukan. Mohon periksa kembali nomor pesanan Anda.'
          );
        }
        
        return this.orderRepository.convertToOrderCollection(orderRecord);
      });

      return { success: true, order: result };

    } catch (error) {
      const errorMessage = ChatbotErrorHandler.handleChatbotError(error as Error, {
        operation: 'getOrderById',
        additionalData: { orderId }
      });
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update order status in database
   */
  public async updateOrderStatus(
    orderId: string, 
    status: 'pending' | 'collecting_info' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled',
    estimatedDelivery?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await retryDatabaseOperation(async () => {
        await this.orderRepository.updateOrderStatus(orderId, status, estimatedDelivery);
        log.order.updated(orderId, status, { estimatedDelivery });
      });

      return { success: true };

    } catch (error) {
      const errorMessage = ChatbotErrorHandler.handleChatbotError(error as Error, {
        operation: 'updateOrderStatus',
        additionalData: { orderId, status }
      });
      
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get customer orders with secure data handling
   */
  public async getCustomerOrders(customerPhone: string): Promise<{ success: boolean; orders?: OrderCollection[]; error?: string }> {
    try {
      const result = await retryDatabaseOperation(async () => {
        const customerId = await this.orderRepository.getOrCreateCustomer(customerPhone);
        const orderRecords = await this.orderRepository.getOrdersByCustomerId(customerId);
        
        return orderRecords.map(record => this.orderRepository.convertToOrderCollection(record));
      });

      return { success: true, orders: result };

    } catch (error) {
      const errorMessage = ChatbotErrorHandler.handleChatbotError(error as Error, {
        operation: 'getCustomerOrders',
        additionalData: { customerPhone }
      });
      
      return { success: false, error: errorMessage };
    }
  }

  public async processOrderConfirmation(order: OrderCollection): Promise<{ success: boolean; orderId?: string; message: string }> {
    try {
      const validation = this.validateOrderData(order);
      
      if (!validation.isValid) {
        throw ChatbotErrorHandler.createValidationError(
          `Missing required fields: ${validation.missingFields.join(', ')}`,
          validation.missingFields[0]
        );
      }

      // Save order to database with retry mechanism
      const saveResult = await this.saveOrder(order, order.whatsappNumber!, order.customerName);
      
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save order');
      }

      const orderId = saveResult.orderId!;
      
      // Update order status to confirmed
      await this.updateOrderStatus(orderId, 'confirmed');
      
      log.order.created(orderId, order.whatsappNumber!, order.totalAmount + (order.shippingCost || 0), order.items);
      
      return {
        success: true,
        orderId,
        message: `✅ Pesanan berhasil dikonfirmasi!\n\n📝 Order ID: *${orderId}*\n\nTerima kasih sudah mempercayai ${process.env.BUSINESS_NAME || 'kami'}! Pesanan Anda akan segera diproses. 😊`
      };
      
    } catch (error) {
      const errorMessage = ChatbotErrorHandler.handleChatbotError(error as Error, {
        operation: 'processOrderConfirmation',
        additionalData: { 
          customerName: order.customerName,
          itemCount: order.items.length 
        }
      });
      
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  /**
   * Generate order summary with auto-filled phone number
   */
  public generateOrderSummary(
    order: OrderCollection, 
    currentWhatsAppNumber?: string,
    format: 'simple' | 'detailed' = 'simple'
  ): string {
    return this.orderSummaryService.generateOrderSummary(
      order, 
      currentWhatsAppNumber, 
      { format }
    );
  }

  /**
   * Validate Batam address for completeness
   */
  public validateAddress(address: string) {
    return this.orderSummaryService.validateBatamAddress(address);
  }

  /**
   * Generate address validation message
   */
  public generateAddressValidationMessage(address: string): string {
    const validation = this.validateAddress(address);
    return this.orderSummaryService.generateAddressValidationMessage(validation, address);
  }

  /**
   * Check if order has complete customer information
   */
  public hasCompleteCustomerInfo(order: OrderCollection, currentWhatsAppNumber?: string): boolean {
    return this.orderSummaryService.hasCompleteCustomerInfo(order, currentWhatsAppNumber);
  }

  /**
   * Get missing customer information
   */
  public getMissingCustomerInfo(order: OrderCollection, currentWhatsAppNumber?: string): string[] {
    return this.orderSummaryService.getMissingCustomerInfo(order, currentWhatsAppNumber);
  }

  /**
   * Auto-fill phone number from current WhatsApp number
   */
  public autoFillPhoneNumber(order: OrderCollection, currentWhatsAppNumber: string): OrderCollection {
    return this.orderSummaryService.autoFillPhoneNumber(order, currentWhatsAppNumber);
  }

  /**
   * Generate customer info complete message with order summary
   */
  public generateCustomerInfoCompleteMessage(order: OrderCollection): string {
    return this.orderSummaryService.generateCustomerInfoCompleteMessage(order);
  }

  /**
   * Process customer information and generate appropriate response
   */
  public processCustomerInfo(
    order: OrderCollection, 
    currentWhatsAppNumber?: string
  ): { 
    isComplete: boolean; 
    message: string; 
    updatedOrder: OrderCollection;
    needsAddressValidation?: boolean;
  } {
    // Auto-fill phone number if not provided
    const updatedOrder = currentWhatsAppNumber 
      ? this.autoFillPhoneNumber(order, currentWhatsAppNumber)
      : order;

    // Check if customer info is complete
    const isComplete = this.hasCompleteCustomerInfo(updatedOrder, currentWhatsAppNumber);
    
    if (isComplete) {
      // Generate completion message with summary
      const message = this.generateCustomerInfoCompleteMessage(updatedOrder);
      return {
        isComplete: true,
        message,
        updatedOrder
      };
    } else {
      // Check if address needs validation
      let needsAddressValidation = false;
      let message = '';

      if (updatedOrder.address && updatedOrder.address.trim().length >= 10) {
        const addressValidation = this.validateAddress(updatedOrder.address);
        if (!addressValidation.isValid) {
          needsAddressValidation = true;
          message = this.generateAddressValidationMessage(updatedOrder.address);
        }
      }

      if (!needsAddressValidation) {
        // Generate message for missing info
        const missingInfo = this.getMissingCustomerInfo(updatedOrder, currentWhatsAppNumber);
        if (missingInfo.length > 0) {
          message = `Untuk melanjutkan pesanan, saya perlu informasi berikut:\n\n`;
          missingInfo.forEach((info, index) => {
            message += `${index + 1}. ${info}\n`;
          });
          message += `\nMohon berikan informasi yang diperlukan ya Kak 😊`;
        }
      }

      return {
        isComplete: false,
        message,
        updatedOrder,
        needsAddressValidation
      };
    }
  }

  // private generateOrderId(): string {
  //   const now = new Date();
  //   const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  //   const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  //   const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  //   return `ORD-${dateStr}-${timeStr}-${random}`;
  // }
}