#!/usr/bin/env ts-node

// ISOLATED DATABASE SETUP - NO WHATSAPP IMPORTS
// This script only imports database-related modules to avoid sonic boom error

import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Database } from 'sqlite3';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config();

// Simple logger to avoid importing complex logging system
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

// Minimal config (avoid importing full config that might trigger WhatsApp)
const config = {
  databasePath: process.env.DATABASE_PATH || './data/chatbot.db',
  nodeEnv: process.env.NODE_ENV || 'development'
};

// Database connection interface
interface DatabaseConnection {
  db: Database;
  run: (sql: string, params?: any[]) => Promise<any>;
  get: (sql: string, params?: any[]) => Promise<any>;
  all: (sql: string, params?: any[]) => Promise<any[]>;
  close: () => Promise<void>;
}

class IsolatedDatabaseManager {
  private db: Database | null = null;
  private connected: boolean = false;

  async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(config.databasePath);
      
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        simpleLog.info(`Created database directory: ${dataDir}`);
      }

      // Connect to SQLite database
      this.db = new Database(config.databasePath, (err) => {
        if (err) {
          simpleLog.error('Failed to connect to SQLite database', err);
          throw err;
        }
        this.connected = true;
        simpleLog.info('SQLite database connected successfully');
      });

      // Enable foreign keys and optimize
      if (this.db) {
        const run = promisify(this.db.run.bind(this.db));
        await run('PRAGMA foreign_keys = ON');
        await run('PRAGMA journal_mode = WAL');
        await run('PRAGMA synchronous = NORMAL');
      }

      // Create tables
      await this.createTables();
      
    } catch (error) {
      simpleLog.error('Database initialization failed', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const run = promisify(this.db.run.bind(this.db));

    try {
      // Products table
      await run(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          price REAL NOT NULL CHECK(price > 0),
          discount_price REAL CHECK(discount_price >= 0),
          category TEXT NOT NULL,
          benefits TEXT NOT NULL,
          ingredients TEXT NOT NULL,
          suitable_for TEXT NOT NULL,
          dosage TEXT NOT NULL,
          warnings TEXT DEFAULT '[]',
          images TEXT NOT NULL DEFAULT '[]',
          in_stock BOOLEAN DEFAULT 1,
          health_conditions TEXT NOT NULL DEFAULT '[]',
          symptoms TEXT NOT NULL DEFAULT '[]',
          indonesian_name TEXT DEFAULT NULL,
          cultural_context TEXT DEFAULT NULL,
          metadata TEXT DEFAULT '{}',
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
          health_conditions TEXT DEFAULT '[]',
          medications TEXT DEFAULT '[]',
          allergies TEXT DEFAULT '[]',
          health_goals TEXT DEFAULT '[]',
          preferences TEXT NOT NULL DEFAULT '{"language":"id","communicationStyle":"casual","notificationSettings":{"orderUpdates":true,"healthTips":true,"productRecommendations":true}}',
          order_history TEXT DEFAULT '[]',
          conversation_history TEXT DEFAULT '[]',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Orders table
      await run(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          items TEXT NOT NULL,
          total_amount REAL NOT NULL CHECK(total_amount >= 0),
          status TEXT NOT NULL DEFAULT 'pending',
          payment_method TEXT,
          shipping_address TEXT NOT NULL,
          order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          estimated_delivery DATE DEFAULT NULL,
          notes TEXT DEFAULT NULL,
          metadata TEXT DEFAULT '{}',
          FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
        )
      `);

      // Conversations table
      await run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'greeting',
          health_concerns TEXT DEFAULT '[]',
          recommended_products TEXT DEFAULT '[]',
          order_in_progress TEXT DEFAULT NULL,
          messages TEXT NOT NULL DEFAULT '[]',
          last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
          metadata TEXT DEFAULT '{}',
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
          health_context TEXT NOT NULL,
          recommended_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          customer_response TEXT DEFAULT NULL,
          FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
        )
      `);

      // Create indexes
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone)',
        'CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id)',
        'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)',
        'CREATE INDEX IF NOT EXISTS idx_products_category ON products (category)',
        'CREATE INDEX IF NOT EXISTS idx_products_stock ON products (in_stock)'
      ];

      for (const indexSql of indexes) {
        await run(indexSql);
      }

      simpleLog.info('Database tables and indexes created successfully');

    } catch (error) {
      simpleLog.error('Failed to create database tables', error);
      throw error;
    }
  }

  getConnection(): DatabaseConnection {
    if (!this.db || !this.connected) {
      throw new Error('Database not connected');
    }

    return {
      db: this.db,
      run: promisify(this.db.run.bind(this.db)),
      get: promisify(this.db.get.bind(this.db)),
      all: promisify(this.db.all.bind(this.db)),
      close: promisify(this.db.close.bind(this.db))
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  async close(): Promise<void> {
    if (this.db && this.connected) {
      const close = promisify(this.db.close.bind(this.db));
      await close();
      this.connected = false;
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message: string; details: any }> {
    try {
      if (!this.connected || !this.db) {
        return {
          healthy: false,
          message: 'Database not connected',
          details: { connected: this.connected, db: !!this.db }
        };
      }

      const connection = this.getConnection();
      const productCount = await connection.get('SELECT COUNT(*) as count FROM products');
      
      return {
        healthy: true,
        message: 'Database healthy',
        details: {
          connected: this.connected,
          productCount: productCount.count,
          databasePath: config.databasePath
        }
      };

    } catch (error) {
      return {
        healthy: false,
        message: 'Database health check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

// Health product data (embedded to avoid imports)
const healthProducts = [
  {
    name: 'HOTTO PURTO OAT',
    description: 'Minuman kesehatan tinggi serat yang kaya akan nutrisi dan rendah kalori. Diformulasikan dengan ubi ungu, oat premium Swedia, dan 15 jenis multigrain.',
    price: 295000,
    discountPrice: 570000,
    category: 'general_wellness',
    benefits: [
      'Menurunkan kolesterol jahat (LDL) dengan beta-glucan oat Swedia',
      'Menstabilkan gula darah tinggi',
      'Mengatasi asam lambung (GERD & Maag)',
      'Melancarkan pencernaan dengan 15 multigrain',
      'Antioksidan tinggi dari ubi ungu (20x vitamin C)',
      'Memberikan rasa kenyang lebih lama (cocok diet)',
      'Meningkatkan imunitas tubuh'
    ],
    ingredients: ['Ubi ungu', 'Oat premium Swedia', '15 jenis multigrain', 'Beta-glucan', '12 vitamin', '9 mineral'],
    suitableFor: ['Semua usia 5+', 'Penderita diabetes', 'Penderita kolesterol tinggi', 'Penderita GERD dan maag', 'Yang sedang diet', 'Ibu hamil dan menyusui'],
    dosage: '1x sehari untuk maintenance kesehatan, 2-3x sehari untuk mengatasi masalah kesehatan',
    warnings: ['Minum air putih yang cukup setelah konsumsi'],
    images: ['hotto-purto-oat.jpg'],
    inStock: true,
    healthConditions: ['kolesterol tinggi', 'diabetes', 'gula darah tinggi', 'asam lambung', 'GERD', 'maag'],
    symptoms: ['kolesterol naik', 'gula darah tidak stabil', 'perut perih', 'heartburn', 'kembung'],
    metadata: { bundleDiscount: 20000, calories: 120 }
  },
  {
    name: 'mGANIK METAFIBER',
    description: 'Pemblokir glukosa khusus untuk diabetes dengan formula SugarBlocker+ yang mencegah lonjakan gula darah setelah makan.',
    price: 350000,
    category: 'diabetes_support',
    benefits: [
      'Pemblokir glukosa untuk diabetes',
      'Mencegah lonjakan gula darah setelah makan',
      'Formula SugarBlocker+ dengan psyllium husk',
      'Membantu mencapai remisi diabetes'
    ],
    ingredients: ['Psyllium husk premium', 'Cannellini bean extract', 'Chromium picolinate', 'Alpha lipoic acid'],
    suitableFor: ['Diabetes tipe 2', 'Pre-diabetes', 'Gula darah tinggi'],
    dosage: '1 sachet 30 menit sebelum makan utama, 2-3x sehari',
    warnings: ['Konsultasi dokter jika menggunakan obat diabetes'],
    images: ['mganik-metafiber.jpg'],
    inStock: true,
    healthConditions: ['diabetes tipe 2', 'pre-diabetes', 'gula darah tinggi'],
    symptoms: ['gula darah naik', 'sering haus', 'sering kencing'],
    metadata: { targetHbA1c: '<7%' }
  },
  {
    name: 'mGANIK 3PEPTIDE',
    description: 'Formula Tensiprotect dengan 3 jenis peptide anti-hipertensi untuk menurunkan tekanan darah tinggi.',
    price: 380000,
    category: 'cardiovascular',
    benefits: [
      'Anti-hipertensi dengan 3 jenis peptide',
      'Menurunkan tekanan darah tinggi',
      'Kesehatan jantung dan pembuluh darah',
      'Mengandung CoQ10 untuk jantung'
    ],
    ingredients: ['Salmon ovary peptide', 'Rice peptide', 'Soy oligopeptide', 'CoQ10', 'Resveratrol'],
    suitableFor: ['Hipertensi', 'Tekanan darah tinggi', 'Risiko penyakit jantung'],
    dosage: '1 sachet 2x sehari, pagi dan sore',
    warnings: ['Konsultasi dokter jika menggunakan obat hipertensi'],
    images: ['mganik-3peptide.jpg'],
    inStock: true,
    healthConditions: ['hipertensi', 'darah tinggi', 'penyakit jantung'],
    symptoms: ['tekanan darah tinggi', 'pusing', 'sakit kepala', 'jantung berdebar'],
    metadata: { targetBP: '<140/90 mmHg' }
  },
  {
    name: 'SPENCERS MEALBLEND',
    description: 'Meal replacement dengan 14 varian rasa yang low calorie, low sugar, high protein dan high fiber.',
    price: 250000,
    category: 'weight_management',
    benefits: [
      '14 varian rasa lezat',
      'Low calorie (140kkal)',
      'High protein (15g)',
      'High fiber (9g)',
      'Lactose free, gluten free, vegan friendly'
    ],
    ingredients: ['Plant protein blend', 'Fiber kompleks', 'Vitamin dan mineral'],
    suitableFor: ['Program diet', 'Weight management', 'Vegetarian/vegan'],
    dosage: '1-2 serving sebagai pengganti makan utama',
    images: ['spencers-mealblend.jpg'],
    inStock: true,
    healthConditions: ['obesitas', 'berat badan berlebih'],
    symptoms: ['berat badan naik', 'mudah lapar'],
    metadata: { calories: 140, protein: '15g' }
  },
  {
    name: 'FLIMTY FIBER',
    description: 'Detox fiber dengan psyllium husk premium yang menyerap minyak, lemak, dan gula dari makanan.',
    price: 200000,
    category: 'digestive_health',
    benefits: [
      'Menyerap minyak, lemak, gula dari makanan',
      'Efek kenyang hingga 30% lebih lama',
      'Tinggi serat (5g per sachet)',
      'Detox pencernaan'
    ],
    ingredients: ['Psyllium husk premium', 'Goji berry', 'Bit merah', 'Pomegranate'],
    suitableFor: ['Detox pencernaan', 'Susah BAB', 'Kolesterol tinggi'],
    dosage: '1 sachet sebelum makan, 1-2x sehari',
    images: ['flimty-fiber.jpg'],
    inStock: true,
    healthConditions: ['sembelit', 'kolesterol tinggi', 'pencernaan bermasalah'],
    symptoms: ['susah BAB', 'perut kembung', 'kolesterol naik'],
    metadata: { fiberContent: '5g' }
  }
];

// Safe JSON helpers
const safeJsonStringify = (obj: any): string => {
  try {
    return JSON.stringify(obj);
  } catch {
    return '{}';
  }
};

async function seedProducts(dbManager: IsolatedDatabaseManager): Promise<void> {
  const connection = dbManager.getConnection();
  
  try {
    // Check if products already exist
    const existingCount = await connection.get('SELECT COUNT(*) as count FROM products');
    if (existingCount.count > 0) {
      simpleLog.info(`Products already exist (${existingCount.count}), skipping seed`);
      return;
    }

    simpleLog.info(`Seeding ${healthProducts.length} health products...`);
    
    let created = 0;
    for (const product of healthProducts) {
      try {
        const id = uuidv4();
        const now = new Date().toISOString();
        
        await connection.run(`
          INSERT INTO products (
            id, name, description, price, discount_price, category,
            benefits, ingredients, suitable_for, dosage, warnings, images,
            in_stock, health_conditions, symptoms, metadata, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id, product.name, product.description, product.price,
          product.discountPrice || null, product.category,
          safeJsonStringify(product.benefits),
          safeJsonStringify(product.ingredients),
          safeJsonStringify(product.suitableFor),
          product.dosage,
          safeJsonStringify(product.warnings || []),
          safeJsonStringify(product.images),
          product.inStock ? 1 : 0,
          safeJsonStringify(product.healthConditions),
          safeJsonStringify(product.symptoms),
          safeJsonStringify(product.metadata),
          now, now
        ]);
        
        created++;
        simpleLog.info(`✅ Created: ${product.name}`);
        
      } catch (error) {
        simpleLog.error(`Failed to create product: ${product.name}`, error);
      }
    }
    
    simpleLog.info(`Successfully created ${created}/${healthProducts.length} products`);
    
  } catch (error) {
    simpleLog.error('Product seeding failed', error);
    throw error;
  }
}

async function runHealthCheck(dbManager: IsolatedDatabaseManager): Promise<void> {
  const health = await dbManager.healthCheck();
  
  console.log('\n🏥 DATABASE HEALTH CHECK');
  console.log('========================');
  console.log(`Status: ${health.healthy ? '✅ Healthy' : '❌ Issues'}`);
  console.log(`Message: ${health.message}`);
  
  if (health.details.productCount !== undefined) {
    console.log(`Products: ${health.details.productCount}`);
  }
  
  console.log(`Database: ${health.details.databasePath || config.databasePath}`);
  console.log('');
}

async function showProductSummary(dbManager: IsolatedDatabaseManager): Promise<void> {
  const connection = dbManager.getConnection();
  
  try {
    const products = await connection.all('SELECT * FROM products ORDER BY created_at DESC');
    const totalProducts = products.length;
    const inStock = products.filter(p => p.in_stock).length;
    const avgPrice = totalProducts > 0 ? products.reduce((sum, p) => sum + p.price, 0) / totalProducts : 0;
    
    // Count by category
    const categories: Record<string, number> = {};
    products.forEach(product => {
      categories[product.category] = (categories[product.category] || 0) + 1;
    });
    
    console.log('\n🏥 HEALTH PRODUCT DATABASE SUMMARY');
    console.log('=====================================');
    console.log(`📦 Total Products: ${totalProducts}`);
    console.log(`✅ In Stock: ${inStock}`);
    console.log(`💰 Average Price: Rp ${Math.round(avgPrice).toLocaleString()}`);
    console.log('\n📊 Products by Category:');
    
    Object.entries(categories).forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`);
    });
    
    if (products.length > 0) {
      console.log('\n🔥 Products:');
      products.forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.name} - Rp ${product.price.toLocaleString()}`);
      });
    }
    
    console.log('\n✅ Database ready for health consultations!\n');
    
  } catch (error) {
    simpleLog.error('Failed to show product summary', error);
  }
}

async function setupDatabase(): Promise<void> {
  const dbManager = new IsolatedDatabaseManager();
  
  try {
    console.log('🗄️  ISOLATED DATABASE SETUP');
    console.log('============================');
    console.log('Setting up database without any WhatsApp dependencies...\n');
    
    // Initialize database
    console.log('📁 Initializing database...');
    await dbManager.initialize();
    console.log('✅ Database initialized');
    
    // Seed products
    console.log('🌱 Seeding products...');
    await seedProducts(dbManager);
    console.log('✅ Products seeded');
    
    // Verify
    console.log('🧪 Running verification...');
    const health = await dbManager.healthCheck();
    if (!health.healthy) {
      throw new Error(`Verification failed: ${health.message}`);
    }
    console.log('✅ Verification passed');
    
    // Show summary
    await showProductSummary(dbManager);
    
    console.log('🎉 Database setup completed successfully!');
    
  } catch (error) {
    simpleLog.error('Database setup failed', error);
    throw error;
  } finally {
    await dbManager.close();
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'setup':
        await setupDatabase();
        break;
        
      case 'health':
        const dbManager = new IsolatedDatabaseManager();
        await dbManager.initialize();
        await runHealthCheck(dbManager);
        await dbManager.close();
        break;
        
      case 'summary':
        const summaryManager = new IsolatedDatabaseManager();
        await summaryManager.initialize();
        await showProductSummary(summaryManager);
        await summaryManager.close();
        break;
        
      default:
        console.log(`
🗄️  Isolated Database Setup Tool

Usage:
  yarn db:setup:isolated     - Complete database setup (no WhatsApp)
  yarn db:health:isolated    - Health check only
  yarn db:summary:isolated   - Show product summary

This tool completely avoids WhatsApp imports to prevent sonic boom errors.
        `);
        break;
    }
    
  } catch (error) {
    console.error('\n❌ Operation failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}