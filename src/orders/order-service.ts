import { logger } from '@/shared/logger';
import { OrderCollection, ShippingZone, ShippingOption } from '@/types/order';
import { ProductRecommendation } from '@/types/product';

export class OrderService {
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

  public createNewOrder(): OrderCollection {
    return {
      items: [],
      totalAmount: 0,
      shippingCost: 0,
      isComplete: false
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

  public processOrderConfirmation(order: OrderCollection): { success: boolean; orderId?: string; message: string } {
    try {
      const validation = this.validateOrderData(order);
      
      if (!validation.isValid) {
        return {
          success: false,
          message: `Mohon lengkapi data berikut: ${validation.missingFields.join(', ')}`
        };
      }
      
      // Generate order ID
      const orderId = this.generateOrderId();
      
      // Log order for processing
      logger.info('Order confirmed and ready for processing', {
        orderId,
        customerName: order.customerName,
        totalAmount: order.totalAmount + order.shippingCost,
        itemCount: order.items.length,
        shippingZone: order.shippingZone,
        paymentMethod: order.paymentMethod
      });
      
      return {
        success: true,
        orderId,
        message: `✅ Pesanan berhasil dikonfirmasi!\n\n📝 Order ID: *${orderId}*\n\nTerima kasih sudah mempercayai ${process.env.BUSINESS_NAME || 'kami'}! Pesanan Anda akan segera diproses. 😊`
      };
      
    } catch (error) {
      logger.error('Failed to process order confirmation', { error });
      return {
        success: false,
        message: 'Terjadi kesalahan saat memproses pesanan. Mohon coba lagi.'
      };
    }
  }

  private generateOrderId(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${dateStr}-${timeStr}-${random}`;
  }
}