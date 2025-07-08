import { logger } from '@/shared/logger';
import { OrderCollection } from '@/types/order';

export interface AddressValidation {
  isValid: boolean;
  missingInfo: string[];
  suggestions?: string[];
  needsConfirmation: boolean;
}

export interface OrderSummaryOptions {
  includePaymentInfo?: boolean;
  includeShippingInfo?: boolean;
  format?: 'detailed' | 'simple';
}

export class OrderSummaryService {
  private static instance: OrderSummaryService;
  
  // Batam subdistricts for validation
  private readonly batamSubdistricts = [
    'batam kota', 'batu aji', 'batu ampar', 'belakang padang', 'bengkong',
    'bulang', 'galang', 'lubuk baja', 'nongsa', 'sagulung', 'sei beduk', 
    'sekupang'
  ];

  // Common housing complexes in Batam
  private readonly batamHousingComplexes = [
    'grand batam mall', 'nagoya', 'harbor bay', 'waterfront city',
    'botania', 'crown golf', 'palm spring', 'batam view', 'golden city',
    'regency', 'royal', 'graha', 'villa', 'cluster', 'town house',
    'ruko', 'shophouse'
  ];

  public static getInstance(): OrderSummaryService {
    if (!OrderSummaryService.instance) {
      OrderSummaryService.instance = new OrderSummaryService();
    }
    return OrderSummaryService.instance;
  }

  /**
   * Generate order summary with specified format
   */
  public generateOrderSummary(
    order: OrderCollection, 
    currentWhatsAppNumber?: string,
    options: OrderSummaryOptions = {}
  ): string {
    const {
      includePaymentInfo = true,
      includeShippingInfo = true,
      format = 'simple'
    } = options;

    // Auto-fill phone number if not provided
    const phoneNumber = order.whatsappNumber || currentWhatsAppNumber || '';
    
    // Create updated order with auto-filled phone
    const orderWithPhone = {
      ...order,
      whatsappNumber: phoneNumber
    };

    if (format === 'simple') {
      return this.generateSimpleOrderSummary(orderWithPhone, includePaymentInfo);
    } else {
      return this.generateDetailedOrderSummary(orderWithPhone, includePaymentInfo, includeShippingInfo);
    }
  }

  /**
   * Generate simple order summary as requested by user
   * Format: Nama: {name}, Alamat: {address}, No Hp WA: {phone}, Total: {amount} Gratis Ongkir {payment method}
   */
  private generateSimpleOrderSummary(order: OrderCollection, includePaymentInfo: boolean): string {
    const name = order.customerName || '[Belum diisi]';
    const address = order.address || '[Belum diisi]';
    const phone = order.whatsappNumber || '[Belum diisi]';
    
    // Format total amount (e.g., 295k)
    const totalAmount = order.totalAmount + (order.shippingCost || 0);
    const formattedTotal = this.formatAmountShort(totalAmount);
    
    // Payment method display
    let paymentDisplay = '';
    if (includePaymentInfo && order.paymentMethod) {
      paymentDisplay = order.paymentMethod === 'cod' ? 'COD' : 'TF';
    }

    // Check if shipping is free
    const shippingText = (order.shippingCost || 0) === 0 ? 'Gratis Ongkir' : `Ongkir ${this.formatAmountShort(order.shippingCost || 0)}`;
    
    let summary = `Nama: ${name}\n`;
    summary += `Alamat: ${address}\n`;
    summary += `No Hp WA: ${phone}\n`;
    summary += `Total: ${formattedTotal} ${shippingText}`;
    
    if (paymentDisplay) {
      summary += ` ${paymentDisplay}`;
    }

    return summary;
  }

  /**
   * Generate detailed order summary
   */
  private generateDetailedOrderSummary(
    order: OrderCollection, 
    includePaymentInfo: boolean, 
    includeShippingInfo: boolean
  ): string {
    let summary = `📋 *RINGKASAN PESANAN*\n\n`;
    
    // Customer Info
    summary += `👤 *Informasi Customer:*\n`;
    summary += `• Nama: ${order.customerName || '[Belum diisi]'}\n`;
    summary += `• WhatsApp: ${order.whatsappNumber || '[Belum diisi]'}\n`;
    summary += `• Alamat: ${order.address || '[Belum diisi]'}\n\n`;
    
    // Items
    if (order.items && order.items.length > 0) {
      summary += `🛒 *Produk yang Dipesan:*\n`;
      order.items.forEach((item, index) => {
        summary += `${index + 1}. ${item.productName}\n`;
        summary += `   Qty: ${item.quantity} x Rp ${item.price.toLocaleString('id-ID')}\n`;
        summary += `   Subtotal: Rp ${(item.quantity * item.price).toLocaleString('id-ID')}\n\n`;
      });
    }
    
    // Shipping & Payment
    if (includeShippingInfo) {
      summary += `🚚 *Pengiriman:*\n`;
      if (order.shippingZone) {
        summary += `• Zona: ${this.getZoneName(order.shippingZone)}\n`;
      }
      if (order.shippingOption) {
        summary += `• Metode: ${order.shippingOption === 'batam_courier' ? 'Kurir Batam (Gratis)' : 'Instant Delivery'}\n`;
      }
      if (order.shippingCost && order.shippingCost > 0) {
        summary += `• Ongkir: Rp ${order.shippingCost.toLocaleString('id-ID')}\n`;
      } else {
        summary += `• Ongkir: Gratis\n`;
      }
      summary += `\n`;
    }
    
    if (includePaymentInfo && order.paymentMethod) {
      summary += `💳 *Pembayaran:*\n`;
      summary += `• Metode: ${order.paymentMethod === 'cod' ? 'COD (Bayar di Tempat)' : 'Transfer Bank'}\n\n`;
    }
    
    // Total
    const finalTotal = order.totalAmount + (order.shippingCost || 0);
    summary += `💰 *TOTAL: Rp ${finalTotal.toLocaleString('id-ID')}*\n\n`;
    
    return summary;
  }

  /**
   * Validate Batam address with specific focus on kecamatan and blok/number
   */
  public validateBatamAddress(address: string): AddressValidation {
    const normalizedAddress = address.toLowerCase();
    const validation: AddressValidation = {
      isValid: true,
      missingInfo: [],
      needsConfirmation: false
    };

    // Check for minimum address length
    if (address.trim().length < 10) {
      validation.isValid = false;
      validation.missingInfo.push('Alamat terlalu pendek');
      validation.needsConfirmation = true;
      return validation;
    }

    // Check for kecamatan (subdistrict)
    const hasKecamatan = this.batamSubdistricts.some(subdistrict => 
      normalizedAddress.includes(subdistrict)
    );

    if (!hasKecamatan) {
      validation.missingInfo.push('kecamatan');
      validation.needsConfirmation = true;
      validation.suggestions = [
        'Mohon sertakan nama kecamatan (misal: Batam Kota, Batu Aji, Sagulung, dll)',
        'Contoh alamat lengkap: "Jl. Sudirman Blok A No. 123, Batam Kota"'
      ];
    }

    // Check for blok or number structure
    const hasBlok = /blok\s*[a-zA-Z0-9]/i.test(normalizedAddress);
    const hasNumber = /no\.?\s*\d+/i.test(normalizedAddress) || /\d+/.test(normalizedAddress);
    const hasHousingComplex = this.batamHousingComplexes.some(complex => 
      normalizedAddress.includes(complex)
    );

    // For housing complexes, blok might not be required
    if (!hasHousingComplex && !hasBlok && !hasNumber) {
      validation.missingInfo.push('nomor rumah atau blok');
      validation.needsConfirmation = true;
      validation.suggestions = [
        ...(validation.suggestions || []),
        'Di Batam biasanya ada Blok dan Nomor rumah',
        'Contoh: "Blok A No. 123" atau "No. 45" jika tidak ada blok'
      ];
    } else if (!hasNumber) {
      validation.missingInfo.push('nomor rumah');
      validation.needsConfirmation = true;
      validation.suggestions = [
        ...(validation.suggestions || []),
        'Mohon sertakan nomor rumah untuk memudahkan pengiriman'
      ];
    }

    // Check for street name
    const hasStreet = /jl\.?|jalan|gang|gg\./i.test(normalizedAddress);
    if (!hasStreet && !hasHousingComplex) {
      validation.missingInfo.push('nama jalan');
      validation.needsConfirmation = true;
    }

    validation.isValid = validation.missingInfo.length === 0;

    if (validation.needsConfirmation) {
      logger.info('Address validation requires confirmation', {
        address,
        missingInfo: validation.missingInfo,
        hasKecamatan,
        hasBlok,
        hasNumber,
        hasHousingComplex
      });
    }

    return validation;
  }

  /**
   * Generate address validation message for user
   */
  public generateAddressValidationMessage(validation: AddressValidation, address: string): string {
    if (validation.isValid) {
      return ''; // No message needed for valid addresses
    }

    let message = `Mohon konfirmasi alamat lengkapnya ya Kak 🙏\n\n`;
    message += `Alamat saat ini: "${address}"\n\n`;
    
    if (validation.missingInfo.length > 0) {
      message += `Yang perlu dilengkapi:\n`;
      validation.missingInfo.forEach((item, idx) => {
        message += `${idx + 1}. ${item}\n`;
      });
      message += `\n`;
    }

    if (validation.suggestions && validation.suggestions.length > 0) {
      message += `💡 Tips:\n`;
      validation.suggestions.forEach((suggestion) => {
        message += `• ${suggestion}\n`;
      });
      message += `\n`;
    }

    message += `Bisa kirim alamat lengkapnya lagi? 😊`;
    
    return message;
  }

  /**
   * Check if order has complete customer information
   */
  public hasCompleteCustomerInfo(order: OrderCollection, currentWhatsAppNumber?: string): boolean {
    const name = order.customerName?.trim();
    const phone = order.whatsappNumber?.trim() || currentWhatsAppNumber?.trim();
    const address = order.address?.trim();

    const hasValidName = name && name.length >= 2;
    const hasValidPhone = phone && phone.length >= 10;
    const hasValidAddress = address && address.length >= 10;

    return !!(hasValidName && hasValidPhone && hasValidAddress);
  }

  /**
   * Get missing customer information fields
   */
  public getMissingCustomerInfo(order: OrderCollection, currentWhatsAppNumber?: string): string[] {
    const missing: string[] = [];
    
    if (!order.customerName?.trim() || order.customerName.trim().length < 2) {
      missing.push('Nama lengkap');
    }
    
    const phone = order.whatsappNumber?.trim() || currentWhatsAppNumber?.trim();
    if (!phone || phone.length < 10) {
      missing.push('Nomor WhatsApp');
    }
    
    if (!order.address?.trim() || order.address.trim().length < 10) {
      missing.push('Alamat lengkap');
    }

    return missing;
  }

  /**
   * Auto-fill phone number from current WhatsApp chat
   */
  public autoFillPhoneNumber(order: OrderCollection, currentWhatsAppNumber: string): OrderCollection {
    if (!order.whatsappNumber && currentWhatsAppNumber) {
      logger.info('Auto-filling phone number from current WhatsApp chat', {
        currentNumber: currentWhatsAppNumber
      });
      
      return {
        ...order,
        whatsappNumber: currentWhatsAppNumber
      };
    }
    return order;
  }

  /**
   * Format amount in short form (e.g., 295000 -> "295k")
   */
  private formatAmountShort(amount: number): string {
    if (amount >= 1000000) {
      const millions = amount / 1000000;
      return `${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}jt`;
    } else if (amount >= 1000) {
      const thousands = amount / 1000;
      return `${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
    } else {
      return amount.toString();
    }
  }

  /**
   * Get zone name for display
   */
  private getZoneName(zone: 'tanjung_piayu' | 'batam_centre' | 'other'): string {
    switch (zone) {
      case 'tanjung_piayu': return 'Tanjung Piayu';
      case 'batam_centre': return 'Batam Centre';
      case 'other': return 'Daerah Lain Batam';
      default: return 'Unknown';
    }
  }

  /**
   * Generate confirmation message after customer details are complete
   */
  public generateCustomerInfoCompleteMessage(order: OrderCollection): string {
    const summary = this.generateOrderSummary(order, undefined, { format: 'simple' });
    
    let message = `Terima kasih! Informasi sudah lengkap 😊\n\n`;
    message += `📋 *Ringkasan:*\n${summary}\n\n`;
    message += `Apakah semua informasi sudah benar? Ketik "ya" untuk melanjutkan atau perbaiki jika ada yang salah 🙏`;
    
    return message;
  }
}