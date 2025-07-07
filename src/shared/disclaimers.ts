/**
 * Medical and Product Disclaimers
 * 
 * Legal disclaimers for health consultation and product recommendations
 * to ensure compliance with Indonesian health regulations
 */

export const MEDICAL_DISCLAIMER = `
⚠️ PENTING: Informasi ini hanya untuk edukasi umum, bukan pengganti konsultasi medis profesional. Selalu konsultasi dengan dokter untuk masalah kesehatan serius. Maya bukan tenaga medis berlisensi.`;

export const PRODUCT_DISCLAIMER = `
📋 Disclaimer: Produk ini adalah suplemen makanan, bukan obat. Tidak dimaksudkan untuk mendiagnosis, mengobati, menyembuhkan, atau mencegah penyakit apa pun. Konsultasi dengan dokter sebelum menggunakan suplemen.`;

export const GENERAL_HEALTH_DISCLAIMER = `
💡 Catatan: Saran kesehatan ini bersifat umum dan tidak menggantikan konsultasi medis profesional. Untuk kondisi kesehatan yang serius atau berkelanjutan, segera konsultasi dengan dokter.`;

export const CONSULTATION_DISCLAIMER = `
🩺 Disclaimer Konsultasi: Maya adalah asisten AI yang memberikan informasi kesehatan umum. Untuk diagnosis dan pengobatan yang akurat, konsultasi dengan dokter atau tenaga medis berlisensi.`;

export const PRODUCT_RECOMMENDATION_DISCLAIMER = `
🛒 Disclaimer Rekomendasi: Rekomendasi produk berdasarkan informasi umum yang Anda berikan. Efektivitas dapat bervariasi untuk setiap individu. Konsultasi dengan dokter untuk saran yang lebih spesifik.`;

export const EMERGENCY_DISCLAIMER = `
🚨 PERINGATAN: Untuk kondisi darurat medis, segera hubungi layanan darurat (119) atau pergi ke rumah sakit terdekat. Jangan mengandalkan konsultasi AI untuk situasi darurat.`;

/**
 * Determines which disclaimer to use based on message content
 */
export function getAppropriateDisclaimer(messageContent: string): string {
  const content = messageContent.toLowerCase();
  
  // Emergency keywords
  const emergencyKeywords = [
    'darurat', 'emergency', 'sesak napas', 'nyeri dada', 'pingsan',
    'pendarahan', 'kecelakaan', 'overdosis', 'kejang', 'stroke'
  ];
  
  // Medical consultation keywords
  const medicalKeywords = [
    'sakit', 'nyeri', 'demam', 'batuk', 'pilek', 'pusing', 'mual',
    'diare', 'konstipasi', 'insomnia', 'stress', 'depresi', 'anxiety'
  ];
  
  // Product recommendation keywords
  const productKeywords = [
    'suplemen', 'vitamin', 'produk', 'rekomendasi', 'beli', 'pesan',
    'order', 'harga', 'terbaik untuk'
  ];
  
  // Check for emergency content
  if (emergencyKeywords.some(keyword => content.includes(keyword))) {
    return EMERGENCY_DISCLAIMER;
  }
  
  // Check for product recommendation
  if (productKeywords.some(keyword => content.includes(keyword))) {
    return PRODUCT_RECOMMENDATION_DISCLAIMER;
  }
  
  // Check for medical consultation
  if (medicalKeywords.some(keyword => content.includes(keyword))) {
    return CONSULTATION_DISCLAIMER;
  }
  
  // Default to general health disclaimer
  return GENERAL_HEALTH_DISCLAIMER;
}

/**
 * Adds disclaimer to response text
 */
export function addDisclaimerToResponse(response: string, disclaimer?: string): string {
  if (!disclaimer) {
    disclaimer = getAppropriateDisclaimer(response);
  }
  
  return `${response}\n\n${disclaimer}`;
}

/**
 * Checks if response already contains a disclaimer
 */
export function hasDisclaimer(response: string): boolean {
  const disclaimerIndicators = [
    'disclaimer', 'peringatan', 'penting', 'catatan',
    '⚠️', '📋', '💡', '🩺', '🛒', '🚨'
  ];
  
  return disclaimerIndicators.some(indicator => 
    response.toLowerCase().includes(indicator.toLowerCase())
  );
}

/**
 * Product-specific disclaimers
 */
export const PRODUCT_SPECIFIC_DISCLAIMERS = {
  diabetes: `
⚠️ Khusus Diabetes: Konsultasi dengan dokter sebelum menggunakan suplemen untuk diabetes. Suplemen tidak menggantikan obat diabetes yang diresepkan dokter.`,
  
  hypertension: `
⚠️ Khusus Hipertensi: Konsultasi dengan dokter sebelum menggunakan suplemen untuk tekanan darah tinggi. Tetap konsumsi obat yang diresepkan dokter.`,
  
  heart: `
⚠️ Khusus Jantung: Konsultasi dengan dokter sebelum menggunakan suplemen untuk kesehatan jantung. Jangan menggantikan obat jantung yang diresepkan.`,
  
  liver: `
⚠️ Khusus Hati: Konsultasi dengan dokter sebelum menggunakan suplemen untuk kesehatan hati. Beberapa suplemen dapat berinteraksi dengan obat hati.`,
  
  kidney: `
⚠️ Khusus Ginjal: Konsultasi dengan dokter sebelum menggunakan suplemen untuk kesehatan ginjal. Kondisi ginjal memerlukan pemantauan medis ketat.`,
  
  pregnant: `
⚠️ Khusus Ibu Hamil: Konsultasi dengan dokter atau bidan sebelum menggunakan suplemen selama kehamilan. Tidak semua suplemen aman untuk ibu hamil.`,
  
  children: `
⚠️ Khusus Anak-anak: Konsultasi dengan dokter anak sebelum memberikan suplemen pada anak. Dosis dan jenis suplemen berbeda untuk anak-anak.`
};

/**
 * Gets condition-specific disclaimer
 */
export function getConditionDisclaimer(conditions: string[]): string {
  const conditionLower = conditions.map(c => c.toLowerCase());
  
  for (const [condition, disclaimer] of Object.entries(PRODUCT_SPECIFIC_DISCLAIMERS)) {
    if (conditionLower.some(c => c.includes(condition))) {
      return disclaimer;
    }
  }
  
  return PRODUCT_DISCLAIMER;
}