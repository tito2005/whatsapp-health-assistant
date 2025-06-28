import { databaseManager, safeJsonParse, safeJsonStringify } from '@/config/database';
import { logger } from '@/shared/logger';
import { Product } from '@/types/product';
import { v4 as uuidv4 } from 'uuid';

export interface ProductSearchFilters {
  category?: string;
  inStock?: boolean;
  priceRange?: { min: number; max: number };
  healthConditions?: string[];
  symptoms?: string[];
}

export class ProductDatabase {
  
  public async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    await databaseManager.waitForInitialization();
    const connection = databaseManager.getConnection();
    const id = uuidv4();
    const now = new Date();

    try {
      // Validate required fields
      this.validateProductData(productData);

      await connection.run(`
        INSERT INTO products (
          id, name, description, price, discount_price, category,
          benefits, ingredients, suitable_for, dosage, warnings, images,
          in_stock, health_conditions, symptoms, indonesian_name,
          cultural_context, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        productData.name.trim(),
        productData.description.trim(),
        productData.price,
        productData.discountPrice || null,
        productData.category,
        safeJsonStringify(productData.benefits),
        safeJsonStringify(productData.ingredients),
        safeJsonStringify(productData.suitableFor),
        productData.dosage.trim(),
        safeJsonStringify(productData.warnings || []),
        safeJsonStringify(productData.images),
        productData.inStock ? 1 : 0,
        safeJsonStringify((productData.metadata as any)?.healthConditions || []),
        safeJsonStringify((productData.metadata as any)?.symptoms || []),
        (productData.metadata as any)?.indonesianName || null,
        (productData.metadata as any)?.culturalContext || null,
        safeJsonStringify(productData.metadata),
        now.toISOString(),
        now.toISOString()
      ]);

      const product = await this.getProductById(id);
      if (!product) {
        throw new Error('Failed to create product - product not found after insertion');
      }

      logger.info('Product created successfully', { 
        productId: id, 
        name: productData.name,
        category: productData.category,
        price: productData.price
      });
      
      return product;

    } catch (error) {
      logger.error('Failed to create product', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        productName: productData.name 
      });
      throw error;
    }
  }

  public async getProductById(id: string): Promise<Product | null> {
    await databaseManager.waitForInitialization();
    const connection = databaseManager.getConnection();

    try {
      const row = await connection.get('SELECT * FROM products WHERE id = ?', [id]);
      
      if (!row) {
        return null;
      }

      return this.mapRowToProduct(row);

    } catch (error) {
      logger.error('Failed to get product by ID', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        productId: id 
      });
      throw error;
    }
  }

  public async getAllProducts(filters?: ProductSearchFilters): Promise<Product[]> {
    await databaseManager.waitForInitialization();
    const connection = databaseManager.getConnection();

    try {
      let sql = 'SELECT * FROM products';
      const params: any[] = [];
      const conditions: string[] = [];

      // Apply filters
      if (filters) {
        if (filters.category) {
          conditions.push('category = ?');
          params.push(filters.category);
        }

        if (filters.inStock !== undefined) {
          conditions.push('in_stock = ?');
          params.push(filters.inStock ? 1 : 0);
        }

        if (filters.priceRange) {
          if (filters.priceRange.min > 0) {
            conditions.push('price >= ?');
            params.push(filters.priceRange.min);
          }
          if (filters.priceRange.max > 0) {
            conditions.push('price <= ?');
            params.push(filters.priceRange.max);
          }
        }

        if (filters.healthConditions && filters.healthConditions.length > 0) {
          const healthConditions = filters.healthConditions.map(() => 'health_conditions LIKE ?').join(' OR ');
          conditions.push(`(${healthConditions})`);
          filters.healthConditions.forEach(condition => {
            params.push(`%"${condition}"%`);
          });
        }

        if (filters.symptoms && filters.symptoms.length > 0) {
          const symptoms = filters.symptoms.map(() => 'symptoms LIKE ?').join(' OR ');
          conditions.push(`(${symptoms})`);
          filters.symptoms.forEach(symptom => {
            params.push(`%"${symptom}"%`);
          });
        }
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY created_at DESC';

      const rows = await connection.all(sql, params);
      
      return rows.map(row => this.mapRowToProduct(row));

    } catch (error) {
      logger.error('Failed to get all products', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        filters 
      });
      throw error;
    }
  }

  public async getProductsByCategory(category: string): Promise<Product[]> {
    return this.getAllProducts({ category });
  }

  public async searchProductsByHealthCondition(healthCondition: string): Promise<Product[]> {
    return this.getAllProducts({ healthConditions: [healthCondition] });
  }

  public async getProductRecommendations(
    healthConcerns: string[], 
    limit: number = 10
  ): Promise<Product[]> {
    await databaseManager.waitForInitialization();
    const connection = databaseManager.getConnection();

    try {
      if (healthConcerns.length === 0) {
        const allProducts = await this.getAllProducts({ inStock: true });
        return allProducts.slice(0, limit);
      }

      // Build dynamic query to match health conditions and symptoms
      const conditions = healthConcerns.map(() => 
        '(health_conditions LIKE ? OR symptoms LIKE ?)'
      ).join(' OR ');

      const params: string[] = [];
      healthConcerns.forEach(concern => {
        const sanitizedConcern = concern.toLowerCase().trim();
        params.push(`%"${sanitizedConcern}"%`);
        params.push(`%"${sanitizedConcern}"%`);
      });

      const sql = `
        SELECT *, 
        (
          ${healthConcerns.map(() => `
            CASE WHEN health_conditions LIKE ? THEN 2 ELSE 0 END +
            CASE WHEN symptoms LIKE ? THEN 1 ELSE 0 END
          `).join(' + ')}
        ) as relevance_score
        FROM products 
        WHERE in_stock = 1 AND (${conditions})
        ORDER BY relevance_score DESC, created_at DESC
        LIMIT ?
      `;

      // Double the params for the relevance score calculation
      const allParams = [...params, ...params, limit];
      
      const rows = await connection.all(sql, allParams);
      
      const products = rows.map(row => this.mapRowToProduct(row));

      logger.info('Generated product recommendations', { 
        healthConcerns, 
        recommendedCount: products.length,
        limit
      });

      return products;

    } catch (error) {
      logger.error('Failed to get product recommendations', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        healthConcerns 
      });
      throw error;
    }
  }

  public async updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
    await databaseManager.waitForInitialization();
    const connection = databaseManager.getConnection();
    const now = new Date();

    try {
      const setClause: string[] = [];
      const params: any[] = [];

      // Build dynamic update query
      const allowedUpdates = [
        'name', 'description', 'price', 'discountPrice', 'category',
        'benefits', 'ingredients', 'suitableFor', 'dosage', 'warnings',
        'images', 'inStock', 'metadata'
      ];

      Object.entries(updates).forEach(([key, value]) => {
        if (allowedUpdates.includes(key) && value !== undefined) {
          if (key === 'discountPrice') {
            setClause.push('discount_price = ?');
            params.push(value);
          } else if (key === 'inStock') {
            setClause.push('in_stock = ?');
            params.push(value ? 1 : 0);
          } else if (Array.isArray(value)) {
            setClause.push(`${key} = ?`);
            params.push(safeJsonStringify(value));
          } else if (typeof value === 'object') {
            setClause.push(`${key} = ?`);
            params.push(safeJsonStringify(value));
          } else {
            setClause.push(`${key} = ?`);
            params.push(value);
          }
        }
      });

      if (setClause.length === 0) {
        logger.warn('No valid updates provided for product', { productId: id, updates });
        return await this.getProductById(id);
      }

      setClause.push('updated_at = ?');
      params.push(now.toISOString());
      params.push(id);

      const result = await connection.run(`
        UPDATE products 
        SET ${setClause.join(', ')} 
        WHERE id = ?
      `, params);

      if (result.changes === 0) {
        logger.warn('No product found to update', { productId: id });
        return null;
      }

      const updatedProduct = await this.getProductById(id);
      
      logger.info('Product updated successfully', { 
        productId: id,
        changesCount: result.changes,
        updatedFields: Object.keys(updates)
      });

      return updatedProduct;

    } catch (error) {
      logger.error('Failed to update product', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        productId: id 
      });
      throw error;
    }
  }

  public async deleteProduct(id: string): Promise<boolean> {
    await databaseManager.waitForInitialization();
    const connection = databaseManager.getConnection();

    try {
      const result = await connection.run('DELETE FROM products WHERE id = ?', [id]);
      
      const deleted = result.changes > 0;
      
      if (deleted) {
        logger.info('Product deleted successfully', { productId: id });
      } else {
        logger.warn('No product found to delete', { productId: id });
      }

      return deleted;

    } catch (error) {
      logger.error('Failed to delete product', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        productId: id 
      });
      throw error;
    }
  }

  public async getProductCount(): Promise<number> {
    await databaseManager.waitForInitialization();
    const connection = databaseManager.getConnection();

    try {
      const result = await connection.get('SELECT COUNT(*) as count FROM products');
      return result.count;
    } catch (error) {
      logger.error('Failed to get product count', error);
      throw error;
    }
  }

  private validateProductData(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): void {
    const requiredFields = [
      'name', 'description', 'price', 'category', 
      'benefits', 'ingredients', 'suitableFor', 'dosage'
    ];

    for (const field of requiredFields) {
      if (!productData[field as keyof typeof productData]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (productData.price <= 0) {
      throw new Error('Product price must be greater than 0');
    }

    if (productData.discountPrice && productData.discountPrice < 0) {
      throw new Error('Discount price cannot be negative');
    }

    if (!Array.isArray(productData.benefits) || productData.benefits.length === 0) {
      throw new Error('Product must have at least one benefit');
    }

    if (!Array.isArray(productData.ingredients) || productData.ingredients.length === 0) {
      throw new Error('Product must have at least one ingredient');
    }
  }

  private mapRowToProduct(row: any): Product {
    try {
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        price: row.price,
        discountPrice: row.discount_price || undefined,
        category: row.category,
        benefits: safeJsonParse(row.benefits, []),
        ingredients: safeJsonParse(row.ingredients, []),
        suitableFor: safeJsonParse(row.suitable_for, []),
        dosage: row.dosage,
        warnings: safeJsonParse(row.warnings, []),
        images: safeJsonParse(row.images, []),
        inStock: Boolean(row.in_stock),
        metadata: safeJsonParse(row.metadata, {}),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };
    } catch (error) {
      logger.error('Failed to map database row to product', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        rowId: row.id 
      });
      throw error;
    }
  }
}

export const productDatabase = new ProductDatabase();