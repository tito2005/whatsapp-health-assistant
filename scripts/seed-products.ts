import { productService } from '@/products/product-service';
import { logger } from '@/shared/logger';
import { Product } from '@/types/product';

const healthProducts: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Hotto Purto',
    description: 'Minuman superfood multigrain berbahan dasar ubi ungu yang praktis dan bernutrisi tinggi untuk program diet dan weight loss. Terbuat dari 15 jenis biji-bijian premium, ubi ungu, dan oat Swedia yang memberikan rasa kenyang lebih lama. SANGAT EFEKTIF untuk mengatasi asam lambung (GERD dan maag) sekaligus mendukung penurunan berat badan secara alami. Tersedia dalam kemasan pouch (16 sachets) dan pilihan sachets satuan.',
    price: 295000, // 1 pouch (16 sachets)
    discountPrice: 570000, // Bundle 2 pouch price
    category: 'weight_management',
    benefits: [
      'SANGAT EFEKTIF mengatasi asam lambung, GERD, dan maag kronis',
      'Memberikan rasa kenyang lebih lama untuk program diet dan weight loss',
      'Menurunkan berat badan secara alami dengan 15 multigrain premium',
      'Praktis sebagai pengganti sarapan dan cemilan sehat rendah kalori',
      'Mengontrol nafsu makan berlebihan dan mengurangi ngemil',
      'Menenangkan lambung dan mengurangi produksi asam berlebih',
      'Membantu membakar lemak dengan metabolisme yang lebih baik',
      'Menurunkan kolesterol jahat (LDL) secara natural',
      'Menstabilkan gula darah untuk diabetes dan pre-diabetes',
      'Meningkatkan energi tanpa membuat gemuk',
      'Cocok untuk semua usia dan kondisi lambung sensitif',
      'Bahan alami tanpa pengawet, aman untuk konsumsi jangka panjang',
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
      'Penderita gangguan pencernaan',
    ],
    dosage: 'Konsumsi 1x sehari untuk menjaga kesehatan sehari-hari pada pagi hari sebagai sarapan sehat.Konsumsi  2-3x sehari untuk membantu menurunkan kolesterol, gula darah ataupun mengatasi asam lambung dan penyakit lainnya -1 x pada pagi hari sebagai sarapan sehat -1 x pada sore atau malam hari sebagai cemilan sehat',
    warnings: [
      'Minum air putih yang cukup setelah konsumsi (1-2 gelas)',
      'Konsultasi dokter jika memiliki kondisi medis serius'
    ],
    images: ['hotto-purto-oat-main.jpg', 'hotto-purto-ingredients.jpg'],
    inStock: true,
    metadata: {
      healthConditions: [
        'obesitas', 'berat badan berlebih', 'diet', 'weight loss',
        'GERD', 'maag', 'asam lambung', 'heartburn', 'gastritis',
        'kolesterol tinggi', 'diabetes', 'gula darah tinggi', 'hipertensi'
      ],
      symptoms: [
        'berat badan naik', 'susah turun berat badan', 'perut buncit', 'mudah lapar',
        'perut perih', 'asam lambung naik', 'heartburn', 'mual setelah makan', 'kembung',
        'kolesterol naik', 'gula darah tidak stabil', 'badan lemas', 'susah BAB'
      ],
      indonesianName: 'HOTTO PURTO OAT',
      culturalContext: 'Produk Indonesia dengan bahan premium internasional',
      bundleDiscount: 20000,
      calories: 130,
      fiber: '12g',
      protein: '2g',
      pricingOptions: {
        pouch: {
          '1 pouch (16 sachets)': 295000,
          '2 pouch (32 sachets)': 570000
        },
        sachets: {
          '3 sachets': 75000,
          '5 sachets': 113000,
          '7 sachets': 161000,
          '9 sachets': 198000
        },
        freeShippingBatam: ['1 pouch', '2 pouch', '7 sachets', '9 sachets'],
        shippingNote: 'Gratis ongkir khusus kota Batam untuk pembelian 1 pouch, 2 pouch, 7 sachets, 9 sachets'
      },
      productSpecs: {
        flavor: 'Natural oat dengan ubi ungu (tanpa rasa buatan)',
        texture: 'Bubuk halus, mudah larut dalam air',
        color: 'Ungu alami dari ubi ungu',
        sweetness: 'Rasa manis alami tanpa gula tambahan',
        packaging: 'Sachet individual kedap udara',
        shelfLife: '24 bulan dari tanggal produksi',
        storage: 'Simpan di tempat kering dan sejuk'
      },
      clinicalInfo: {
        betaGlucanContent: '3g per serving',
        fiberContent: '12g per serving',
        antioxidantLevel: '20x vitamin C',
        proven: 'Terbukti membantu maag dan GERD menjadi lebih baik, menurunkan kolesterol LDL, dan menstabilkan gula darah, dan jumlah produksi asi meningkat pada ibu nyusui',
      },
      detailedComposition: {
        perServing: {
          calories: 130,
          protein: '2g (3% daily value)',
          carbohydrates: '24g (7% daily value)',
          dietaryFiber: '12g (60% daily value)',
          sugars: '7g (no added sugar)',
          fat: '3g (5% daily value)',
          saturatedFat: '1.5g (8% daily value)',
          sodium: '15mg (2% daily value)',
          potassium: '280mg (8% daily value)'
        },
        vitamins: {
          vitaminA: '15% daily value',
          vitaminC: '25% daily value',
          vitaminD: '10% daily value',
          vitaminE: '20% daily value',
          vitaminB1: '12% daily value',
          vitaminB2: '15% daily value',
          vitaminB6: '18% daily value',
          vitaminB12: '20% daily value',
          folate: '10% daily value',
          niacin: '12% daily value',
          pantothenic: '8% daily value',
          biotin: '15% daily value'
        },
        minerals: {
          calcium: '15% daily value',
          magnesium: '10% daily value',
          phosphorus: '15% daily value',
          zinc: '15% daily value',
        },
        activeCompounds: {
          betaGlucan: '3g (soluble fiber)',
          anthocyanins: '150mg (from purple sweet potato)',
          antioxidants: 'ORAC value 2500 μmol TE/serving',
          prebiotics: '2g (inulin and oligofructose)',
          phytosterols: '50mg (cholesterol-blocking compounds)'
        }
      },
      usageGuidance: {
        basicUsage: {
          maintenance: {
            frequency: '1x daily',
            timing: 'Morning or evening',
            duration: 'Long-term daily use',
            expectedResults: 'General health maintenance, energy boost'
          },
          therapeutic: {
            frequency: '2-3x daily',
            timing: '30 minutes before meals',
            duration: '8-12 weeks minimum',
            expectedResults: 'Cholesterol reduction, blood sugar stabilization'
          }
        },
        specificConditions: {
          diabetes: {
            dosage: '2x daily before main meals',
            timing: '30 minutes before breakfast and dinner',
            instructions: 'Mix with 200ml lukewarm water, stir well',
            expectedResults: 'Blood sugar stabilization within 2-4 weeks',
            monitoring: 'Check blood glucose levels weekly',
            notes: 'Consult doctor for medication adjustment'
          },
          cholesterol: {
            dosage: '2x daily',
            timing: 'Morning and evening with meals',
            instructions: 'Consistent daily use is key',
            expectedResults: '15-30% LDL reduction in 8 weeks',
            monitoring: 'Lipid profile test after 8 weeks',
            notes: 'Combine with low-fat diet for best results'
          },
          gerd: {
            dosage: '1x daily',
            timing: '2 hours after dinner',
            instructions: 'Mix with cool water, drink slowly',
            expectedResults: 'Symptom relief within 1-2 weeks',
            monitoring: 'Track heartburn episodes',
            notes: 'Avoid spicy foods during treatment'
          },
          weightLoss: {
            dosage: '1-2x daily',
            timing: '30 minutes before main meals or as snack',
            instructions: 'Drink 2 glasses water after consumption',
            expectedResults: 'Appetite control, gradual weight loss',
            monitoring: 'Weekly weight and measurements',
            notes: 'Combine with regular exercise'
          }
        },
        preparation: {
          waterTemperature: 'Room temperature to lukewarm (not hot)',
          mixingInstructions: 'Stir vigorously for 30 seconds until fully dissolved',
          additionalTips: 'Can add ice for refreshing taste, avoid mixing with milk',
          storage: 'Use within 30 minutes of preparation'
        },
        dietaryConsiderations: {
          interactions: 'Take half an hour apart from medications',
          allergies: 'Contains oats (gluten-free oats used)',
          restrictions: 'Suitable for diabetics, vegetarians, lactose intolerant',
          pregnancy: 'Safe during pregnancy and breastfeeding'
        }
      },
      canMix: true, // Can mix with Hotto Mame
      mixingOptions: {
        canMixWith: ['Hotto Mame'],
        mixingRatio: {
          'Hotto Purto + Hotto Mame': '8 sachets Hotto Purto + 6 sachets Hotto Mame = 1 pouch'
        }
      }
    }
  },

  {
    name: 'Hotto Mame',
    description: 'Protein tinggi dengan edamame dan isolat protein whey untuk program diet dan weight loss yang efektif. Membantu membakar lemak sambil mempertahankan massa otot dengan protein berkualitas tinggi. SANGAT EFEKTIF untuk mengatasi asam lambung (GERD dan maag) berkat kandungan protein yang menenangkan lambung. Tersedia dalam kemasan pouch (12 sachets) dan pilihan sachets satuan.',
    price: 295000, // 1 pouch (12 sachets) - same price as HOTTO PURTO
    discountPrice: 570000, // Bundle 2 pouch price
    category: 'weight_management',
    benefits: [
      'SANGAT EFEKTIF mengatasi asam lambung, GERD, dan maag dengan protein menenangkan',
      'Tinggi protein berkualitas (9g per serving) untuk weight loss dan diet',
      'Membakar lemak sambil mempertahankan massa otot',
      'Rendah kalori hanya 120 kkal per serving - ideal untuk diet',
      'Memberikan rasa kenyang lebih lama, mengurangi ngemil',
      'Meningkatkan metabolisme untuk pembakaran lemak optimal',
      'Membantu recovery otot setelah olahraga tanpa menambah lemak',
      'Mengandung 3g serat untuk kesehatan pencernaan dan detox',
      'Diperkaya 9 vitamin dan 8 mineral untuk nutrisi lengkap',
      'Cocok untuk program fitness dan gym',
      'Aman untuk lambung sensitif dan penderita GERD',
      'Praktis dikonsumsi kapan saja sebagai meal replacement'
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
      'Program diet dan weight loss (primary function)',
      'Penderita GERD, maag, dan asam lambung (very effective)',
      'Fitness enthusiast dan program gym',
      'Yang ingin turun berat badan sambil jaga massa otot',
      'Meal replacement untuk diet tinggi protein',
      'Pemulihan setelah olahraga tanpa menambah lemak',
      'Yang butuh protein tinggi tapi rendah kalori',
      'Vegetarian yang butuh protein lengkap',
      'Lambung sensitif yang butuh nutrisi tinggi'
    ],
    dosage: '1-2 serving per hari, sebaiknya sebelum atau sesudah aktivitas fisik. 12 sachet per pouch untuk pemakaian 12 hari (1x sehari) atau 6 hari (2x sehari)',
    images: ['hotto-mame-protein.jpg'],
    inStock: true,
    metadata: {
      healthConditions: [
        'obesitas', 'berat badan berlebih', 'diet', 'weight loss',
        'GERD', 'maag', 'asam lambung', 'heartburn',
        'kekurangan protein', 'lemah otot', 'recovery lambat'
      ],
      symptoms: [
        'berat badan naik', 'susah turun berat badan', 'perut buncit',
        'perut perih', 'asam lambung naik', 'heartburn', 'mual setelah makan',
        'badan lemas', 'otot kendur', 'mudah capek', 'stamina drop'
      ],
      protein: '9g',
      fiber: '3g',
      calories: 120,
      pricingOptions: {
        pouch: {
          '1 pouch (12 sachets)': 295000,
          '2 pouch (24 sachets)': 570000
        },
        sachets: {
          '3 sachets': 90000,
          '5 sachets': 150000,
          '7 sachets': 210000,
          '9 sachets': 270000
        },
        freeShippingBatam: ['1 pouch', '2 pouch', '7 sachets', '9 sachets'],
        shippingNote: 'Gratis ongkir khusus kota Batam untuk pembelian 1 pouch, 2 pouch, 7 sachets, 9 sachets'
      },
      canMix: true, // Can mix with Hotto Purto
      mixingOptions: {
        canMixWith: ['Hotto Purto'],
        mixingRatio: {
          'Hotto Purto + Hotto Mame': '8 sachets Hotto Purto + 6 sachets Hotto Mame = 1 pouch'
        }
      }
    }
  },

  {
    name: 'mGanik Metafiber Tub 450g (30 servings)',
    description: 'Pemblokir glukosa revolusioner untuk diabetes dengan formula SugarBlocker+ yang terbukti mencegah lonjakan gula darah setelah makan. Diformulasikan khusus dengan psyllium husk premium dan cannellini bean extract yang terbukti klinis efektif memblokir penyerapan glukosa hingga 40%. Tersedia dalam tub 450g (30 servings) dengan 3 varian rasa: Jeruk Yuzu, Cocopandan, dan Leci.',
    price: 299000,
    discountPrice: 580000, // Bundle 2 tub price
    category: 'diabetes_support',
    benefits: [
      'Memblokir penyerapan glukosa hingga 40% setelah makan',
      'Mencegah lonjakan gula darah drastis (glucose spike)',
      'Formula SugarBlocker+ dengan psyllium husk premium grade',
      'Mengandung cannellini bean extract yang terbukti klinis FDA approved',
      'Membantu mencapai remisi diabetes tipe 2 dalam 12 minggu',
      'Menurunkan HbA1c rata-rata 1.2-2.1% dalam 3 bulan',
      'Menstabilkan metabolisme glukosa jangka panjang',
      'Mengurangi ketergantungan pada obat diabetes (konsultasi dokter)',
      'Meningkatkan sensitivitas insulin secara natural',
      'Mencegah komplikasi diabetes seperti neuropati dan retinopati',
      'Tinggi serat 12g per serving untuk kesehatan pencernaan',
      'Bebas gula tambahan dan aman untuk penderita diabetes'
    ],
    ingredients: [
      'Psyllium husk premium grade (Plantago ovata)',
      'Cannellini bean extract terstandar (Phaseolus vulgaris)',
      'Chromium picolinate 200mcg',
      'Alpha lipoic acid 150mg',
      'Bitter melon extract (Momordica charantia)',
      'Gymnema sylvestre 400mg',
      'Inulin prebiotic fiber',
      'Natural fruit flavoring',
      'Stevia leaf extract (natural sweetener)'
    ],
    suitableFor: [
      'Penderita diabetes tipe 2 (semua stage)',
      'Pre-diabetes dan resistensi insulin',
      'Gula darah tinggi dan tidak stabil (>126 mg/dL)',
      'Metabolic syndrome dan obesitas',
      'Yang ingin mencegah diabetes (riwayat keluarga)',
      'Kekurangan asupan serat harian (<25g/hari)',
      'HbA1c tinggi (>6.5%)',
      'Pasca operasi bariatric (konsultasi dokter)',
      'Penderita PCOS dengan resistensi insulin'
    ],
    dosage: 'Maintenance: 1 sachet sebelum makan besar (2x sehari). Terapi intensif: 1 sachet sebelum setiap makan (3x sehari). Konsumsi 30 menit sebelum makan dengan 250ml air. 1 tub untuk pemakaian 15 hari (2x sehari) atau 10 hari (3x sehari)',
    warnings: [
      'Wajib konsultasi dokter jika menggunakan obat diabetes',
      'Monitor gula darah secara rutin selama penggunaan',
      'Tidak direkomendasikan untuk diabetes tipe 1',
      'Hati-hati jika sedang terapi insulin (risiko hipoglikemia)',
      'Minum air putih minimal 2 gelas setelah konsumsi',
      'Beri jarak 2 jam dengan obat lain (dapat mengurangi absorpsi)',
      'Hentikan jika terjadi reaksi alergi atau gangguan pencernaan'
    ],
    images: ['mganik-metafiber.jpg', 'mganik-metafiber-ingredients.jpg', 'mganik-metafiber-variants.jpg'],
    inStock: true,
    metadata: {
      healthConditions: [
        'diabetes tipe 2', 'diabates', 'diabetes mellitus', 'kencing manis', 'gula darah tinggi',
        'pre-diabetes', 'resistensi insulin', 'insulin resistance', 'metabolic syndrome',
        'HbA1c tinggi', 'glucose intolerance', 'toleransi glukosa terganggu',
        'neuropati diabetik', 'retinopati diabetik', 'obesitas diabetes'
      ],
      symptoms: [
        'gula darah naik', 'gula darah tinggi', 'gula darah tidak stabil', 'glucose spike',
        'sering haus', 'haus terus', 'banyak minum', 'polidipsia',
        'sering kencing', 'sering buang air kecil', 'kencing terus', 'poliuria',
        'mudah lapar', 'lapar terus', 'pengen makan terus', 'polifagia',
        'berat badan turun tiba-tiba', 'berat badan drop', 'kurus mendadak',
        'luka sulit sembuh', 'luka lama sembuh', 'healing lambat',
        'kebas kaki', 'kesemutan', 'kaki mati rasa', 'neuropati',
        'mata kabur', 'penglihatan buram', 'retinopati',
        'mudah lelah', 'lemes', 'badan drop', 'fatigue diabetes'
      ],
      indonesianName: 'mGANIK METAFIBER PEMBLOKIR GULA',
      culturalContext: 'Formula Indonesia dengan teknologi internasional untuk diabetes',
      bundleDiscount: 18000,
      fiberContent: '12g',
      sugarBlocker: 'cannellini bean',
      targetHbA1c: '<7%',
      glucoseReduction: '40%',
      freeShippingBatam: true,
      shippingNote: 'Gratis ongkir khusus kota Batam',
      businessIntelligence: {
        costPerServing: 9967, // 299000/30
        targetDemographic: 'Penderita diabetes 35-65 tahun',
        competitorAdvantage: 'Satu-satunya dengan cannellini bean extract di Indonesia',
        marketPosition: 'Premium diabetes supplement',
        seasonalDemand: 'Tinggi saat Ramadan dan Lebaran (gula darah naik)',
        customerRetention: '85% repeat purchase rate'
      },
      pricingStrategy: {
        tub: {
          '1 tub (30 servings)': 299000,
          '2 tub (60 servings)': 580000
        },
        costAnalysis: {
          pricePerServing: 9967,
          costPerMonth: 598000, // 2 tub untuk 30 hari 3x sehari
          competitorComparison: '30% lebih murah dari imported brands'
        }
      },
      productSpecs: {
        flavor: '3 varian: Jeruk Yuzu segar, Cocopandan tradisional, Leci manis',
        texture: 'Bubuk fiber halus, mudah larut tanpa gritty',
        sweetness: 'Manis natural dari stevia, bebas gula',
        packaging: 'Tub kedap udara 450g dengan sendok takar',
        shelfLife: '24 bulan dari tanggal produksi',
        storage: 'Simpan di tempat kering, tertutup rapat setelah dibuka'
      },
      clinicalInfo: {
        psylliumContent: '4g per serving (soluble fiber)',
        cannelliniExtract: '2g per serving (glucose blocker)',
        chromiumContent: '200mcg (daily requirement 166%)',
        alphaLipoicAcid: '150mg (antioxidant for diabetes)',
        proven: 'Uji klinis menunjukkan penurunan HbA1c 1.2-2.1% dalam 12 minggu, glucose blocking 40% post-meal'
      },
      detailedComposition: {
        perServing: {
          calories: 60,
          protein: '1g (2% daily value)',
          carbohydrates: '11g (4% daily value)',
          dietaryFiber: '12g (48% daily value)',
          sugars: '0g (no added sugar)',
          fat: '0.5g (1% daily value)',
          sodium: '5mg (0% daily value)',
          chromium: '200mcg (166% daily value)'
        },
        activeIngredients: {
          psylliumHusk: '4g (premium grade soluble fiber)',
          cannelliniExtract: '2g (glucose absorption inhibitor)',
          chromiumPicolinate: '200mcg (insulin sensitivity enhancer)',
          alphaLipoicAcid: '150mg (glucose metabolism support)',
          gymnemaSylvestre: '400mg (sugar craving reducer)',
          bitterMelonExtract: '300mg (natural blood sugar regulator)'
        },
        functionalCompounds: {
          solubleFiber: '4g (glucose binding)',
          prebiotics: '1g (gut health)',
          antioxidants: 'Alpha lipoic acid + bitter melon',
          glucoseBlockers: 'Cannellini bean phaseolamin'
        }
      },
      usageGuidance: {
        basicUsage: {
          maintenance: {
            frequency: '2x daily',
            timing: '30 minutes before main meals',
            duration: 'Long-term daily use',
            expectedResults: 'Stable blood sugar, HbA1c maintenance'
          },
          therapeutic: {
            frequency: '3x daily',
            timing: '30 minutes before all meals',
            duration: '12 weeks minimum for HbA1c improvement',
            expectedResults: 'HbA1c reduction 1.2-2.1%, glucose stabilization'
          }
        },
        specificConditions: {
          diabetes: {
            dosage: '3x daily before meals',
            timing: '30 minutes before breakfast, lunch, dinner',
            instructions: 'Mix with 250ml water, drink immediately',
            expectedResults: 'Glucose spike reduction 40%, HbA1c improvement in 8-12 weeks',
            monitoring: 'Check blood glucose 2 hours post-meal, HbA1c every 3 months',
            notes: 'Coordinate with doctor for medication adjustment'
          },
          prediabetes: {
            dosage: '2x daily before main meals',
            timing: 'Before breakfast and dinner',
            instructions: 'Consistent timing daily for best results',
            expectedResults: 'Prevention of progression to diabetes, glucose normalization',
            monitoring: 'Oral glucose tolerance test every 6 months',
            notes: 'Combine with diet and exercise for optimal results'
          },
          weightLoss: {
            dosage: '2x daily',
            timing: '30 minutes before largest meals',
            instructions: 'Drink extra water for satiety effect',
            expectedResults: 'Reduced appetite, gradual weight loss',
            monitoring: 'Weekly weight and waist measurements',
            notes: 'High fiber content provides natural appetite control'
          }
        },
        preparation: {
          waterTemperature: 'Room temperature to cool water',
          mixingInstructions: 'Mix thoroughly with spoon, let sit 1 minute, stir again',
          additionalTips: 'Can be mixed with sugar-free beverages, avoid hot liquids',
          storage: 'Consume within 15 minutes of preparation'
        },
        dietaryConsiderations: {
          interactions: 'Take 2 hours apart from diabetes medications and other supplements',
          allergies: 'Contains psyllium (rare allergic reactions possible)',
          restrictions: 'Safe for diabetics, not suitable for bowel obstruction',
          pregnancy: 'Consult doctor before use during pregnancy'
        }
      },
      variant: ['Jeruk Yuzu', 'Cocopandan', 'Leci'],
      canMix: false // Cannot mix - tub format
    }
  },

  {
    name: 'mGanik Superfood 50g (20 servings)',
    description: 'Formula GlukoStabil revolusioner untuk meningkatkan sensitivitas insulin dan mengoptimalkan kesehatan pankreas dengan superfood daun kelor premium. Diformulasikan khusus dengan kombinasi multigrain diabetes-friendly, labu kuning organik, dan daun kelor (moringa oleifera) yang kaya akan 92 nutrisi alami. Formula bebas laktosa dan kolesterol untuk stabilisasi gula darah jangka panjang. Tersedia dalam box 20 sachets dengan 2 varian rasa: Kurma dan Labu.',
    price: 289000,
    discountPrice: 560000, // Bundle 2 box price
    category: 'diabetes_support',
    benefits: [
      'Meningkatkan sensitivitas insulin hingga 65% secara alami',
      'Mengoptimalkan kesehatan dan fungsi pankreas (sel beta)',
      'Formula GlukoStabil untuk stabilitas gula darah jangka panjang',
      'Bebas laktosa dan kolesterol (aman untuk intoleransi)',
      'Mengandung daun kelor superfood Indonesia (92 nutrisi)',
      'Stabilisasi gula darah natural tanpa efek samping',
      'Anti-inflamasi khusus untuk komplikasi diabetes',
      'Memperbaiki metabolisme karbohidrat dan lemak',
      'Mengurangi resistensi insulin dalam 8 minggu',
      'Melindungi pankreas dari kerusakan oksidatif',
      'Tinggi antioksidan untuk mencegah komplikasi diabetes',
      'Membantu regenerasi sel beta pankreas'
    ],
    ingredients: [
      'Multigrain khusus diabetes (quinoa, millet, amaranth)',
      'Labu kuning organik (Cucurbita moschata)',
      'Daun kelor premium (Moringa oleifera)',
      'Gymnema sylvestre extract',
      'Cinnamon bark extract (kayu manis)',
      'Bitter melon powder (pare)',
      'Fenugreek seed extract',
      'Chromium chelate',
      'Zinc picolinate',
      'Magnesium glycinate',
      'Vitamin D3',
      'B-complex vitamins'
    ],
    suitableFor: [
      'Diabetes tipe 2 dan komplikasinya (neuropati, retinopati)',
      'Pre-diabetes dan gangguan toleransi glukosa',
      'Gangguan metabolisme karbohidrat dan lemak',
      'Pankreas lemah atau terganggu (pankreatitis ringan)',
      'Insulin resistance syndrome dan PCOS',
      'Metabolic syndrome dengan obesitas',
      'Intoleransi laktosa dan sensitivitas kolesterol',
      'Diabetes gestasional (konsultasi dokter)',
      'Pascaoperasi pankreas (konsultasi dokter)'
    ],
    dosage: 'Maintenance: 1 sachet pagi sebelum sarapan. Terapi intensif: 2 sachet sehari (pagi sebelum sarapan dan malam sebelum tidur). Campur dengan 200ml air hangat, aduk hingga larut. 1 box untuk pemakaian 20 hari (1x sehari) atau 10 hari (2x sehari)',
    warnings: [
      'Konsultasi dokter jika menggunakan obat diabetes',
      'Monitor gula darah rutin selama penggunaan',
      'Tidak untuk diabetes tipe 1 tanpa pengawasan medis',
      'Hati-hati jika sedang terapi insulin (risiko hipoglikemia)',
      'Hentikan jika terjadi gangguan pencernaan berkepanjangan'
    ],
    images: ['mganik-superfood.jpg', 'mganik-superfood-moringa.jpg', 'mganik-superfood-variants.jpg'],
    inStock: true,
    metadata: {
      healthConditions: [
        'diabetes tipe 2', 'diabates', 'diabetes mellitus', 'kencing manis',
        'gangguan pankreas', 'pankreas lemah', 'pankreatitis ringan',
        'resistensi insulin', 'insulin resistance', 'metabolisme terganggu',
        'toleransi glukosa terganggu', 'glucose intolerance', 'pre-diabetes',
        'metabolic syndrome', 'PCOS diabetes', 'diabetes gestasional'
      ],
      symptoms: [
        'gula darah tidak stabil', 'gula darah naik turun', 'glucose fluktuasi',
        'pankreas lemah', 'pankreas sakit', 'nyeri pankreas',
        'mudah lelah', 'lemes', 'badan drop', 'fatigue kronis',
        'metabolisme lambat', 'metabolisme terganggu', 'susah turun berat',
        'insulin tidak efektif', 'resistensi insulin', 'insulin tinggi',
        'sering haus', 'haus terus', 'mulut kering',
        'sering lapar', 'lapar terus', 'ngidam manis',
        'berat badan naik', 'perut buncit', 'obesitas sentral'
      ],
      indonesianName: 'mGANIK SUPERFOOD KELOR DIABETES',
      culturalContext: 'Superfood tradisional Indonesia dengan teknologi modern',
      lactoseFree: true,
      cholesterolFree: true,
      moringa: true,
      freeShippingBatam: true,
      shippingNote: 'Gratis ongkir khusus kota Batam',
      bundleDiscount: 18000,
      businessIntelligence: {
        costPerServing: 14450, // 289000/20
        targetDemographic: 'Penderita diabetes 30-60 tahun yang concern natural',
        competitorAdvantage: 'Satu-satunya dengan moringa premium di kategori diabetes',
        marketPosition: 'Premium natural diabetes supplement',
        seasonalDemand: 'Stabil sepanjang tahun, peak saat New Year resolution',
        customerRetention: '82% repeat purchase rate'
      },
      pricingStrategy: {
        box: {
          '1 box (20 servings)': 289000,
          '2 box (40 servings)': 560000
        },
        costAnalysis: {
          pricePerServing: 14450,
          costPerMonth: 867000, // 3 box untuk 30 hari 2x sehari
          competitorComparison: '25% lebih murah dari organic imported'
        }
      },
      productSpecs: {
        flavor: '2 varian: Kurma, Labu',
        texture: 'Bubuk halus superfood, mudah larut, tidak menggumpal',
        color: 'Hijau natural dari moringa (Kurma), orange natural (Labu)',
        sweetness: 'Manis alami dari kurma dan labu, tanpa gula tambahan',
        packaging: 'Box eco-friendly dengan sachet individual',
        shelfLife: '24 bulan dari tanggal produksi',
        storage: 'Simpan di tempat sejuk dan kering, hindari sinar matahari'
      },
      clinicalInfo: {
        moringaContent: '5g per serving (92 nutrisi alami)',
        gymnemaSylvestre: '300mg per serving (insulin sensitizer)',
        cinnamonExtract: '250mg per serving (glucose regulator)',
        chromiumContent: '150mcg per serving (glucose metabolism)',
        proven: 'Studi klinis menunjukkan peningkatan sensitivitas insulin 65% dalam 8 minggu, stabilisasi gula darah post-meal'
      },
      detailedComposition: {
        perServing: {
          calories: 100,
          protein: '4g (8% daily value)',
          carbohydrates: '16g (5% daily value)',
          dietaryFiber: '2g (5% daily value)',
          sugars: '1g (natural from dates and pumpkin)',
          fat: '2.5g (4% daily value)',
          sodium: '55mg (4% daily value)',
          potassium: '320mg (9% daily value)',
          calcium: '75mg 8% daily value)',
          iron: '3mg (17% daily value)',
          magnesium: '20mg (6% daily value)',
        },
        superfoods: {
          moringa: '5g (92 nutrients including 18 amino acids)',
          pumpkin: '3g (beta-carotene and potassium)',
          multigrain: '2g (complex carbohydrates)',
          dates: '1g (natural sweetener and fiber)'
        },
        activeIngredients: {
          gymnemaSylvestre: '300mg (insulin sensitivity)',
          cinnamonExtract: '250mg (glucose regulation)',
          bitterMelonPowder: '200mg (natural insulin-like compounds)',
          fenugreekExtract: '150mg (glucose metabolism)',
          chromiumChelate: '150mcg (carbohydrate metabolism)',
          zincPicolinate: '8mg (pancreatic function)',
          magnesiumGlycinate: '85mg (insulin function)'
        },
        vitaminsAndMinerals: {
          vitaminA: '800mcg (89% daily value)',
          vitaminD3: '10mcg (50% daily value)',
          vitaminE: '12mg (80% daily value)',
          vitaminB1: '1.7mg (100% daily value)',
          vitaminB3: '1.7mg (100% daily value)',
          vitaminB6: '1.7mg (100% daily value)',
          vitaminB9: '1.7mg (100% daily value)',
          vitaminB12: '2.5mcg (100% daily value)'
        }
      },
      usageGuidance: {
        basicUsage: {
          maintenance: {
            frequency: '1x daily',
            timing: 'Morning breakfast',
            duration: 'Long-term daily use',
            expectedResults: 'Stable glucose levels, improved insulin sensitivity'
          },
          therapeutic: {
            frequency: '2x daily',
            timing: 'Morning breakfast and evening after dinner',
            duration: '12 weeks minimum for maximum benefit',
            expectedResults: 'Insulin sensitivity improvement 65%, glucose stabilization'
          }
        },
        specificConditions: {
          diabetes: {
            dosage: '2x daily',
            timing: 'Morning breakfast, evening after dinner',
            instructions: 'Mix with 200ml warm water, stir well, drink immediately',
            expectedResults: 'Improved insulin sensitivity, reduced glucose spikes',
            monitoring: 'Blood glucose monitoring 2x daily, HbA1c every 3 months',
            notes: 'Coordinate with endocrinologist for optimal results'
          },
          prediabetes: {
            dosage: '1x daily',
            timing: 'Morning breakfast',
            instructions: 'Consistent daily use for prevention',
            expectedResults: 'Prevention of diabetes progression, glucose normalization',
            monitoring: 'Glucose tolerance test every 6 months',
            notes: 'Combine with lifestyle modifications'
          },
          pancreaticHealth: {
            dosage: '1x daily',
            timing: 'Morning on empty stomach',
            instructions: 'Take with plenty of water for optimal absorption',
            expectedResults: 'Improved pancreatic function, reduced inflammation',
            monitoring: 'Pancreatic enzymes test quarterly',
            notes: 'Avoid alcohol and high-fat foods during treatment'
          }
        },
        preparation: {
          waterTemperature: 'Warm water (not hot) to preserve nutrients',
          mixingInstructions: 'Mix thoroughly, let stand 2 minutes, stir again',
          additionalTips: 'Can be mixed with plant milk, avoid dairy products',
          storage: 'Consume within 30 minutes of preparation'
        },
        dietaryConsiderations: {
          interactions: 'Take 1 hour apart from diabetes medications',
          allergies: 'Generally well-tolerated, rare moringa allergies possible',
          restrictions: 'Suitable for vegetarians, vegans, lactose intolerant',
          pregnancy: 'Safe during pregnancy, consult doctor for dosage'
        }
      },
      variant: ['Kurma', 'Labu'],
      canMix: false // Cannot mix - different formulations
    }
  },

  {
    name: 'mGanik 3Peptide 330g (22 servings)',
    description: 'Formula Tensiprotect revolusioner dengan 3 jenis peptide anti-hipertensi untuk menurunkan tekanan darah tinggi dan melindungi kesehatan jantung. Diformulasikan dengan salmon ovary peptide, rice peptide, dan soy oligopeptide yang terbukti klinis menurunkan tekanan darah hingga 15-20 mmHg. Diperkaya CoQ10 dan resveratrol untuk perlindungan kardiovaskular optimal. Tersedia dalam tub 330g (22 servings).',
    price: 350000,
    discountPrice: 680000, // Bundle 2 tub price
    category: 'cardiovascular',
    benefits: [
      'Anti-hipertensi dengan triple peptide formula yang terbukti klinis',
      'Menurunkan tekanan darah hingga 15-20 mmHg dalam 8 minggu',
      'Melindungi kesehatan jantung dan pembuluh darah dari kerusakan',
      'Formula Tensiprotect yang telah teruji pada 500+ pasien hipertensi',
      'Mengandung CoQ10 100mg untuk energi jantung optimal',
      'Resveratrol 50mg antioksidan untuk perlindungan vaskular',
      'Mencegah komplikasi hipertensi: stroke, serangan jantung, gagal ginjal',
      'Memperbaiki elastisitas pembuluh darah',
      'Menurunkan resistensi pembuluh darah perifer',
      'Mengoptimalkan fungsi endotel pembuluh darah',
      'Mengurangi peradangan sistemik pada sistem kardiovaskular',
      'Aman untuk penggunaan jangka panjang tanpa efek samping'
    ],
    ingredients: [
      'Salmon ovary peptide 2g (ACE inhibitor alami)',
      'Rice peptide terstandar 1.5g (vasodilatasi)',
      'Soy oligopeptide 1g (antioxidant peptide)',
      'CoQ10 (Coenzyme Q10) 100mg',
      'Resveratrol premium 50mg',
      'Potassium citrate 300mg',
      'Magnesium glycinate 200mg',
      'Taurine 500mg',
      'L-arginine 300mg',
      'Hawthorn berry extract 250mg',
      'Garlic extract 200mg',
      'Olive leaf extract 150mg'
    ],
    suitableFor: [
      'Penderita hipertensi grade 1-2 (140-179/90-109 mmHg)',
      'Tekanan darah tinggi tidak terkontrol dengan obat tunggal',
      'Risiko tinggi penyakit jantung koroner',
      'Gangguan pembuluh darah dan aterosklerosis',
      'Pre-hipertensi dan borderline (130-139/85-89 mmHg)',
      'Hipertensi sekunder akibat stress',
      'Hipertensi dengan kolesterol tinggi',
      'Pasien dengan riwayat keluarga penyakit jantung',
      'Diabetes dengan komplikasi kardiovaskular'
    ],
    dosage: 'Maintenance: 1 sachet pagi hari. Terapi intensif: 2 sachet sehari (pagi dan sore). Konsumsi dengan perut kosong atau 1 jam sebelum makan. Campur dengan 200ml air dingin. 1 tub untuk pemakaian 22 hari (1x sehari) atau 11 hari (2x sehari)',
    warnings: [
      'Wajib konsultasi dokter jika menggunakan obat hipertensi',
      'Monitor tekanan darah rutin selama penggunaan',
      'Hati-hati jika tekanan darah sudah terlalu rendah (<90/60 mmHg)',
      'Tidak untuk hipotensi atau tekanan darah rendah',
      'Dapat menyebabkan pusing jika tekanan darah turun terlalu cepat',
      'Beri jarak 2 jam dengan obat antihipertensi lainnya',
      'Hentikan jika terjadi reaksi alergi terhadap peptide ikan'
    ],
    images: ['mganik-3peptide.jpg', 'mganik-3peptide-heart.jpg', 'mganik-3peptide-clinical.jpg'],
    inStock: true,
    metadata: {
      healthConditions: [
        'hipertensi', 'hipertensi grade 1', 'hipertensi grade 2', 'darah tinggi', 'tensi tinggi',
        'penyakit jantung', 'jantung koroner', 'gagal jantung', 'aritmia',
        'gangguan pembuluh darah', 'aterosklerosis', 'penyempitan pembuluh darah',
        'pre-hipertensi', 'kardiovaskular', 'stroke', 'serangan jantung',
        'hipertensi sekunder', 'hipertensi diabetes', 'hipertensi obesitas'
      ],
      symptoms: [
        'tekanan darah tinggi', 'tensi naik', 'darah tinggi', 'hipertensi',
        'pusing', 'pusing kepala', 'sakit kepala', 'headache', 'migrain',
        'jantung berdebar', 'jantung deg-degan', 'palpitasi', 'detak jantung cepat',
        'sesak napas', 'susah napas', 'napas pendek', 'dyspnea',
        'tengkuk pegal', 'leher tegang', 'bahu pegal', 'nyeri tengkuk',
        'mata berkunang', 'mata buram', 'penglihatan kabur',
        'telinga berdenging', 'tinnitus', 'suara berdenging',
        'mual', 'muntah', 'vertigo', 'kliyengan'
      ],
      indonesianName: 'mGANIK 3PEPTIDE ANTI-HIPERTENSI',
      culturalContext: 'Formula peptide premium dengan teknologi Jepang',
      targetBP: '<140/90 mmHg',
      peptideTypes: 3,
      coq10: true,
      freeShippingBatam: true,
      shippingNote: 'Gratis ongkir khusus kota Batam',
      bundleDiscount: 20000,
      businessIntelligence: {
        costPerServing: 15909, // 350000/22
        targetDemographic: 'Penderita hipertensi 40-70 tahun',
        competitorAdvantage: 'Satu-satunya triple peptide formula di Indonesia',
        marketPosition: 'Premium cardiovascular supplement',
        seasonalDemand: 'Tinggi saat musim dingin (tekanan darah cenderung naik)',
        customerRetention: '88% repeat purchase rate'
      },
      pricingStrategy: {
        tub: {
          '1 tub (22 servings)': 350000,
          '2 tub (44 servings)': 680000
        },
        costAnalysis: {
          pricePerServing: 15909,
          costPerMonth: 954545, // 2 tub untuk 30 hari 2x sehari
          competitorComparison: '40% lebih murah dari peptide import'
        }
      },
      productSpecs: {
        flavor: 'Natural mild taste (tidak pahit)',
        texture: 'Bubuk protein halus, mudah larut dalam air dingin',
        color: 'Putih kekuningan natural dari peptide salmon',
        sweetness: 'Tidak manis (bebas gula untuk penderita diabetes)',
        packaging: 'Tub kedap udara 330g dengan sendok takar',
        shelfLife: '24 bulan dari tanggal produksi',
        storage: 'Simpan di kulkas setelah dibuka untuk menjaga kualitas peptide'
      },
      clinicalInfo: {
        salmonPeptide: '2g per serving (ACE inhibitor natural)',
        ricePeptide: '1.5g per serving (vasodilatasi)',
        soyPeptide: '1g per serving (antioxidant)',
        coq10Content: '100mg per serving (heart energy)',
        resveratrolContent: '50mg per serving (vascular protection)',
        proven: 'Uji klinis 12 minggu pada 500 pasien: penurunan tekanan darah 15-20 mmHg, perbaikan fungsi endotel 35%'
      },
      detailedComposition: {
        perServing: {
          calories: 65,
          protein: '5g (10% daily value)',
          carbohydrates: '3g (1% daily value)',
          dietaryFiber: '0g',
          sugars: '0g (no added sugar)',
          fat: '2g (3% daily value)',
          sodium: '50mg (2% daily value)',
          potassium: '300mg (9% daily value)',
          magnesium: '200mg (48% daily value)',
          coq10: '100mg (daily recommended dose)',
          resveratrol: '50mg (equivalent to 2 glasses red wine)'
        },
        peptideProfile: {
          salmonOvaryPeptide: '2g (ACE inhibitor activity)',
          ricePeptide: '1.5g (calcium channel blocker activity)',
          soyOligopeptide: '1g (antioxidant and anti-inflammatory)',
          totalPeptide: '4.5g (bioactive cardiovascular peptides)'
        },
        cardiovascularSupport: {
          coq10: '100mg (mitochondrial energy for heart)',
          resveratrol: '50mg (endothelial protection)',
          taurine: '500mg (heart rhythm regulation)',
          larginine: '300mg (nitric oxide production)',
          hawthornBerry: '250mg (cardiac contractility)',
          garlicExtract: '200mg (blood pressure regulation)',
          oliveLeafExtract: '150mg (vascular inflammation reduction)'
        },
        minerals: {
          potassium: '300mg (blood pressure regulation)',
          magnesium: '200mg (vascular smooth muscle relaxation)',
          calcium: '50mg (cardiac muscle function)',
          zinc: '5mg (antioxidant enzyme function)'
        }
      },
      usageGuidance: {
        basicUsage: {
          maintenance: {
            frequency: '1x daily',
            timing: 'Morning on empty stomach',
            duration: 'Long-term daily use for blood pressure control',
            expectedResults: 'Stable blood pressure, reduced cardiovascular risk'
          },
          therapeutic: {
            frequency: '2x daily',
            timing: 'Morning and evening on empty stomach',
            duration: '12 weeks minimum for maximum cardiovascular benefit',
            expectedResults: 'Blood pressure reduction 15-20 mmHg, improved endothelial function'
          }
        },
        specificConditions: {
          hypertension: {
            dosage: '2x daily',
            timing: 'Morning and evening, 1 hour before meals',
            instructions: 'Mix with 200ml cold water, drink immediately',
            expectedResults: 'Blood pressure reduction within 4-8 weeks, improved quality of life',
            monitoring: 'Daily blood pressure monitoring, doctor consultation monthly',
            notes: 'May allow reduction in antihypertensive medication dosage'
          },
          prehypertension: {
            dosage: '1x daily',
            timing: 'Morning on empty stomach',
            instructions: 'Consistent daily use for prevention',
            expectedResults: 'Prevention of hypertension development, cardiovascular protection',
            monitoring: 'Weekly blood pressure checks, lifestyle modification',
            notes: 'Combine with DASH diet and regular exercise'
          },
          heartDisease: {
            dosage: '1x daily',
            timing: 'Morning with cardiac medications (if prescribed)',
            instructions: 'Coordinate timing with cardiologist',
            expectedResults: 'Improved heart function, reduced cardiovascular events',
            monitoring: 'Regular cardiac function tests, lipid profile',
            notes: 'Excellent adjunct to standard cardiac therapy'
          }
        },
        preparation: {
          waterTemperature: 'Cold to room temperature water (preserves peptide integrity)',
          mixingInstructions: 'Mix gently with spoon, avoid vigorous shaking',
          additionalTips: 'Can be mixed with vegetable juice, avoid citrus juices',
          storage: 'Consume within 1 hour of preparation'
        },
        dietaryConsiderations: {
          interactions: 'Monitor closely if taking ACE inhibitors or ARBs',
          allergies: 'Contains fish-derived peptides (salmon)',
          restrictions: 'Suitable for diabetics (sugar-free), not suitable for vegetarians',
          pregnancy: 'Not recommended during pregnancy and breastfeeding'
        }
      },
      canMix: false // Single flavor product
    }
  },

  {
    name: 'Spencer\'s MealBlend',
    description: 'MEAL REPLACEMENT terbaik untuk program diet dan weight loss dengan 10 varian rasa lezat. Ultra low calorie (140 kkal), high protein (15g), high fiber (9g) - memberikan nutrisi lengkap setara makanan utama namun rendah kalori. Formula premium plant protein yang mengenyangkan lebih lama dan membantu turun berat badan efektif. Lactose free, gluten free, vegan friendly. Tersedia dalam box 15 sachets.',
    price: 280000,
    discountPrice: 540000, // Bundle 2 box price
    category: 'weight_management',
    benefits: [
      '10 varian rasa lezat untuk variasi harian tanpa bosan',
      'Ultra low calorie hanya 140kkal per serving (ideal untuk diet)',
      'Ultra low sugar kurang dari 1g per serving (diabetes friendly)',
      'High protein 15g untuk kenyang lebih lama dan preserve muscle',
      'High fiber 9g untuk kesehatan pencernaan dan detox',
      'Lactose free untuk yang intoleran laktosa',
      'Gluten free untuk yang sensitif gluten atau celiac',
      'Vegan friendly dari 100% bahan nabati premium',
      'Mengandung 23 vitamin dan mineral esensial',
      'Prebiotik dan probiotik untuk kesehatan usus optimal',
      'Digestive enzymes untuk penyerapan nutrisi maksimal',
      'Membantu menurunkan berat badan 2-4 kg per bulan'
    ],
    ingredients: [
      'Plant protein blend premium (pea, rice, hemp)',
      'Fiber kompleks larut dan tidak larut',
      'MCT oil powder (healthy fats)',
      'Natural flavoring 10 varian',
      'Prebiotik inulin dan FOS',
      'Probiotik 5 strain (1 miliar CFU)',
      'Digestive enzymes (protease, lipase, amylase)',
      'Superfood greens powder',
      'Vitamin dan mineral chelated',
      'Natural sweetener (stevia, monk fruit)',
      'Organic coconut powder',
      'Chia seed powder'
    ],
    suitableFor: [
      'Program diet dan weight management (semua jenis diet)',
      'Meal replacement sehat untuk busy lifestyle',
      'Vegetarian dan vegan yang butuh protein lengkap',
      'Lactose intolerant dan dairy sensitive',
      'Gluten sensitive dan celiac disease',
      'Diabetes dan pre-diabetes (low sugar)',
      'Post-workout recovery untuk vegetarian',
      'Detox dan cleansing program',
      'Elderly dengan kesulitan makan'
    ],
    dosage: 'Weight loss: 2 serving sebagai pengganti sarapan dan makan malam. Maintenance: 1 serving sebagai pengganti 1 makan utama. Campur dengan 250ml air dingin, shake/aduk hingga larut. 1 box untuk pemakaian 15 hari (1x sehari) atau 7-8 hari (2x sehari)',
    warnings: [
      'Konsultasi dokter jika sedang hamil atau menyusui',
      'Minum air putih yang cukup (minimal 2L per hari)',
      'Jangan digunakan sebagai satu-satunya sumber nutrisi > 2 minggu'
    ],
    images: ['spencers-mealblend.jpg', 'spencers-mealblend-flavors.jpg', 'spencers-mealblend-nutrition.jpg'],
    inStock: true,
    metadata: {
      healthConditions: [
        'obesitas', 'kegemukan', 'berat badan berlebih', 'overweight',
        'diet', 'program diet', 'weight loss', 'turun berat badan',
        'metabolisme lambat', 'metabolic syndrome',
        'intoleransi laktosa', 'lactose intolerance',
        'sensitivitas gluten', 'celiac disease', 'gluten sensitivity',
        'diabetes', 'pre-diabetes', 'gula darah tinggi',
        'kolesterol tinggi', 'hipertensi ringan'
      ],
      symptoms: [
        'berat badan naik', 'berat badan berlebih', 'kegemukan', 'obesitas',
        'susah turun berat badan', 'stuck di berat badan', 'plateau diet',
        'mudah lapar', 'lapar terus', 'ngemil terus', 'cravings',
        'metabolisme lambat', 'metabolisme terganggu', 'susah burn kalori',
        'kembung setelah makan', 'begah', 'perut buncit',
        'lemes', 'mudah capek', 'energi drop', 'fatigue',
        'pencernaan terganggu', 'susah BAB', 'konstipasi',
        'kulit kusam', 'jerawat hormonal', 'aging signs'
      ],
      indonesianName: 'SPENCER\'S MEALBLEND VEGAN PROTEIN',
      culturalContext: 'Premium meal replacement untuk gaya hidup modern Indonesia',
      flavors: 10,
      calories: 140,
      protein: '15g',
      fiber: '9g',
      sugar: '0g',
      lactoseFree: true,
      glutenFree: true,
      vegan: true,
      freeShippingBatam: true,
      shippingNote: 'Gratis ongkir khusus kota Batam',
      bundleDiscount: 20000,
      businessIntelligence: {
        costPerServing: 18667, // 280000/15
        targetDemographic: 'Urban professional 25-45 tahun, health conscious',
        competitorAdvantage: 'Satu-satunya meal replacement vegan dengan 10 rasa di Indonesia',
        marketPosition: 'Premium convenient nutrition',
        seasonalDemand: 'Peak di January (New Year resolution) dan pre-summer (April-May)',
        customerRetention: '75% repeat purchase rate'
      },
      pricingStrategy: {
        box: {
          '1 box (15 servings)': 280000,
          '2 box (30 servings)': 540000,
          '4 box (60 servings)': 920000
        },
        costAnalysis: {
          pricePerServing: 18667,
          costPerMonth: 1120000, // 2 box untuk 30 hari 2x sehari
          competitorComparison: '15% lebih murah dari imported meal replacement'
        }
      },
      productSpecs: {
        flavor: '10 varian: Dark Choco, Cappuccino, Vanilla, Strawberry, Banana, Blueberry, Cookies & Cream, Pina Colada, Taro, Corn Flake',
        texture: 'Creamy smooth tanpa gritty, mudah larut dalam air dingin',
        color: 'Varies by flavor - natural colors from ingredients',
        sweetness: 'Naturally sweet dari stevia dan monk fruit',
        packaging: 'Box premium dengan sachet individual kedap udara',
        shelfLife: '12 bulan dari tanggal produksi',
        storage: 'Simpan di tempat sejuk dan kering, hindari paparan sinar matahari'
      },
      clinicalInfo: {
        proteinContent: '15g per serving (complete amino acid profile)',
        fiberContent: '9g per serving (30% daily value)',
        digestiveEnzymes: 'Protease, lipase, amylase for optimal digestion',
        proven: 'Clinical study: 2-4 kg weight loss per month when replacing 2 meals daily'
      },
      detailedComposition: {
        perServing: {
          calories: 140,
          protein: '15g (24% daily value)',
          carbohydrates: '12g (4% daily value)',
          dietaryFiber: '9g (30% daily value)',
          sugars: '0.8g (natural from fruits)',
          fat: '8g (12% daily value)',
        },
        proteinProfile: {
          peaProtein: '8g (complete amino acids)',
          riceProtein: '5g (hypoallergenic)',
          hempProtein: '2g (omega fatty acids)',
          aminoAcidScore: '1.0 (perfect protein quality)',
          bcaaContent: '3.5g (muscle preservation)'
        },
        fiberComplex: {
          inulin: '4g (prebiotic fiber)',
          psylliumHusk: '2g (soluble fiber)',
          applePectin: '1.5g (cholesterol lowering)',
          chiaSeed: '1.5g (omega-3 and fiber)'
        },
        functionalIngredients: {
          mctOil: '2g (quick energy, fat burning)',
          greensSuperfoods: '1g (antioxidants, detox)',
          probiotics: '1 billion CFU (gut health)',
          digestiveEnzymes: '50mg (nutrient absorption)',
          adaptogenicHerbs: '200mg (stress management)'
        }
      },
      usageGuidance: {
        basicUsage: {
          weightLoss: {
            frequency: '2x daily',
            timing: 'Replace breakfast and dinner',
            duration: '8-12 weeks for significant results',
            expectedResults: '2-4 kg weight loss per month'
          },
          maintenance: {
            frequency: '1x daily',
            timing: 'Replace lunch or dinner',
            duration: 'Long-term lifestyle integration',
            expectedResults: 'Weight maintenance, improved nutrition'
          }
        },
        specificGoals: {
          rapidWeightLoss: {
            dosage: '2-3 servings daily',
            timing: 'Replace all main meals for 2 weeks max',
            instructions: 'Include 1 healthy snack and plenty of water',
            expectedResults: '3-5 kg in 2 weeks',
            monitoring: 'Daily weight, energy levels, mood',
            notes: 'Medical supervision recommended for >2 weeks'
          },
          musclePreservation: {
            dosage: '1 serving post-workout',
            timing: 'Within 30 minutes after exercise',
            instructions: 'Add 1 tbsp almond butter for extra calories',
            expectedResults: 'Maintained muscle mass during weight loss',
            monitoring: 'Body composition analysis monthly',
            notes: 'Combine with resistance training'
          },
          diabeticFriendly: {
            dosage: '1 serving per meal',
            timing: 'Regular meal times',
            instructions: 'Monitor blood sugar response',
            expectedResults: 'Stable blood sugar, gradual weight loss',
            monitoring: 'Blood glucose before and after meals',
            notes: 'Consult endocrinologist for insulin adjustment'
          }
        },
        preparation: {
          waterTemperature: 'Cold water for best taste and texture',
          mixingInstructions: 'Shake in shaker bottle for 30 seconds or blend for smoothie',
          additionalTips: 'Add ice, berries, or spinach for variety',
          storage: 'Consume within 2 hours of preparation'
        },
        dietaryConsiderations: {
          interactions: 'No known interactions with medications',
          allergies: 'May contain traces of nuts processed in same facility',
          restrictions: 'Suitable for all dietary restrictions except nut allergies',
          pregnancy: 'Consult healthcare provider before use during pregnancy'
        }
      },
      variant: ['Dark Choco', 'Cappuccino', 'Vanilla', 'Strawberry', 'Banana', 'Blueberry', 'Cookies & Cream', 'Pina Colada', 'Taro', 'Corn Flake'],
      canMix: true // Allow mixing different flavors
    }
  },

  {
    name: 'Flimty Fiber',
    description: 'DETOX & WEIGHT LOSS fiber premium yang sangat efektif menyerap minyak, lemak, dan gula dari makanan hingga 70%. Formula ultimate untuk program diet dengan psyllium husk premium + superfruit blend. Memberikan efek kenyang 30% lebih lama, membakar lemak perut, dan detox racun dalam tubuh. TERBUKTI turunkan berat badan dalam 2 minggu. Tersedia dalam box 16 sachets dengan 3 varian rasa buah segar.',
    price: 220000,
    discountPrice: 440000, // Bundle 2 box price
    category: 'weight_management',
    benefits: [
      'Menyerap minyak, lemak, dan gula dari makanan hingga 70%',
      'Memberikan efek kenyang hingga 30% lebih lama (appetite suppressant)',
      'Tinggi serat premium 5g per sachet untuk detox optimal',
      'Detox pencernaan menyeluruh dan melancarkan BAB dalam 24 jam',
      'Psyllium husk premium grade imported dari India',
      'Kaya antioksidan dari superfruit blend (goji, pomegranate, acai)',
      'Melancarkan BAB dan mengatasi sembelit kronis',
      'Membantu menurunkan kolesterol LDL hingga 15% dalam 8 minggu',
      'Membersihkan usus dari racun dan sisa makanan',
      'Meningkatkan metabolisme dan pembakaran lemak',
      'Mengontrol gula darah post-meal',
      'Memperbaiki microbiome usus untuk kesehatan optimal'
    ],
    ingredients: [
      'Psyllium husk premium imported (Plantago ovata)',
      'Goji berry extract (antioksidan tinggi)',
      'Bit merah powder (detox dan nitrat alami)',
      'Pomegranate extract (punicalagin)',
      'Acai berry powder (superfruit antioxidant)',
      'Ekstrak buah organik pilihan',
      'Ekstrak sayur organik (broccoli, spinach)',
      'Inulin prebiotic fiber',
      'Apple pectin (cholesterol binding)',
      'Natural fruit flavoring',
      'Stevia leaf extract'
    ],
    suitableFor: [
      'Program detox pencernaan dan cleansing',
      'Penderita sembelit kronis dan konstipasi',
      'Diet tinggi serat dan weight management',
      'Penderita kolesterol tinggi (>200 mg/dL)',
      'Program kontrol berat badan dan fat blocker',
      'Pencernaan bermasalah dan IBS',
      'Sindrom usus bocor (leaky gut)',
      'Post-antibiotik recovery (microbiome repair)',
      'Diabetes dengan masalah pencernaan',
      'Detox setelah holiday eating atau cheat meal'
    ],
    dosage: 'Detox intensif: 1 sachet sebelum makan utama (3x sehari). Maintenance: 1-2 sachet sehari sebelum makan terbesar. Campur dengan 300ml air dingin, aduk cepat dan minum segera. 1 box untuk pemakaian 16 hari (1x sehari) atau 5-8 hari (2-3x sehari)',
    warnings: [
      'Wajib minum air putih minimal 2-3 gelas setelah konsumsi',
      'Jangan dikonsumsi bersamaan dengan obat (beri jarak 2 jam)',
      'Mulai dengan dosis rendah untuk adaptasi usus',
      'Hentikan jika terjadi kram perut yang parah',
      'Tidak untuk penderita obstruksi usus',
      'Konsultasi dokter jika sedang hamil atau menyusui',
      'Dapat mengurangi absorpsi vitamin larut lemak'
    ],
    images: ['flimty-fiber.jpg', 'flimty-fiber-detox.jpg', 'flimty-fiber-variants.jpg'],
    inStock: true,
    metadata: {
      healthConditions: [
        'sembelit', 'konstipasi', 'susah BAB', 'BAB keras',
        'kolesterol tinggi', 'kolesterol naik', 'hypercholesterolemia',
        'pencernaan bermasalah', 'gangguan pencernaan', 'digestive issues',
        'detox', 'detoksifikasi', 'cleansing', 'colon cleanse',
        'obesitas', 'kegemukan', 'berat badan berlebih',
        'IBS', 'irritable bowel syndrome', 'sindrom usus iritabel',
        'leaky gut', 'usus bocor', 'microbiome imbalance',
        'metabolisme lambat', 'fat absorption', 'sugar absorption'
      ],
      symptoms: [
        'susah BAB', 'konstipasi', 'BAB keras', 'jarang BAB',
        'perut kembung', 'begah', 'perut penuh', 'bloating',
        'pencernaan lambat', 'slow digestion', 'food stagnation',
        'kolesterol naik', 'kolesterol tinggi', 'lipid tinggi',
        'berat badan naik', 'susah turun berat', 'lemak menumpuk',
        'perut buncit', 'perut distended', 'belly fat',
        'mudah lapar', 'cravings', 'appetite berlebih',
        'energi drop', 'lemes', 'sluggish feeling',
        'kulit kusam', 'jerawat', 'toxin buildup',
        'nafas bau', 'bau mulut', 'halitosis'
      ],
      indonesianName: 'FLIMTY FIBER DETOX PREMIUM',
      culturalContext: 'Solusi detox modern untuk gaya hidup Indonesia yang tinggi lemak',
      fiberContent: '5g',
      satietyBoost: '30%',
      fatAbsorption: '70%',
      psylliumHusk: true,
      organic: true,
      flavors: 3,
      freeShippingBatam: true,
      shippingNote: 'Gratis ongkir khusus kota Batam',
      businessIntelligence: {
        costPerServing: 13750, // 220000/16
        targetDemographic: 'Urban lifestyle 25-50 tahun dengan masalah pencernaan',
        competitorAdvantage: 'Satu-satunya fiber detox dengan superfruit blend di Indonesia',
        marketPosition: 'Premium digestive health supplement',
        seasonalDemand: 'Peak post-holiday season (January) dan pre-summer (April)',
        customerRetention: '70% repeat purchase rate'
      },
      pricingStrategy: {
        box: {
          '1 box (16 servings)': 220000,
          '2 box (32 servings)': 440000
        },
        costAnalysis: {
          pricePerServing: 13750,
          costPerMonth: 825000, // 2 box untuk 30 hari 2x sehari
          competitorComparison: '20% lebih murah dari imported fiber supplements'
        }
      },
      productSpecs: {
        flavor: '3 varian: Blackcurrant (asam segar), Raspberry (manis-asam), Mango (tropical sweet)',
        texture: 'Bubuk fiber halus yang mengembang dalam air, slightly thick',
        color: 'Purple natural (Blackcurrant), Pink natural (Raspberry), Orange natural (Mango)',
        sweetness: 'Manis alami dari stevia, tanpa gula tambahan',
        packaging: 'Box ramah lingkungan dengan sachet biodegradable',
        shelfLife: '24 bulan dari tanggal produksi',
        storage: 'Simpan di tempat kering, hindari kelembaban tinggi'
      },
      clinicalInfo: {
        psylliumContent: '3g per serving (premier soluble fiber)',
        superfruitsBlend: '1g per serving (high ORAC antioxidants)',
        prebioticFiber: '1g per serving (gut health support)',
        fatBinding: '70% dietary fat absorption blocked',
        cholesterolReduction: '15% LDL reduction in 8 weeks',
        proven: 'Clinical studies: 70% fat absorption blocked, 15% cholesterol reduction, 95% constipation relief'
      },
      detailedComposition: {
        perServing: {
          calories: 60,
          protein: '0.5g (1% daily value)',
          carbohydrates: '6g (2% daily value)',
          dietaryFiber: '5g (20% daily value)',
          sugars: '0g (no added sugar)',
          fat: '0g',
          sodium: '5mg (0% daily value)',
          potassium: '120mg (3% daily value)'
        },
        fiberComplex: {
          psylliumHusk: '3g (premium soluble fiber)',
          inulin: '1g (prebiotic fiber)',
          applePectin: '0.5g (cholesterol binding fiber)',
          beetFiber: '0.5g (nitrate and fiber)'
        },
        superfruitsBlend: {
          gojiBerry: '300mg (zeaxanthin, beta-carotene)',
          pomegranate: '250mg (punicalagin, ellagic acid)',
          acaiBerry: '200mg (anthocyanins, omega fatty acids)',
          organicFruitsVeggies: '250mg (mixed antioxidants)'
        },
        functionalCompounds: {
          antioxidants: 'ORAC value 3000 μmol TE/serving',
          nitrates: '50mg (from beetroot, circulation)',
          prebiotics: '1g (gut microbiome support)',
          polyphenols: '200mg (anti-inflammatory compounds)',
          solubleFiber: '4g (cholesterol and glucose binding)',
          insolubleFiber: '1g (bulk and regularity)'
        }
      },
      usageGuidance: {
        basicUsage: {
          detoxification: {
            frequency: '2-3x daily',
            timing: '30 minutes before main meals',
            duration: '7-14 days intensive, then maintenance',
            expectedResults: 'Bowel movement normalization, toxin elimination'
          },
          maintenance: {
            frequency: '1-2x daily',
            timing: 'Before largest meals',
            duration: 'Long-term digestive health support',
            expectedResults: 'Regular bowel movements, weight management'
          }
        },
        specificConditions: {
          constipation: {
            dosage: '1 sachet 2x daily',
            timing: 'Morning and evening with plenty of water',
            instructions: 'Start with once daily, increase gradually',
            expectedResults: 'Bowel movement within 24-48 hours',
            monitoring: 'Stool frequency and consistency',
            notes: 'May cause initial bloating as gut adjusts'
          },
          cholesterol: {
            dosage: '1 sachet before each meal',
            timing: '30 minutes before breakfast, lunch, dinner',
            instructions: 'Consistent daily use for 8 weeks minimum',
            expectedResults: '15% LDL cholesterol reduction',
            monitoring: 'Lipid panel every 8 weeks',
            notes: 'Combine with low-fat diet for maximum benefit'
          },
          weightManagement: {
            dosage: '1 sachet before 2 main meals',
            timing: 'Before lunch and dinner',
            instructions: 'Drink immediately after mixing, follow with water',
            expectedResults: 'Appetite suppression, fat blocking',
            monitoring: 'Weekly weight and waist measurements',
            notes: 'Works best with portion control and exercise'
          }
        },
        preparation: {
          waterTemperature: 'Cold to room temperature water',
          mixingInstructions: 'Mix quickly with 150-250ml water, drink immediately before gel forms',
          additionalTips: 'Can be mixed with sugar-free beverages, avoid carbonated drinks',
          storage: 'Must be consumed within 5 minutes of preparation'
        },
        dietaryConsiderations: {
          interactions: 'Take 2 hours apart from medications and fat-soluble vitamins',
          allergies: 'Generally well-tolerated, rare psyllium allergies possible',
          restrictions: 'Suitable for vegetarians, vegans, diabetics',
          pregnancy: 'Safe during pregnancy with adequate fluid intake'
        }
      },
      variant: ['Blackcurrant', 'Raspberry', 'Mango'],
      canMix: true // Allow mixing different flavors
    }
  }
];

export async function seedProducts(forceUpdate: boolean = false): Promise<void> {
  try {
    logger.info('Starting comprehensive product seeding...');

    // Check if products already exist
    const existingProducts = await productService.getAllProducts();
    if (existingProducts.length > 0 && !forceUpdate) {
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

    if (forceUpdate && existingProducts.length > 0) {
      logger.info('Force update mode enabled - proceeding with seeding', { 
        existingCount: existingProducts.length,
        action: 'force_update'
      });
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

    case 'force':
      seedProducts(true)
        .then(() => {
          console.log('✅ Product force update completed successfully');
          return displayProductSummary();
        })
        .then(() => process.exit(0))
        .catch((error) => {
          console.error('❌ Product force update failed:', error);
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