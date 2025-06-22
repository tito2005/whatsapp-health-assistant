export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  discountPrice?: number;
  category: ProductCategory;
  benefits: string[];
  ingredients: string[];
  suitableFor: string[];
  dosage: string;
  warnings?: string[];
  images: string[];
  inStock: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductCategory = 
  | 'digestive_health'
  | 'cardiovascular'
  | 'diabetes_support'
  | 'weight_management'
  | 'immunity'
  | 'general_wellness';

export interface ProductRecommendation {
  product: Product;
  relevanceScore: number;
  reason: string;
  benefits: string[];
}
