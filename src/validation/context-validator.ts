import { logger } from '@/shared/logger';
import { productService } from '@/products/product-service';
import { Product } from '@/types/product';

export interface ValidationResult {
  isValid: boolean;
  confidence: number; // 0-1 scale
  issues: ValidationIssue[];
  shouldEscalate: boolean;
}

export interface ValidationIssue {
  type: ValidationIssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expected?: string;
  actual?: string;
}

export enum ValidationIssueType {
  WRONG_PRODUCT = 'wrong_product',
  CONVERSATION_RESTART = 'conversation_restart',
  IRRELEVANT_RESPONSE = 'irrelevant_response',
  PRODUCT_MISMATCH = 'product_mismatch',
  PRICE_INCONSISTENCY = 'price_inconsistency',
  CATEGORY_MISMATCH = 'category_mismatch',
  CONTEXT_BLEEDING = 'context_bleeding'
}

export interface ValidationContext {
  userQuery: string;
  aiResponse: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  currentState?: string;
  mentionedProducts?: string[] | undefined;
  expectedProduct?: string | undefined;
  queryIntent?: 'ordering' | 'product_info' | 'general' | 'unknown';
}

export class ContextValidator {
  private products: Product[] = [];
  private productKeywords: Map<string, string[]> = new Map();

  constructor() {
    void this.initializeProductData();
  }

  private async initializeProductData(): Promise<void> {
    try {
      this.products = await productService.getAllProducts();
      this.buildProductKeywords();
      logger.info('ContextValidator initialized with product data', {
        productCount: this.products.length
      });
    } catch (error) {
      logger.error('Failed to initialize ContextValidator', { error });
    }
  }

  private buildProductKeywords(): void {
    this.products.forEach(product => {
      const keywords: string[] = [];
      
      // Product name variations
      keywords.push(product.name.toLowerCase());
      keywords.push(...this.generateNameVariations(product.name));
      
      // Metadata keywords if available
      const metadata = product.metadata as any;
      if (metadata?.indonesianName) {
        keywords.push(metadata.indonesianName.toLowerCase());
      }
      
      // Health conditions from metadata
      if (metadata?.healthConditions) {
        keywords.push(...metadata.healthConditions.map((c: string) => c.toLowerCase()));
      }
      
      this.productKeywords.set(product.id, keywords);
    });
  }

  private detectQueryIntent(userQuery: string): 'ordering' | 'product_info' | 'general' | 'unknown' {
    const query = userQuery.toLowerCase();
    
    // Ordering intent keywords
    const orderingKeywords = [
      'mau pesan', 'mau order', 'mau beli', 'pesan', 'order', 'beli',
      'ambil', 'minta', 'butuh', 'perlu', 'checkout', 'bayar'
    ];
    
    // Product information intent keywords
    const productInfoKeywords = [
      'rasa apa', 'varian', 'flavor', 'harga berapa', 'manfaat', 'efek',
      'khasiat', 'komposisi', 'kandungan', 'cara pakai', 'dosis',
      'perbedaan', 'bedanya', 'info', 'informasi', 'detail'
    ];
    
    // General conversation keywords
    const generalKeywords = [
      'halo', 'hai', 'selamat', 'terima kasih', 'thanks', 'ok', 'oke',
      'baik', 'siap', 'ya', 'tidak', 'sudah', 'belum'
    ];
    
    // Check for ordering intent
    if (orderingKeywords.some(keyword => query.includes(keyword))) {
      return 'ordering';
    }
    
    // Check for product information intent
    if (productInfoKeywords.some(keyword => query.includes(keyword))) {
      return 'product_info';
    }
    
    // Check for general conversation
    if (generalKeywords.some(keyword => query.includes(keyword))) {
      return 'general';
    }
    
    // Default to unknown for complex queries
    return 'unknown';
  }

  private generateNameVariations(productName: string): string[] {
    const variations: string[] = [];
    const name = productName.toLowerCase();
    
    // For mGanik products, add variations
    if (name.includes('mganik') || name.includes('ganik')) {
      variations.push('mganik', 'ganik');
      
      if (name.includes('metafiber')) {
        variations.push('metafiber', 'meta fiber', 'fiber');
      }
      if (name.includes('3peptide') || name.includes('peptide')) {
        variations.push('3peptide', 'peptide', '3 peptide');
      }
      if (name.includes('superfood')) {
        variations.push('superfood', 'super food', 'kelor', 'moringa');
      }
    }
    
    // For Hotto products
    if (name.includes('hotto')) {
      variations.push('hotto', 'hot to');
      
      if (name.includes('purto')) {
        variations.push('purto', 'oat', 'hotto purto');
      }
      if (name.includes('mame')) {
        variations.push('mame', 'protein', 'hotto mame');
      }
      
      // Add general hotto variations for ordering
      variations.push('hotto product', 'produk hotto');
    }
    
    // For Spencer's
    if (name.includes('spencer')) {
      variations.push('spencer', 'spencers', 'mealblend', 'meal blend');
    }
    
    // For Flimty
    if (name.includes('flimty')) {
      variations.push('flimty', 'fiber');
    }
    
    return variations;
  }

  public async validateResponse(context: ValidationContext): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    let confidence = 1.0;

    try {
      // 0. Detect query intent first
      context.queryIntent = this.detectQueryIntent(context.userQuery);

      // 1. Check for conversation restart patterns
      this.checkConversationRestart(context, issues);

      // 2. Check product consistency (only for product_info queries)
      if (context.queryIntent === 'product_info') {
        await this.checkProductConsistency(context, issues);
      }

      // 3. Check for context bleeding
      this.checkContextBleeding(context, issues);

      // 4. Check response relevance
      this.checkResponseRelevance(context, issues);

      // 5. Check price consistency (only for product_info queries)
      if (context.queryIntent === 'product_info') {
        this.checkPriceConsistency(context, issues);
      }

      // Calculate confidence based on issues
      confidence = this.calculateConfidence(issues);

      const shouldEscalate = this.shouldEscalateIssues(issues);

      logger.info('Context validation completed', {
        userQuery: context.userQuery.substring(0, 100),
        confidence,
        issuesCount: issues.length,
        shouldEscalate,
        issues: issues.map(i => ({ type: i.type, severity: i.severity }))
      });

      return {
        isValid: confidence > 0.5 && !shouldEscalate,
        confidence,
        issues,
        shouldEscalate
      };

    } catch (error) {
      logger.error('Context validation failed', { error });
      
      // Fail safe - escalate if validator has issues
      return {
        isValid: false,
        confidence: 0,
        issues: [{
          type: ValidationIssueType.IRRELEVANT_RESPONSE,
          severity: 'critical',
          description: 'Validation system error - escalating for safety'
        }],
        shouldEscalate: true
      };
    }
  }

  private checkConversationRestart(context: ValidationContext, issues: ValidationIssue[]): void {
    const response = context.aiResponse.toLowerCase();
    const restartPatterns = [
      'selamat malam',
      'selamat pagi', 
      'selamat siang',
      'selamat sore',
      'halo',
      'hai',
      'perkenalkan saya'
    ];

    // Check if response starts with greeting when it shouldn't
    const hasGreeting = restartPatterns.some(pattern => 
      response.startsWith(pattern) || response.includes(`halo, ${pattern}`)
    );

    if (hasGreeting && context.conversationHistory.length > 2) {
      issues.push({
        type: ValidationIssueType.CONVERSATION_RESTART,
        severity: 'high',
        description: 'AI unexpectedly restarted conversation with greeting',
        actual: context.aiResponse.substring(0, 100)
      });
    }
  }

  private async checkProductConsistency(context: ValidationContext, issues: ValidationIssue[]): Promise<void> {
    const userQuery = context.userQuery.toLowerCase();
    const aiResponse = context.aiResponse.toLowerCase();

    // Extract products mentioned in user query
    const queryProducts = this.extractMentionedProducts(userQuery);
    
    // Extract products mentioned in AI response  
    const responseProducts = this.extractMentionedProducts(aiResponse);

    // Only check for product consistency if there are specific information requests
    // For ordering queries, be more lenient
    if (context.queryIntent === 'product_info' && queryProducts.length > 0 && responseProducts.length > 0) {
      const queryProduct = queryProducts[0]; // Primary product in query
      const responseProduct = responseProducts[0]; // Primary product in response

      if (queryProduct !== responseProduct && queryProduct && responseProduct) {
        const queryProductName = this.getProductName(queryProduct) || 'Unknown';
        const responseProductName = this.getProductName(responseProduct) || 'Unknown';

        issues.push({
          type: ValidationIssueType.WRONG_PRODUCT,
          severity: 'critical',
          description: `User asked about ${queryProductName} but AI responded about ${responseProductName}`,
          expected: queryProductName,
          actual: responseProductName
        });
      }
    }

    // Check for specific product query patterns (only for product_info intent)
    if (context.queryIntent === 'product_info') {
      this.checkSpecificProductQueries(context, issues);
    }
  }

  private checkSpecificProductQueries(context: ValidationContext, issues: ValidationIssue[]): void {
    const userQuery = context.userQuery.toLowerCase();
    const aiResponse = context.aiResponse.toLowerCase();

    // Check flavor/variant questions
    if (userQuery.includes('rasa apa') || userQuery.includes('varian') || userQuery.includes('flavor')) {
      const mentionedProducts = this.extractMentionedProducts(userQuery);
      
      if (mentionedProducts.length > 0) {
        const productId = mentionedProducts[0]!;
        const product = this.products.find(p => p.id === productId);
        
        if (product) {
          const hasFlavorInfo = this.checkFlavorInfoInResponse(aiResponse, product);
          
          if (!hasFlavorInfo) {
            issues.push({
              type: ValidationIssueType.IRRELEVANT_RESPONSE,
              severity: 'high',
              description: `User asked about flavors but response doesn't contain flavor information`,
              expected: `Information about ${product.name} flavors/variants`,
              actual: 'No flavor information found'
            });
          }
        }
      }
    }
  }

  private checkFlavorInfoInResponse(response: string, _product: Product): boolean {
    const flavorKeywords = [
      'rasa', 'varian', 'flavor', 'taste',
      // Specific flavors from our products
      'jeruk yuzu', 'cocopandan', 'leci', 'kurma', 'labu',
      'blackcurrant', 'raspberry', 'mango',
      'dark choco', 'cappuccino', 'vanilla', 'strawberry', 'banana'
    ];

    return flavorKeywords.some(keyword => response.includes(keyword.toLowerCase()));
  }

  private checkContextBleeding(context: ValidationContext, issues: ValidationIssue[]): void {
    // Check if response mentions multiple unrelated products
    const responseProducts = this.extractMentionedProducts(context.aiResponse.toLowerCase());
    
    if (responseProducts.length > 2) {
      issues.push({
        type: ValidationIssueType.CONTEXT_BLEEDING,
        severity: 'medium',
        description: 'Response mentions too many different products',
        actual: `Mentioned ${responseProducts.length} products`
      });
    }

    // Check conversation history consistency
    if (context.conversationHistory.length >= 2) {
      const recentHistory = context.conversationHistory.slice(-3);
      const historyProducts = recentHistory
        .map(msg => this.extractMentionedProducts(msg.content.toLowerCase()))
        .flat();
      
      const currentResponseProducts = this.extractMentionedProducts(context.aiResponse.toLowerCase());
      
      // If user was asking about one product consistently, but AI suddenly switches
      if (historyProducts.length > 0 && currentResponseProducts.length > 0) {
        const mostMentionedProduct = this.getMostFrequentProduct(historyProducts);
        const currentProduct = currentResponseProducts[0];
        
        if (mostMentionedProduct && currentProduct && mostMentionedProduct !== currentProduct && 
            !context.userQuery.toLowerCase().includes((this.getProductName(currentProduct) || '').toLowerCase())) {
          issues.push({
            type: ValidationIssueType.CONTEXT_BLEEDING,
            severity: 'high',
            description: 'AI switched products without user requesting it',
            expected: this.getProductName(mostMentionedProduct) || 'Unknown',
            actual: this.getProductName(currentProduct) || 'Unknown'
          });
        }
      }
    }
  }

  private checkResponseRelevance(context: ValidationContext, issues: ValidationIssue[]): void {
    const userQuery = context.userQuery.toLowerCase();
    const aiResponse = context.aiResponse.toLowerCase();

    // Check if response is completely irrelevant
    const queryKeywords = this.extractKeywords(userQuery);
    const responseKeywords = this.extractKeywords(aiResponse);
    
    const relevanceScore = this.calculateKeywordOverlap(queryKeywords, responseKeywords);
    
    if (relevanceScore < 0.2) {
      issues.push({
        type: ValidationIssueType.IRRELEVANT_RESPONSE,
        severity: 'high',
        description: 'Response seems completely unrelated to user query',
        actual: `Relevance score: ${relevanceScore.toFixed(2)}`
      });
    }
  }

  private checkPriceConsistency(context: ValidationContext, issues: ValidationIssue[]): void {
    const response = context.aiResponse.toLowerCase();
    
    // Extract price mentions in response
    const priceMatches = response.match(/rp[\s]*([0-9,.]+)/gi);
    
    if (priceMatches) {
      // Check if mentioned prices match actual product prices
      const responseProducts = this.extractMentionedProducts(response);
      
      responseProducts.forEach(productId => {
        const product = this.products.find(p => p.id === productId);
        if (product) {
          const actualPrice = product.price.toString();
          const priceInResponse = priceMatches.some(price => 
            price.replace(/[^0-9]/g, '') === actualPrice
          );
          
          if (!priceInResponse) {
            issues.push({
              type: ValidationIssueType.PRICE_INCONSISTENCY,
              severity: 'medium',
              description: `Price mentioned doesn't match ${product.name} actual price`,
              expected: `Rp ${product.price.toLocaleString()}`,
              actual: priceMatches.join(', ')
            });
          }
        }
      });
    }
  }

  private extractMentionedProducts(text: string): string[] {
    const mentionedProducts: string[] = [];
    
    this.products.forEach(product => {
      const keywords = this.productKeywords.get(product.id) || [];
      const isProductMentioned = keywords.some(keyword => 
        text.includes(keyword.toLowerCase())
      );
      
      if (isProductMentioned) {
        mentionedProducts.push(product.id);
      }
    });
    
    return mentionedProducts;
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !['dan', 'atau', 'yang', 'untuk', 'dari', 'dengan', 'pada', 'adalah', 'akan', 'bisa', 'dapat'].includes(word));
  }

  private calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) return 0;
    
    const overlap = keywords1.filter(k => keywords2.includes(k)).length;
    return overlap / Math.max(keywords1.length, keywords2.length);
  }

  private getMostFrequentProduct(productIds: string[]): string {
    const frequency: Record<string, number> = {};
    
    productIds.forEach(id => {
      frequency[id] = (frequency[id] || 0) + 1;
    });
    
    return Object.keys(frequency).reduce((a, b) => 
      (frequency[a]! > frequency[b]!) ? a : b
    );
  }

  private getProductName(productId: string): string {
    const product = this.products.find(p => p.id === productId);
    return product?.name || 'Unknown Product';
  }

  private calculateConfidence(issues: ValidationIssue[]): number {
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

  private shouldEscalateIssues(issues: ValidationIssue[]): boolean {
    // Don't escalate for ordering queries unless there are critical conversation issues
    const hasConversationRestart = issues.some(issue => 
      issue.type === ValidationIssueType.CONVERSATION_RESTART && 
      issue.severity === 'critical'
    );
    
    // Always escalate for conversation restart issues
    if (hasConversationRestart) {
      return true;
    }
    
    // Escalate if multiple critical issues (be more conservative)
    const criticalCount = issues.filter(issue => issue.severity === 'critical').length;
    if (criticalCount >= 2) {
      return true;
    }
    
    // Escalate if multiple high severity issues
    const highSeverityCount = issues.filter(issue => issue.severity === 'high').length;
    if (highSeverityCount >= 3) { // Increased threshold from 2 to 3
      return true;
    }
    
    // Escalate for specific critical issue types only
    const criticalEscalationTypes = [
      ValidationIssueType.WRONG_PRODUCT,
      ValidationIssueType.CONVERSATION_RESTART
    ];
    
    return issues.some(issue => 
      criticalEscalationTypes.includes(issue.type) && 
      issue.severity === 'critical'
    );
  }

  public async refreshProductData(): Promise<void> {
    await this.initializeProductData();
  }
}

export const contextValidator = new ContextValidator();