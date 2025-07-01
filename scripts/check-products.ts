#!/usr/bin/env ts-node
import { productDatabase } from '../src/products/product-database';
import { databaseManager } from '../src/config/database';

async function checkProducts() {
  try {
    await databaseManager.waitForInitialization();
    
    console.log('🔍 Checking current products in database...\n');
    
    const products = await productDatabase.getAllProducts();
    
    console.log(`Found ${products.length} products:\n`);
    
    products.forEach((product, index) => {
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Price: Rp ${product.price.toLocaleString('id-ID')}`);
      console.log(`   In Stock: ${product.inStock ? 'Yes' : 'No'}`);
      
      if (product.benefits && product.benefits.length > 0) {
        console.log(`   Benefits: ${product.benefits.slice(0, 3).join(', ')}`);
      }
      
      if (product.metadata && (product.metadata as any).healthConditions) {
        const conditions = (product.metadata as any).healthConditions;
        if (conditions.length > 0) {
          console.log(`   Health Conditions: ${conditions.join(', ')}`);
        }
      }
      
      console.log(`   Dosage: ${product.dosage}`);
      console.log('');
    });
    
    // Check health condition coverage
    const allConditions = new Set<string>();
    products.forEach(product => {
      if (product.metadata && (product.metadata as any).healthConditions) {
        (product.metadata as any).healthConditions.forEach((condition: string) => {
          allConditions.add(condition);
        });
      }
    });
    
    console.log('🏥 Health conditions covered:');
    Array.from(allConditions).forEach(condition => {
      console.log(`   - ${condition}`);
    });
    
    await databaseManager.close();
    
  } catch (error) {
    console.error('Error checking products:', error);
    process.exit(1);
  }
}

checkProducts();