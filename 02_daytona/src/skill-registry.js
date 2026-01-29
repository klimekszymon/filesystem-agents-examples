/**
 * Skill Registry - TypeScript signatures for progressive disclosure.
 * The model sees clean type definitions, not implementation details.
 */

const skills = {
  products: {
    description: 'Product catalog with pricing and inventory data',
    typescript: `interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
}

declare const products: Product[];
declare function getProductById(id: string): Product | undefined;
declare function getProductsByCategory(category: string): Product[];
declare function getInStockProducts(): Product[];`
  },

  orders: {
    description: 'Order data linked to products via productId',
    typescript: `interface Order {
  id: string;
  productId: string;
  customerId: string;
  quantity: number;
  date: string;
  status: string;
}

declare const orders: Order[];
declare function getOrdersByProduct(productId: string): Order[];
declare function getOrdersByCustomer(customerId: string): Order[];
declare function getOrdersByStatus(status: string): Order[];`
  }
};

export function listSkills() {
  return Object.entries(skills).map(([name, { description }]) => ({ name, description }));
}

export function getSkillSchema(name) {
  const skill = skills[name];
  if (!skill) return null;
  
  return {
    name,
    description: skill.description,
    typescript: skill.typescript,
    importPath: `./skills/${name}.js`
  };
}
