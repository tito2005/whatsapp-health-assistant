#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { Database } from 'sqlite3';
import { promisify } from 'util';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const config = {
  databasePath: process.env.DATABASE_PATH || './data/chatbot.db',
  nodeEnv: process.env.NODE_ENV || 'development'
};

const simpleLog = {
  info: (message: string, meta?: any) => {
    console.log(`ℹ️  ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  },
  error: (message: string, error?: any) => {
    console.error(`❌ ${message}`, error?.message || error || '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(`⚠️  ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }
};

class DatabaseResetter {
  private db: Database | null = null;

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new Database(config.databasePath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  public async close(): Promise<void> {
    if (this.db) {
      const close = promisify(this.db.close.bind(this.db));
      await close();
      this.db = null;
    }
  }

  public async clearProducts(): Promise<void> {
    simpleLog.info('Clearing all products from database...');
    
    if (!this.db) {
      throw new Error('Database not connected');
    }

    const run = promisify(this.db.run.bind(this.db));
    
    try {
      // Clear products table
      await run('DELETE FROM products');
      
      // Clear related tables
      await run('DELETE FROM product_recommendations');
      
      // Reset SQLite sequence if needed
      await run('DELETE FROM sqlite_sequence WHERE name = "products"');
      
      simpleLog.info('✅ All products cleared successfully');
      
    } catch (error) {
      simpleLog.error('Failed to clear products', error);
      throw error;
    }
  }

  public async clearAllData(): Promise<void> {
    simpleLog.info('Clearing ALL data from database...');
    
    if (!this.db) {
      throw new Error('Database not connected');
    }

    const run = promisify(this.db.run.bind(this.db));
    
    try {
      // Clear all tables in dependency order
      await run('DELETE FROM product_recommendations');
      await run('DELETE FROM conversations');
      await run('DELETE FROM orders');
      await run('DELETE FROM products');
      await run('DELETE FROM customers');
      await run('DELETE FROM business_hours');
      await run('DELETE FROM special_schedules');
      
      // Reset sequences
      await run('DELETE FROM sqlite_sequence');
      
      simpleLog.info('✅ All data cleared successfully');
      
    } catch (error) {
      simpleLog.error('Failed to clear all data', error);
      throw error;
    }
  }

  public async resetDatabase(): Promise<void> {
    simpleLog.info('Resetting database completely...');
    
    try {
      // Close any existing connection
      await this.close();
      
      // Delete the database file
      if (fs.existsSync(config.databasePath)) {
        fs.unlinkSync(config.databasePath);
        simpleLog.info('Database file deleted');
      }
      
      // Delete WAL and SHM files if they exist
      const walFile = config.databasePath + '-wal';
      const shmFile = config.databasePath + '-shm';
      
      if (fs.existsSync(walFile)) {
        fs.unlinkSync(walFile);
        simpleLog.info('WAL file deleted');
      }
      
      if (fs.existsSync(shmFile)) {
        fs.unlinkSync(shmFile);
        simpleLog.info('SHM file deleted');
      }
      
      simpleLog.info('✅ Database reset completed');
      
    } catch (error) {
      simpleLog.error('Failed to reset database', error);
      throw error;
    }
  }

  public async backupDatabase(): Promise<string> {
    simpleLog.info('Creating database backup...');
    
    const backupDir = './data/backups';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `chatbot-backup-${timestamp}.db`);
    
    try {
      // Ensure backup directory exists
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      // Copy database file
      if (fs.existsSync(config.databasePath)) {
        fs.copyFileSync(config.databasePath, backupPath);
        simpleLog.info(`✅ Database backed up to: ${backupPath}`);
        return backupPath;
      } else {
        throw new Error('Database file does not exist');
      }
      
    } catch (error) {
      simpleLog.error('Failed to backup database', error);
      throw error;
    }
  }

  public async getProductCount(): Promise<number> {
    if (!this.db) {
      await this.connect();
    }

    const get = promisify(this.db!.get.bind(this.db!));
    const result = await get('SELECT COUNT(*) as count FROM products') as { count: number };
    return result.count;
  }

  public async run(): Promise<void> {
    const command = process.argv[2];
    
    try {
      await this.connect();
      
      switch (command) {
        case 'clear-products':
          await this.clearProducts();
          break;
          
        case 'clear-all':
          await this.clearAllData();
          break;
          
        case 'reset':
          await this.resetDatabase();
          break;
          
        case 'backup':
          await this.backupDatabase();
          break;
          
        case 'count':
          const count = await this.getProductCount();
          console.log(`📦 Current product count: ${count}`);
          break;
          
        default:
          console.log(`
🗄️  Database Reset Tool

Usage:
  yarn db:reset:products    - Clear only products (keeps customers/orders)
  yarn db:reset:all         - Clear all data (keeps structure)
  yarn db:reset:full        - Delete and recreate database
  yarn db:backup            - Create backup before reset
  yarn db:count             - Show current product count

Examples:
  # Safe reset with backup
  yarn db:backup && yarn db:reset:products
  
  # Full reset (use with caution)
  yarn db:reset:full
  
  # Check current state
  yarn db:count
          `);
          break;
      }
      
    } catch (error) {
      simpleLog.error('Operation failed', error);
      process.exit(1);
    } finally {
      await this.close();
    }
  }
}

// Also modify the seed-products.ts to force update
export async function forceUpdateProducts(): Promise<void> {
  console.log('🔄 Force updating products...');
  
  const resetter = new DatabaseResetter();
  try {
    await resetter.connect();
    await resetter.clearProducts();
    console.log('✅ Products cleared, ready for seeding');
  } catch (error) {
    console.error('❌ Failed to clear products for update:', error);
    throw error;
  } finally {
    await resetter.close();
  }
}

// Run if called directly
if (require.main === module) {
  const resetter = new DatabaseResetter();
  resetter.run();
}