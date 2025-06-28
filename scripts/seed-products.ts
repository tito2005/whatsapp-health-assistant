import { productService } from '@/products/product-service';
import { logger } from '@/shared/logger';
import { Product } from '@/types/product';

const healthProducts: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'HOTTO PURTO OAT',
    description: 'Minuman kesehatan tinggi serat yang kaya akan nutrisi dan rendah kalori. Diformulasikan dengan ubi ungu, oat premium Swedia, dan 15 jenis multigrain untuk mendukung kesehatan optimal.',
    price: 295000,
    discountPrice: 570000, // Bundle 2 pouch price
    category: 'general_wellness',
    benefits: [
      'Menurunkan kolesterol jahat (LDL) dengan beta-glucan oat Swedia',
      'Menstabilkan gula darah tinggi secara alami',
      'Mengatasi asam lambung (GERD & Maag) dengan efektif',
      'Melancarkan pencernaan dengan 15 multigrain premium',
      'Antioksidan tinggi dari ubi ungu (20x vitamin C)',
      'Memberikan rasa kenyang lebih lama (ideal untuk diet)',
      'Meningkatkan imunitas tubuh secara alami',
      'Membantu menurunkan resiko penyakit jantung, stroke, dan diabetes'
    ],
    ingredients: [
      'Ubi ungu premium',
      'Oat beta-glucan dari Swedia',
      '15 jenis multigrain berkualitas',
      'Serat alami tinggi',
      '12 vitamin lengkap',
      '9 mineral penting'
    ],
    suitableFor: [
      'Semua usia mulai 5 tahun ke atas',
      'Penderita diabetes dan pre-diabetes',
      'Penderita kolesterol tinggi',
      'Penderita GERD dan maag kronis',
      'Yang sedang program diet sehat',
      'Ibu hamil dan menyusui',
      'Pasien pasca stroke',
      'Penderita hipertensi'
    ],
    dosage: '1x sehari untuk maintenance kesehatan, 2-3x sehari untuk mengatasi masalah kesehatan spesifik',
    warnings: [
      'Minum air putih yang cukup setelah konsumsi (1-2 gelas)',
      'Konsultasi dokter jika memiliki kondisi medis serius'
    ],
    images: ['hotto-purto-oat-main.jpg', 'hotto-purto-ingredients.jpg'],
    inStock: true,
    metadata: {
      healthConditions: [
        'kolesterol tinggi', 'diabetes', 'gula darah tinggi', 'asam lambung',
        'GERD', 'maag', 'hipertensi', 'penyakit jantung', 'stroke', 'obesitas'
      ],
      symptoms: [
        'kolesterol naik', 'gula darah tidak stabil', 'perut perih', 'heartburn',
        'kembung', 'susah BAB', 'badan lemas', 'mudah lapar', 'berat badan naik'
      ],
      indonesianName: 'HOTTO PURTO OAT',
      culturalContext: 'Produk Indonesia dengan bahan premium internasional',
      bundleDiscount: 20000,
      calories: 120,
      fiber: '15g',
      protein: '5g'
    }
  },

  {
    name: 'HOTTO MAME PROTEIN',
    description: 'Protein tinggi dengan edamame dan isolat protein whey untuk mendukung gaya hidup aktif dan memenuhi kebutuhan protein harian dengan rasa yang lezat.',
    price: 180000,
    category: 'general_wellness',
    benefits: [
      'Tinggi protein berkualitas (9g per serving, 15% kebutuhan harian)',
      'Mengandung 3g serat untuk kesehatan pencernaan',
      'Diperkaya 9 vitamin dan 8 mineral penting',
      'Rendah kalori hanya 120 kkal per serving',
      'Mendukung gaya hidup aktif dan olahraga',
      'Membantu pembentukan dan pemeliharaan otot',
      'Meningkatkan metabolisme tubuh'
    ],
    ingredients: [
      'Edamame berkualitas tinggi',
      'Isolat protein whey premium',
      'Multigrain pilihan',
      'Oat beta-glucan',
      '9 vitamin lengkap',
      '8 mineral esensial'
    ],
    suitableFor: [
      'Penggemar gaya hidup aktif',
      'Fitness enthusiast dan atlet',
      'Yang membutuhkan asupan protein tinggi',
      'Pemulihan setelah olahraga',
      'Program diet protein',
      'Vegetarian yang butuh protein'
    ],
    dosage: '1-2 serving per hari, sebaiknya sebelum atau sesudah aktivitas fisik',
    images: ['hotto-mame-protein.jpg'],
    inStock: true,
    metadata: {
      healthConditions: [
        'kekurangan protein', 'lemah otot', 'recovery lambat', 'stamina kurang'
      ],
      symptoms: [
        'badan lemas', 'otot kendur', 'mudah capek', 'pemulihan lambat', 'stamina drop'
      ],
      protein: '9g',
      fiber: '3g',
      calories: 120
    }
  },

  {
    name: 'mGANIK METAFIBER',
    description: 'Pemblokir glukosa revolusioner untuk diabetes dengan formula SugarBlocker+ yang terbukti mencegah lonjakan gula darah setelah makan.',
    price: 350000,
    category: 'diabetes_support',
    benefits: [
      'Pemblokir glukosa efektif untuk penderita diabetes',
      'Mencegah lonjakan gula darah drastis setelah makan',
      'Formula SugarBlocker+ dengan psyllium husk premium',
      'Mengandung cannellini bean extract yang terbukti klinis',
      'Membantu mencapai remisi diabetes tipe 2',
      'Menurunkan HbA1c secara signifikan',
      'Menstabilkan metabolisme glukosa jangka panjang'
    ],
    ingredients: [
      'Psyllium husk premium grade',
      'Cannellini bean extract terstandar',
      'Chromium picolinate',
      'Alpha lipoic acid',
      'Bitter melon extract',
      'Gymnema sylvestre'
    ],
    suitableFor: [
      'Penderita diabetes tipe 2',
      'Pre-diabetes dan resistensi insulin',
      'Gula darah tinggi dan tidak stabil',
      'Metabolic syndrome',
      'Yang ingin mencegah diabetes'
    ],
    dosage: '1 sachet 30 menit sebelum makan utama, 2-3x sehari',
    warnings: [
      'Konsultasi dokter jika menggunakan obat diabetes',
      'Monitor gula darah secara rutin selama penggunaan',
      'Tidak direkomendasikan untuk diabetes tipe 1',
      'Hati-hati jika sedang terapi insulin'
    ],
    images: ['mganik-metafiber.jpg'],
    inStock: true,
    metadata: {
      healthConditions: [
        'diabetes tipe 2', 'pre-diabetes', 'gula darah tinggi', 'resistensi insulin',
        'metabolic syndrome', 'HbA1c tinggi'
      ],
      symptoms: [
        'gula darah naik', 'sering haus', 'sering kencing', 'mudah lapar',
        'berat badan turun tiba-tiba', 'luka sulit sembuh'
      ],
      targetHbA1c: '<7%',
      sugarBlocker: 'cannellini bean'
    }
  },

  {
    name: 'mGANIK SUPERFOOD',
    description: 'Formula GlukoStabil revolusioner untuk meningkatkan sensitivitas insulin dan mengoptimalkan kesehatan pankreas dengan superfood daun kelor.',
    price: 320000,
    category: 'diabetes_support',
    benefits: [
      'Meningkatkan sensitivitas insulin secara alami',
      'Mengoptimalkan kesehatan dan fungsi pankreas',
      'Formula GlukoStabil untuk stabilitas jangka panjang',
      'Bebas laktosa dan kolesterol',
      'Mengandung daun kelor superfood Indonesia',
      'Stabilisasi gula darah natural dan berkelanjutan',
      'Anti-inflamasi khusus untuk komplikasi diabetes'
    ],
    ingredients: [
      'Multigrain khusus untuk diabetes',
      'Labu kuning organik',
      'Daun kelor (moringa) premium',
      'Vitamin dan mineral diabetes-friendly',
      'Antioksidan alami tinggi',
      'Fiber larut berkualitas tinggi'
    ],
    suitableFor: [
      'Diabetes tipe 2 dan komplikasinya',
      'Pre-diabetes dan gangguan toleransi glukosa',
      'Gangguan metabolisme karbohidrat',
      'Pankreas lemah atau terganggu',
      'Insulin resistance syndrome'
    ],
    dosage: '1 serving 2x sehari, pagi sebelum sarapan dan malam sebelum tidur',
    images: ['mganik-superfood.jpg'],
    inStock: true,
    metadata: {
      healthConditions: [
        'diabetes', 'gangguan pankreas', 'resistensi insulin', 'metabolisme terganggu',
        'toleransi glukosa terganggu'
      ],
      symptoms: [
        'gula darah tidak stabil', 'pankreas lemah', 'mudah lelah',
        'metabolisme lambat', 'insulin tidak efektif'
      ],
      lactoseFree: true,
      cholesterolFree: true,
      moringa: true
    }
  },

  {
    name: 'mGANIK 3PEPTIDE',
    description: 'Formula Tensiprotect revolusioner dengan 3 jenis peptide anti-hipertensi untuk menurunkan tekanan darah tinggi dan melindungi kesehatan jantung.',
    price: 380000,
    category: 'cardiovascular',
    benefits: [
      'Anti-hipertensi dengan triple peptide formula',
      'Menurunkan tekanan darah tinggi secara efektif',
      'Melindungi kesehatan jantung dan pembuluh darah',
      'Formula Tensiprotect yang terbukti klinis',
      'Mengandung CoQ10 untuk energi jantung optimal',
      'Resveratrol antioksidan untuk perlindungan vaskular',
      'Mencegah komplikasi hipertensi jangka panjang'
    ],
    ingredients: [
      'Salmon ovary peptide',
      'Rice peptide terstandar',
      'Soy oligopeptide',
      'CoQ10 (Coenzyme Q10)',
      'Resveratrol premium',
      'Potassium untuk keseimbangan elektrolit',
      'Magnesium untuk relaksasi pembuluh darah'
    ],
    suitableFor: [
      'Penderita hipertensi grade 1-2',
      'Tekanan darah tinggi tidak terkontrol',
      'Risiko tinggi penyakit jantung',
      'Gangguan pembuluh darah',
      'Pre-hipertensi dan borderline'
    ],
    dosage: '1 sachet 2x sehari, pagi dan sore hari',
    warnings: [
      'Konsultasi dokter jika menggunakan obat hipertensi',
      'Monitor tekanan darah rutin selama penggunaan',
      'Hati-hati jika tekanan darah sudah terlalu rendah',
      'Tidak untuk hipotensi atau tekanan darah rendah'
    ],
    images: ['mganik-3peptide.jpg'],
    inStock: true,
    metadata: {
      healthConditions: [
        'hipertensi', 'darah tinggi', 'penyakit jantung', 'gangguan pembuluh darah',
        'pre-hipertensi', 'kardiovaskular'
      ],
      symptoms: [
        'tekanan darah tinggi', 'pusing', 'sakit kepala', 'jantung berdebar',
        'sesak napas', 'tengkuk pegal'
      ],
      targetBP: '<140/90 mmHg',
      peptideTypes: 3,
      coq10: true
    }
  },

  {
    name: 'SPENCERS MEALBLEND',
    description: 'Meal replacement premium dengan 14 varian rasa yang low calorie, low sugar, high protein dan high fiber. Lactose free, gluten free, vegan friendly.',
    price: 250000,
    category: 'weight_management',
    benefits: [
      '14 varian rasa lezat untuk variasi harian',
      'Ultra low calorie hanya 140kkal per serving',
      'Ultra low sugar kurang dari 1g per serving',
      'High protein 15g untuk kenyang lebih lama',
      'High fiber 9g untuk kesehatan pencernaan',
      'Lactose free untuk yang intoleran laktosa',
      'Gluten free untuk yang sensitif gluten',
      'Vegan friendly dari bahan nabati'
    ],
    ingredients: [
      'Plant protein blend premium',
      'Fiber kompleks larut dan tidak larut',
      'Vitamin dan mineral lengkap',
      'Natural flavoring 14 varian',
      'Prebiotik untuk kesehatan usus',
      'Digestive enzymes'
    ],
    suitableFor: [
      'Program diet dan weight management',
      'Meal replacement sehat',
      'Vegetarian dan vegan',
      'Lactose intolerant',
      'Gluten sensitive',
      'Busy lifestyle dan praktis'
    ],
    dosage: '1-2 serving sebagai pengganti makan utama, campur dengan 250ml air',
    images: ['spencers-mealblend.jpg'],
    inStock: true,
    metadata: {
      healthConditions: [
        'obesitas', 'berat badan berlebih', 'diet', 'metabolisme lambat',
        'intoleransi laktosa', 'sensitivitas gluten'
      ],
      symptoms: [
        'berat badan naik', 'susah turun berat badan', 'mudah lapar',
        'metabolisme lambat', 'kembung setelah makan'
      ],
      flavors: 14,
      calories: 140,
      protein: '15g',
      fiber: '9g',
      sugar: '<1g',
      lactoseFree: true,
      glutenFree: true,
      vegan: true
    }
  },

  {
    name: 'FLIMTY FIBER',
    description: 'Detox fiber premium dengan psyllium husk berkualitas tinggi yang efektif menyerap minyak, lemak, dan gula dari makanan. Memberikan efek kenyang hingga 30% lebih lama.',
    price: 200000,
    category: 'digestive_health',
    benefits: [
      'Menyerap minyak, lemak, dan gula dari makanan secara efektif',
      'Memberikan efek kenyang hingga 30% lebih lama',
      'Tinggi serat premium 5g per sachet',
      'Detox pencernaan menyeluruh dan alami',
      'Psyllium husk premium grade terbaik',
      'Kaya antioksidan dari superfruit blend',
      'Melancarkan BAB dan mengatasi sembelit',
      'Membantu menurunkan kolesterol secara alami'
    ],
    ingredients: [
      'Psyllium husk premium imported',
      'Goji berry antioksidan tinggi',
      'Bit merah untuk detox',
      'Pomegranate extract',
      'Ekstrak buah organik pilihan',
      'Ekstrak sayur organik',
      'Fiber larut dan tidak larut seimbang'
    ],
    suitableFor: [
      'Program detox pencernaan',
      'Penderita sembelit kronis',
      'Diet tinggi serat',
      'Penderita kolesterol tinggi',
      'Program kontrol berat badan',
      'Pencernaan bermasalah'
    ],
    dosage: '1 sachet sebelum makan utama, 1-2x sehari dengan banyak air',
    warnings: [
      'Minum air putih minimal 2 gelas setelah konsumsi',
      'Jangan dikonsumsi bersamaan dengan obat (beri jarak 2 jam)'
    ],
    images: ['flimty-fiber.jpg'],
    inStock: true,
    metadata: {
      healthConditions: [
        'sembelit', 'susah BAB', 'kolesterol tinggi', 'pencernaan bermasalah',
        'detox', 'obesitas'
      ],
      symptoms: [
        'susah BAB', 'perut kembung', 'pencernaan lambat', 'kolesterol naik',
        'berat badan naik', 'perut buncit'
      ],
      fiberContent: '5g',
      satietyBoost: '30%',
      psylliumHusk: true,
      organic: true
    }
  }
];

export async function seedProducts(): Promise<void> {
  try {
    logger.info('Starting comprehensive product seeding...');

    // Check if products already exist
    const existingProducts = await productService.getAllProducts();
    if (existingProducts.length > 0) {
      logger.info('Products already exist in database', { 
        count: existingProducts.length,
        action: 'skipping_seed'
      });
      
      // Show existing products
      existingProducts.forEach(product => {
        logger.info('Existing product found', {
          id: product.id,
          name: product.name,
          category: product.category,
          price: product.price,
          inStock: product.inStock
        });
      });
      
      return;
    }

    logger.info('Database is empty, proceeding with product seeding', {
      productsToSeed: healthProducts.length
    });

    // Seed all products with detailed logging
    let createdCount = 0;
    let failedCount = 0;
    const errors: Array<{ product: string; error: string }> = [];

    for (const [index, productData] of healthProducts.entries()) {
      try {
        logger.info(`Seeding product ${index + 1}/${healthProducts.length}`, {
          name: productData.name,
          category: productData.category,
          price: productData.price
        });

        const createdProduct = await productService.createProduct(productData);
        
        createdCount++;
        logger.info(`✅ Successfully created product`, {
          id: createdProduct.id,
          name: productData.name,
          category: productData.category,
          healthConditions: (productData.metadata as any)?.healthConditions?.length || 0,
          benefits: productData.benefits.length
        });

      } catch (error) {
        failedCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ product: productData.name, error: errorMessage });
        
        logger.error(`❌ Failed to create product: ${productData.name}`, {
          error: errorMessage,
          category: productData.category,
          price: productData.price
        });
      }
    }

    // Final summary
    logger.info('Product seeding completed', {
      total: healthProducts.length,
      created: createdCount,
      failed: failedCount,
      successRate: `${Math.round((createdCount / healthProducts.length) * 100)}%`
    });

    if (errors.length > 0) {
      logger.error('Product seeding errors summary', { errors });
    }

    // Verify final state
    const finalProducts = await productService.getAllProducts();
    const statistics = await productService.getProductStatistics();
    
    logger.info('Final database state after seeding', {
      totalProducts: finalProducts.length,
      statistics,
      categoriesSeeded: Object.keys(statistics.productsByCategory)
    });

    if (createdCount === 0) {
      throw new Error('No products were successfully created during seeding');
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Product seeding process failed', { 
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

// Utility function to validate product data before seeding
export async function validateProductData(): Promise<boolean> {
  try {
    logger.info('Validating product data structure...');

    const requiredFields = ['name', 'description', 'price', 'category', 'benefits', 'ingredients', 'suitableFor', 'dosage'];
    let valid = true;

    for (const [index, product] of healthProducts.entries()) {
      // Check required fields
      for (const field of requiredFields) {
        if (!product[field as keyof typeof product]) {
          logger.error(`Product ${index + 1} missing required field: ${field}`, {
            productName: product.name || 'Unknown'
          });
          valid = false;
        }
      }

      // Validate price
      if (product.price <= 0) {
        logger.error(`Product ${index + 1} has invalid price`, {
          productName: product.name,
          price: product.price
        });
        valid = false;
      }

      // Validate arrays
      if (!Array.isArray(product.benefits) || product.benefits.length === 0) {
        logger.error(`Product ${index + 1} has invalid benefits array`, {
          productName: product.name
        });
        valid = false;
      }

      if (!Array.isArray(product.ingredients) || product.ingredients.length === 0) {
        logger.error(`Product ${index + 1} has invalid ingredients array`, {
          productName: product.name
        });
        valid = false;
      }
    }

    if (valid) {
      logger.info('✅ All product data validation passed');
    } else {
      logger.error('❌ Product data validation failed');
    }

    return valid;

  } catch (error) {
    logger.error('Product data validation error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

// Function to display product summary
export async function displayProductSummary(): Promise<void> {
  try {
    const products = await productService.getAllProducts();
    const statistics = await productService.getProductStatistics();

    console.log('\n🏥 HEALTH PRODUCT DATABASE SUMMARY');
    console.log('=====================================');
    console.log(`📦 Total Products: ${statistics.totalProducts}`);
    console.log(`💰 Average Price: Rp ${Math.round(statistics.averagePrice).toLocaleString()}`);
    console.log(`✅ In Stock: ${statistics.inStockCount}`);
    console.log('\n📊 Products by Category:');
    
    Object.entries(statistics.productsByCategory).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} products`);
    });

    console.log('\n🔥 Featured Products:');
    products.slice(0, 3).forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.name} - Rp ${product.price.toLocaleString()}`);
      console.log(`      Category: ${product.category}`);
      console.log(`      Benefits: ${product.benefits.length} listed`);
    });

    console.log('\n✅ Database ready for health consultations!\n');

  } catch (error) {
    console.error('Failed to display product summary:', error);
  }
}

// Run if called directly
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'validate':
      validateProductData()
        .then(valid => {
          console.log(valid ? '✅ Validation passed' : '❌ Validation failed');
          process.exit(valid ? 0 : 1);
        })
        .catch(error => {
          console.error('❌ Validation error:', error);
          process.exit(1);
        });
      break;

    case 'summary':
      displayProductSummary()
        .then(() => process.exit(0))
        .catch(error => {
          console.error('❌ Summary error:', error);
          process.exit(1);
        });
      break;

    default:
      seedProducts()
        .then(() => {
          console.log('✅ Product seeding completed successfully');
          return displayProductSummary();
        })
        .then(() => process.exit(0))
        .catch((error) => {
          console.error('❌ Product seeding failed:', error);
          process.exit(1);
        });
      break;
  }
}