// Quick test to check products in database
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./data/chatbot.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
    return;
  }
  
  console.log('🔍 Checking products in database...\n');
  
  db.all("SELECT name, price, category FROM products", (err, rows) => {
    if (err) {
      console.error('Error querying products:', err);
      return;
    }
    
    console.log(`📦 Found ${rows.length} products:\n`);
    
    rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name}`);
      console.log(`   Price: Rp ${row.price.toLocaleString('id-ID')}`);
      console.log(`   Category: ${row.category}\n`);
    });
    
    // Check specifically for HOTTO products
    const hottoProducts = rows.filter(p => p.name.includes('HOTTO'));
    console.log(`🔥 HOTTO Products found: ${hottoProducts.length}`);
    hottoProducts.forEach(p => {
      console.log(`   - ${p.name}: Rp ${p.price.toLocaleString('id-ID')}`);
    });
    
    db.close();
  });
});