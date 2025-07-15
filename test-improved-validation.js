// Test the improved validation system logic
console.log('🧪 Testing Improved Context Validation System\n');

// Test 1: Simple ordering query (should NOT escalate)
console.log('Test 1: Simple ordering query - "mau pesan hotto kak"');

const orderingQuery = 'mau pesan hotto kak';
const orderingKeywords = [
  'mau pesan', 'mau order', 'mau beli', 'pesan', 'order', 'beli',
  'ambil', 'minta', 'butuh', 'perlu', 'checkout', 'bayar'
];

const isOrderingIntent = orderingKeywords.some(keyword => orderingQuery.toLowerCase().includes(keyword));
console.log('Query analysis:', {
  query: orderingQuery,
  intent: isOrderingIntent ? 'ordering' : 'unknown',
  shouldSkipProductValidation: isOrderingIntent
});

// Test 2: Product information query (should validate products)
console.log('\nTest 2: Product info query - "superfood rasa apa aja?"');

const productInfoQuery = 'superfood rasa apa aja?';
const productInfoKeywords = [
  'rasa apa', 'varian', 'flavor', 'harga berapa', 'manfaat', 'efek',
  'khasiat', 'komposisi', 'kandungan', 'cara pakai', 'dosis',
  'perbedaan', 'bedanya', 'info', 'informasi', 'detail'
];

const isProductInfoIntent = productInfoKeywords.some(keyword => productInfoQuery.toLowerCase().includes(keyword));
console.log('Query analysis:', {
  query: productInfoQuery,
  intent: isProductInfoIntent ? 'product_info' : 'unknown',
  shouldValidateProducts: isProductInfoIntent
});

// Test 3: Wrong product response (should escalate only for product_info)
console.log('\nTest 3: Wrong product response validation');

const wrongProductResponse = 'mGanik 3Peptide tersedia dalam kemasan 330g';
const expectedProduct = 'superfood';
const mentionedProduct = '3peptide';

const hasWrongProduct = expectedProduct !== mentionedProduct;
const shouldEscalateWrongProduct = isProductInfoIntent && hasWrongProduct;

console.log('Wrong product validation:', {
  expectedProduct,
  mentionedProduct,
  hasWrongProduct,
  queryIntent: isProductInfoIntent ? 'product_info' : 'ordering',
  shouldEscalate: shouldEscalateWrongProduct
});

// Test 4: Conversation restart detection (should always escalate)
console.log('\nTest 4: Conversation restart detection');

const restartResponse = 'Selamat malam! Perkenalkan saya Maya';
const restartPatterns = ['selamat malam', 'selamat pagi', 'perkenalkan saya'];

const hasRestartPattern = restartPatterns.some(pattern => 
  restartResponse.toLowerCase().includes(pattern)
);

console.log('Restart detection:', {
  response: restartResponse,
  hasRestartPattern,
  shouldAlwaysEscalate: hasRestartPattern
});

// Test 5: Confidence calculation (improved thresholds)
console.log('\nTest 5: Confidence calculation');

function calculateConfidence(issues) {
  let confidence = 1.0;
  
  issues.forEach(issue => {
    switch (issue.severity) {
      case 'critical':
        confidence -= 0.3; // Reduced from 0.5
        break;
      case 'high':
        confidence -= 0.2; // Reduced from 0.3
        break;
      case 'medium':
        confidence -= 0.1; // Reduced from 0.15
        break;
      case 'low':
        confidence -= 0.05;
        break;
    }
  });
  
  return Math.max(0, confidence);
}

const testIssues = [
  { severity: 'medium', type: 'context_bleeding' },
  { severity: 'low', type: 'relevance' }
];

const confidence = calculateConfidence(testIssues);
const isValid = confidence > 0.5; // New threshold (was 0.7)

console.log('Confidence calculation:', {
  issues: testIssues,
  confidence: confidence.toFixed(2),
  threshold: 0.5,
  isValid
});

// Test 6: Escalation logic (more conservative)
console.log('\nTest 6: Escalation logic');

function shouldEscalate(issues) {
  const hasConversationRestart = issues.some(issue => 
    issue.type === 'conversation_restart' && issue.severity === 'critical'
  );
  
  if (hasConversationRestart) return true;
  
  const criticalCount = issues.filter(issue => issue.severity === 'critical').length;
  if (criticalCount >= 2) return true;
  
  const highSeverityCount = issues.filter(issue => issue.severity === 'high').length;
  if (highSeverityCount >= 3) return true; // Increased from 2 to 3
  
  const criticalEscalationTypes = ['wrong_product', 'conversation_restart'];
  return issues.some(issue => 
    criticalEscalationTypes.includes(issue.type) && issue.severity === 'critical'
  );
}

const scenarioA = [{ type: 'context_bleeding', severity: 'medium' }];
const scenarioB = [{ type: 'wrong_product', severity: 'critical' }];
const scenarioC = [{ type: 'conversation_restart', severity: 'critical' }];

console.log('Escalation scenarios:', {
  scenarioA: { issues: scenarioA, shouldEscalate: shouldEscalate(scenarioA) },
  scenarioB: { issues: scenarioB, shouldEscalate: shouldEscalate(scenarioB) },
  scenarioC: { issues: scenarioC, shouldEscalate: shouldEscalate(scenarioC) }
});

console.log('\n✅ Improved validation system tests completed');
console.log('✅ Key improvements:');
console.log('   - Intent-based validation (ordering vs product_info)');
console.log('   - Lower confidence threshold (0.5 vs 0.7)');
console.log('   - Reduced confidence penalties');
console.log('   - More conservative escalation logic');
console.log('   - Better product keyword matching');
console.log('\n🎯 Expected behavior:');
console.log('   - "mau pesan hotto kak" → NO escalation');
console.log('   - "superfood rasa apa aja?" → validates products');
console.log('   - Wrong product in info queries → escalates');
console.log('   - Conversation restarts → always escalate');