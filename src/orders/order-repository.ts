import { DatabaseConnection, databaseManager, safeJsonParse, safeJsonStringify } from '@/config/database';
import { logger } from '@/shared/logger';
import { OrderCollection } from '@/types/order';

export interface OrderRecord {
  id: string;
  customer_id: string;
  items: string; // JSON string
  total_amount: number;
  status: 'pending' | 'collecting_info' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_method?: 'cod' | 'bank_transfer' | 'ewallet';
  shipping_address: string; // JSON string
  order_date: string;
  estimated_delivery?: string;
  notes: string | null;
  metadata: string; // JSON string
}

export interface CustomerRecord {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  address?: string;
  date_of_birth?: string;
  health_conditions: string; // JSON string
  medications: string; // JSON string
  allergies: string; // JSON string
  health_goals: string; // JSON string
  preferences: string; // JSON string
  order_history: string; // JSON string
  conversation_history: string; // JSON string
  created_at: string;
  updated_at: string;
}

export class OrderRepository {
  private connection: DatabaseConnection | null = null;

  constructor() {
    this.initializeConnection();
  }

  private async initializeConnection(): Promise<void> {
    try {
      await databaseManager.waitForInitialization();
      this.connection = databaseManager.getConnection();
      logger.info('OrderRepository initialized with database connection');
    } catch (error) {
      logger.error('Failed to initialize OrderRepository database connection', { error });
      throw error;
    }
  }

  private async ensureConnection(): Promise<DatabaseConnection> {
    if (!this.connection) {
      await this.initializeConnection();
    }
    if (!this.connection) {
      throw new Error('Database connection not available');
    }
    return this.connection;
  }

  /**
   * Create a new order in the database
   */
  public async createOrder(order: OrderCollection, customerId: string): Promise<string> {
    try {
      const connection = await this.ensureConnection();
      const orderId = this.generateOrderId();

      // Convert OrderCollection to database format
      const orderRecord: Partial<OrderRecord> = {
        id: orderId,
        customer_id: customerId,
        items: safeJsonStringify(order.items),
        total_amount: order.totalAmount + (order.shippingCost || 0),
        status: 'pending',
        payment_method: order.paymentMethod === 'transfer' ? 'bank_transfer' : order.paymentMethod as 'cod' | 'bank_transfer' | 'ewallet',
        shipping_address: safeJsonStringify({
          address: order.address,
          customerName: order.customerName,
          whatsappNumber: order.whatsappNumber,
          shippingZone: order.shippingZone,
          shippingOption: order.shippingOption
        }),
        notes: order.notes || null,
        metadata: safeJsonStringify({
          orderStep: order.orderStep,
          shippingCost: order.shippingCost,
          isComplete: order.isComplete
        })
      };

      await connection.run(`
        INSERT INTO orders (
          id, customer_id, items, total_amount, status, 
          payment_method, shipping_address, notes, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        orderRecord.id,
        orderRecord.customer_id,
        orderRecord.items,
        orderRecord.total_amount,
        orderRecord.status,
        orderRecord.payment_method,
        orderRecord.shipping_address,
        orderRecord.notes,
        orderRecord.metadata
      ]);

      logger.info('Order created successfully', { 
        orderId, 
        customerId, 
        totalAmount: orderRecord.total_amount 
      });

      return orderId;

    } catch (error) {
      logger.error('Failed to create order', { error, customerId });
      throw error;
    }
  }

  /**
   * Update an existing order
   */
  public async updateOrder(orderId: string, updates: Partial<OrderCollection>): Promise<void> {
    try {
      const connection = await this.ensureConnection();
      
      // Build dynamic update query based on provided fields
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (updates.items !== undefined) {
        updateFields.push('items = ?');
        updateValues.push(safeJsonStringify(updates.items));
      }

      if (updates.totalAmount !== undefined) {
        updateFields.push('total_amount = ?');
        updateValues.push(updates.totalAmount + (updates.shippingCost || 0));
      }

      if (updates.paymentMethod !== undefined) {
        updateFields.push('payment_method = ?');
        updateValues.push(updates.paymentMethod);
      }

      if (updates.address || updates.customerName || updates.whatsappNumber) {
        // Get current shipping address to merge updates
        const currentOrder = await this.getOrderById(orderId);
        if (currentOrder) {
          const currentShipping = safeJsonParse(currentOrder.shipping_address, {});
          const updatedShipping = {
            ...currentShipping,
            ...(updates.address && { address: updates.address }),
            ...(updates.customerName && { customerName: updates.customerName }),
            ...(updates.whatsappNumber && { whatsappNumber: updates.whatsappNumber }),
            ...(updates.shippingZone && { shippingZone: updates.shippingZone }),
            ...(updates.shippingOption && { shippingOption: updates.shippingOption })
          };
          
          updateFields.push('shipping_address = ?');
          updateValues.push(safeJsonStringify(updatedShipping));
        }
      }

      if (updates.notes !== undefined) {
        updateFields.push('notes = ?');
        updateValues.push(updates.notes);
      }

      if (updateFields.length === 0) {
        logger.warn('No fields to update in order', { orderId });
        return;
      }

      updateValues.push(orderId);

      await connection.run(`
        UPDATE orders 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, updateValues);

      logger.info('Order updated successfully', { orderId, updatedFields: updateFields });

    } catch (error) {
      logger.error('Failed to update order', { error, orderId });
      throw error;
    }
  }

  /**
   * Update order status
   */
  public async updateOrderStatus(
    orderId: string, 
    status: OrderRecord['status'],
    estimatedDelivery?: string
  ): Promise<void> {
    try {
      const connection = await this.ensureConnection();
      
      const updateQuery = estimatedDelivery 
        ? 'UPDATE orders SET status = ?, estimated_delivery = ? WHERE id = ?'
        : 'UPDATE orders SET status = ? WHERE id = ?';
      
      const params = estimatedDelivery 
        ? [status, estimatedDelivery, orderId]
        : [status, orderId];

      await connection.run(updateQuery, params);

      logger.info('Order status updated', { orderId, status, estimatedDelivery });

    } catch (error) {
      logger.error('Failed to update order status', { error, orderId, status });
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  public async getOrderById(orderId: string): Promise<OrderRecord | null> {
    try {
      const connection = await this.ensureConnection();
      
      const order = await connection.get(
        'SELECT * FROM orders WHERE id = ?',
        [orderId]
      );

      return order || null;

    } catch (error) {
      logger.error('Failed to get order by ID', { error, orderId });
      throw error;
    }
  }

  /**
   * Get orders by customer ID
   */
  public async getOrdersByCustomerId(customerId: string): Promise<OrderRecord[]> {
    try {
      const connection = await this.ensureConnection();
      
      const orders = await connection.all(
        'SELECT * FROM orders WHERE customer_id = ? ORDER BY order_date DESC',
        [customerId]
      );

      return orders;

    } catch (error) {
      logger.error('Failed to get orders by customer ID', { error, customerId });
      throw error;
    }
  }

  /**
   * Get or create customer by phone number
   */
  public async getOrCreateCustomer(phone: string, name?: string): Promise<string> {
    try {
      const connection = await this.ensureConnection();
      
      // Try to find existing customer
      let customer = await connection.get(
        'SELECT * FROM customers WHERE phone = ?',
        [phone]
      );

      if (customer) {
        // Update name if provided and different
        if (name && customer.name !== name) {
          await connection.run(
            'UPDATE customers SET name = ? WHERE id = ?',
            [name, customer.id]
          );
        }
        return customer.id;
      }

      // Create new customer
      const customerId = this.generateCustomerId();
      await connection.run(`
        INSERT INTO customers (
          id, phone, name, preferences
        ) VALUES (?, ?, ?, ?)
      `, [
        customerId,
        phone,
        name || null,
        safeJsonStringify({
          language: 'id',
          communicationStyle: 'casual',
          notificationSettings: {
            orderUpdates: true,
            healthTips: true,
            productRecommendations: true
          }
        })
      ]);

      logger.info('New customer created', { customerId, phone, name });
      return customerId;

    } catch (error) {
      logger.error('Failed to get or create customer', { error, phone });
      throw error;
    }
  }

  /**
   * Convert database OrderRecord to OrderCollection
   */
  public convertToOrderCollection(orderRecord: OrderRecord): OrderCollection {
    const shippingAddress = safeJsonParse(orderRecord.shipping_address, {});
    const metadata = safeJsonParse(orderRecord.metadata, {});

    return {
      items: safeJsonParse(orderRecord.items, []),
      totalAmount: orderRecord.total_amount - (metadata.shippingCost || 0),
      shippingCost: metadata.shippingCost || 0,
      isComplete: metadata.isComplete || false,
      customerName: shippingAddress.customerName,
      whatsappNumber: shippingAddress.whatsappNumber,
      address: shippingAddress.address,
      paymentMethod: orderRecord.payment_method === 'bank_transfer' ? 'transfer' : orderRecord.payment_method as 'cod' | 'transfer',
      shippingZone: shippingAddress.shippingZone,
      shippingOption: shippingAddress.shippingOption,
      notes: orderRecord.notes || undefined,
      orderStep: metadata.orderStep
    };
  }

  /**
   * Get orders with pagination and filtering
   */
  public async getOrders(
    filters: {
      customerId?: string;
      status?: OrderRecord['status'];
      startDate?: string;
      endDate?: string;
    } = {},
    pagination: { limit?: number; offset?: number } = {}
  ): Promise<{ orders: OrderRecord[]; total: number }> {
    try {
      const connection = await this.ensureConnection();
      
      // Build WHERE clause
      const whereConditions: string[] = [];
      const whereParams: any[] = [];

      if (filters.customerId) {
        whereConditions.push('customer_id = ?');
        whereParams.push(filters.customerId);
      }

      if (filters.status) {
        whereConditions.push('status = ?');
        whereParams.push(filters.status);
      }

      if (filters.startDate) {
        whereConditions.push('order_date >= ?');
        whereParams.push(filters.startDate);
      }

      if (filters.endDate) {
        whereConditions.push('order_date <= ?');
        whereParams.push(filters.endDate);
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total count
      const countResult = await connection.get(
        `SELECT COUNT(*) as total FROM orders ${whereClause}`,
        whereParams
      );

      // Get orders with pagination
      const limit = pagination.limit || 50;
      const offset = pagination.offset || 0;
      
      const orders = await connection.all(
        `SELECT * FROM orders ${whereClause} 
         ORDER BY order_date DESC 
         LIMIT ? OFFSET ?`,
        [...whereParams, limit, offset]
      );

      return {
        orders,
        total: countResult.total
      };

    } catch (error) {
      logger.error('Failed to get orders with filters', { error, filters });
      throw error;
    }
  }

  /**
   * Delete an order (soft delete by changing status)
   */
  public async deleteOrder(orderId: string): Promise<void> {
    try {
      const connection = await this.ensureConnection();
      
      await connection.run(
        'UPDATE orders SET status = ? WHERE id = ?',
        ['cancelled', orderId]
      );

      logger.info('Order cancelled (soft deleted)', { orderId });

    } catch (error) {
      logger.error('Failed to delete order', { error, orderId });
      throw error;
    }
  }

  private generateOrderId(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${dateStr}-${timeStr}-${random}`;
  }

  private generateCustomerId(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `CUST-${dateStr}-${random}`;
  }
}