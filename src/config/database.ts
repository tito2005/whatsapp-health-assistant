import { config } from '@/config/environment';
import { logger } from '@/shared/logger';
import * as fs from 'fs';
import * as path from 'path';
import { Database } from 'sqlite3';
import { promisify } from 'util';

export interface DatabaseConnection {
  db: Database;
  run: (_sql: string, _params?: any[]) => Promise<any>;
  get: (_sql: string, _params?: any[]) => Promise<any>;
  all: (_sql: string, _params?: any[]) => Promise<any[]>;
  close: () => Promise<void>;
}

class DatabaseManager {
  private db: Database | null = null;
  private connected: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.initializationPromise = this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      const dataDir = path.dirname(config.databasePath);
      
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        logger.info('Created database directory', { path: dataDir });
      }

      this.db = new Database(config.databasePath, (err) => {
        if (err) {
          logger.error('Failed to connect to SQLite database', err);
          this.connected = false;
          return;
        }
        this.connected = true;
        logger.info('SQLite database connected', { 
          path: config.databasePath
        });
      });

      if (this.db) {
        const run = promisify(this.db.run.bind(this.db));
        await run('PRAGMA foreign_keys = ON');
        await run('PRAGMA journal_mode = WAL');
        await run('PRAGMA synchronous = NORMAL');
      }

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
      // Generic conversations table for any sector
      await run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          messages TEXT NOT NULL DEFAULT '[]',
          metadata TEXT DEFAULT '{}',
          last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Generic data table for sector-specific information
      await run(`
        CREATE TABLE IF NOT EXISTS sector_data (
          id TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          data TEXT NOT NULL DEFAULT '{}',
          active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // User interactions tracking
      await run(`
        CREATE TABLE IF NOT EXISTS user_interactions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          interaction_type TEXT NOT NULL,
          data TEXT DEFAULT '{}',
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations (user_id)',
        'CREATE INDEX IF NOT EXISTS idx_conversations_activity ON conversations (last_activity DESC)',
        'CREATE INDEX IF NOT EXISTS idx_sector_data_category ON sector_data (category)',
        'CREATE INDEX IF NOT EXISTS idx_sector_data_active ON sector_data (active)',
        'CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON user_interactions (user_id)',
        'CREATE INDEX IF NOT EXISTS idx_user_interactions_timestamp ON user_interactions (timestamp DESC)'
      ];

      for (const indexSql of indexes) {
        await run(indexSql);
      }

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

    const run: (_sql: string, _params?: any[]) => Promise<any> = promisify(this.db.run.bind(this.db));
    const get: (_sql: string, _params?: any[]) => Promise<any> = promisify(this.db.get.bind(this.db));
    const all: (_sql: string, _params?: any[]) => Promise<any[]> = promisify(this.db.all.bind(this.db));
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

      const connection = this.getConnection();
      const conversationCount = await connection.get('SELECT COUNT(*) as count FROM conversations');
      const dataCount = await connection.get('SELECT COUNT(*) as count FROM sector_data');
      
      return {
        healthy: true,
        message: 'Database healthy',
        details: {
          connected: this.connected,
          conversationCount: conversationCount.count,
          dataCount: dataCount.count,
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

export const databaseManager = new DatabaseManager();
export default databaseManager;