import { config } from '@/config/environment';
import { logger } from '@/shared/logger';
import * as fs from 'fs';
import * as path from 'path';
import { Database } from 'sqlite3';
import { promisify } from 'util';

export interface DatabaseConnection {
  db: Database;
  run: (sql: string, params?: any[]) => Promise<any>;
  get: (sql: string, params?: any[]) => Promise<any>;
  all: (sql: string, params?: any[]) => Promise<any[]>;
  close: () => Promise<void>;
}

class DatabaseManager {
  private db: Database | null = null;
  private connected: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    // Auto-initialize on first access
    this.initializationPromise = this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(config.databasePath);
      
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        logger.info('Created database directory', { path: dataDir });
      }

      // Connect to SQLite database
      this.db = new Database(config.databasePath, (err) => {
        if (err) {
          logger.error('Failed to connect to SQLite database', err);
          this.connected = false;
          return;
        }
        this.connected = true;
        logger.info('SQLite database connected', { 
          path: config.databasePath,
          node_env: config.nodeEnv 
        });
      });

      // Enable foreign keys and WAL mode for better performance
      if (this.db) {
        const run = promisify(this.db.run.bind(this.db));
        await run('PRAGMA foreign_keys = ON');
        await run('PRAGMA journal_mode = WAL');
        await run('PRAGMA synchronous = NORMAL');
        await run('PRAGMA cache_size = 1000');
        await run('PRAGMA temp_store = MEMORY');
      }

      // Create tables
      await this.createTables();
      
    } catch (error) {
      logger.error('Database initialization failed', error);
      this.connected = false;
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const run = promisify(this.db.run.bind(this.db));

    try {
      // Products table with health-specific fields
      await run(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          price REAL NOT NULL CHECK(price > 0),
          discount_price REAL CHECK(discount_price >= 0),
          category TEXT NOT NULL,
          benefits TEXT NOT NULL, -- JSON array
          ingredients TEXT NOT NULL, -- JSON array
          suitable_for TEXT NOT NULL, -- JSON array
          dosage TEXT NOT NULL,
          warnings TEXT DEFAULT '[]', -- JSON array
          images TEXT NOT NULL DEFAULT '[]', -- JSON array
          in_stock BOOLEAN DEFAULT 1,
          health_conditions TEXT NOT NULL DEFAULT '[]', -- JSON array for matching
          symptoms TEXT NOT NULL DEFAULT '[]', -- JSON array for matching
          indonesian_name TEXT DEFAULT NULL,
          cultural_context TEXT DEFAULT NULL,
          metadata TEXT DEFAULT '{}', -- JSON object
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Customers table
      await run(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          phone TEXT NOT NULL UNIQUE,
          name TEXT DEFAULT NULL,
          email TEXT DEFAULT NULL,
          address TEXT DEFAULT NULL,
          date_of_birth DATE DEFAULT NULL,
          health_conditions TEXT DEFAULT '[]', -- JSON array
          medications TEXT DEFAULT '[]', -- JSON array
          allergies TEXT DEFAULT '[]', -- JSON array
          health_goals TEXT DEFAULT '[]', -- JSON array
          preferences TEXT NOT NULL DEFAULT '{"language":"id","communicationStyle":"casual","notificationSettings":{"orderUpdates":true,"healthTips":true,"productRecommendations":true}}', -- JSON object
          order_history TEXT DEFAULT '[]', -- JSON array of order IDs
          conversation_history TEXT DEFAULT '[]', -- JSON array of conversation IDs
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Orders table
      await run(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          items TEXT NOT NULL, -- JSON array of order items
          total_amount REAL NOT NULL CHECK(total_amount >= 0),
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'collecting_info', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
          payment_method TEXT CHECK(payment_method IN ('cod', 'bank_transfer', 'ewallet')),
          shipping_address TEXT NOT NULL, -- JSON object
          order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          estimated_delivery DATE DEFAULT NULL,
          notes TEXT DEFAULT NULL,
          metadata TEXT DEFAULT '{}', -- JSON object
          FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
        )
      `);

      // Conversations table
      await run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'greeting' CHECK(state IN ('greeting', 'health_inquiry', 'product_recommendation', 'order_collection', 'order_confirmation', 'lifestyle_advice', 'completed')),
          health_concerns TEXT DEFAULT '[]', -- JSON array
          recommended_products TEXT DEFAULT '[]', -- JSON array
          order_in_progress TEXT DEFAULT NULL, -- JSON object
          messages TEXT NOT NULL DEFAULT '[]', -- JSON array of conversation messages
          last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
          metadata TEXT DEFAULT '{}', -- JSON object
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
        )
      `);

      // Product recommendations tracking
      await run(`
        CREATE TABLE IF NOT EXISTS product_recommendations (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          relevance_score REAL NOT NULL CHECK(relevance_score >= 0 AND relevance_score <= 1),
          reason TEXT NOT NULL,
          health_context TEXT NOT NULL, -- JSON object
          recommended_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          customer_response TEXT DEFAULT NULL CHECK(customer_response IN ('interested', 'purchased', 'declined', NULL)),
          FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
        )
      `);

      // Create indexes for better performance
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone)',
        'CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id)',
        'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)',
        'CREATE INDEX IF NOT EXISTS idx_orders_date ON orders (order_date DESC)',
        'CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON conversations (customer_id)',
        'CREATE INDEX IF NOT EXISTS idx_conversations_state ON conversations (state)',
        'CREATE INDEX IF NOT EXISTS idx_conversations_activity ON conversations (last_activity DESC)',
        'CREATE INDEX IF NOT EXISTS idx_products_category ON products (category)',
        'CREATE INDEX IF NOT EXISTS idx_products_stock ON products (in_stock)',
        'CREATE INDEX IF NOT EXISTS idx_recommendations_customer_id ON product_recommendations (customer_id)',
        'CREATE INDEX IF NOT EXISTS idx_recommendations_date ON product_recommendations (recommended_at DESC)'
      ];

      for (const indexSql of indexes) {
        await run(indexSql);
      }

      // Create triggers for updated_at timestamps
      await run(`
        CREATE TRIGGER IF NOT EXISTS update_products_timestamp 
        AFTER UPDATE ON products
        BEGIN
          UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
      `);

      await run(`
        CREATE TRIGGER IF NOT EXISTS update_customers_timestamp 
        AFTER UPDATE ON customers
        BEGIN
          UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
      `);

      await run(`
        CREATE TRIGGER IF NOT EXISTS update_conversations_activity 
        AFTER UPDATE ON conversations
        BEGIN
          UPDATE conversations SET last_activity = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
      `);

      logger.info('Database tables and indexes created successfully');

    } catch (error) {
      logger.error('Failed to create database tables', error);
      throw error;
    }
  }

  public async waitForInitialization(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  public getConnection(): DatabaseConnection {
    if (!this.db || !this.connected) {
      throw new Error('Database not connected. Call waitForInitialization() first.');
    }

    const run: (sql: string, params?: any[]) => Promise<any> = promisify(this.db.run.bind(this.db));
    const get: (sql: string, params?: any[]) => Promise<any> = promisify(this.db.get.bind(this.db));
    const all: (sql: string, params?: any[]) => Promise<any[]> = promisify(this.db.all.bind(this.db));
    const close: () => Promise<void> = promisify(this.db.close.bind(this.db));

    return {
      db: this.db,
      run,
      get,
      all,
      close
    };
  }

  public async close(): Promise<void> {
    if (this.db && this.connected) {
      try {
        const close = promisify(this.db.close.bind(this.db));
        await close();
        this.connected = false;
        this.db = null;
        logger.info('Database connection closed');
      } catch (error) {
        logger.error('Error closing database connection', error);
        throw error;
      }
    }
  }

  public isConnected(): boolean {
    return this.connected && this.db !== null;
  }

  public async healthCheck(): Promise<{ healthy: boolean; message: string; details: any }> {
    try {
      if (!this.connected || !this.db) {
        return {
          healthy: false,
          message: 'Database not connected',
          details: { connected: this.connected, db: !!this.db }
        };
      }

      // Test basic query
      const connection = this.getConnection();
      
      // Count records in main tables
      const productCount = await connection.get('SELECT COUNT(*) as count FROM products');
      const customerCount = await connection.get('SELECT COUNT(*) as count FROM customers');
      
      return {
        healthy: true,
        message: 'Database healthy',
        details: {
          connected: this.connected,
          productCount: productCount.count,
          customerCount: customerCount.count,
          databasePath: config.databasePath
        }
      };

    } catch (error) {
      logger.error('Database health check failed', error);
      return {
        healthy: false,
        message: 'Database health check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

// Singleton instance
export const databaseManager = new DatabaseManager();

// Helper function for safe JSON parsing
export const safeJsonParse = (json: string, defaultValue: any = null): any => {
  try {
    return JSON.parse(json);
  } catch (error) {
    logger.warn('Failed to parse JSON', { json: json.substring(0, 100), error });
    return defaultValue;
  }
};

// Helper function for safe JSON stringifying
export const safeJsonStringify = (obj: any): string => {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    logger.warn('Failed to stringify object', { error });
    return '{}';
  }
};

export default databaseManager;