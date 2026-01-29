/**
 * Products Skill
 * 
 * Provides product catalog data and helper functions.
 * 
 * @exports products - Array of product objects
 * @exports getProductById - Find product by ID
 * @exports getProductsByCategory - Filter products by category
 * @exports getInStockProducts - Get products with stock > 0
 */

export const products = [
  { id: "p001", name: "Mechanical Keyboard", price: 149.99, category: "electronics", stock: 23 },
  { id: "p002", name: "Wireless Mouse", price: 59.99, category: "electronics", stock: 45 },
  { id: "p003", name: "USB-C Hub", price: 39.99, category: "electronics", stock: 0 },
  { id: "p004", name: "Standing Desk Mat", price: 79.99, category: "office", stock: 12 },
  { id: "p005", name: "Ergonomic Chair", price: 399.99, category: "office", stock: 8 },
  { id: "p006", name: "Monitor Light Bar", price: 89.99, category: "electronics", stock: 34 },
  { id: "p007", name: "Notebook Set", price: 24.99, category: "office", stock: 67 },
  { id: "p008", name: "Webcam HD", price: 119.99, category: "electronics", stock: 15 },
];

export const getProductById = (id) => products.find(p => p.id === id);
export const getProductsByCategory = (category) => products.filter(p => p.category === category);
export const getInStockProducts = () => products.filter(p => p.stock > 0);
