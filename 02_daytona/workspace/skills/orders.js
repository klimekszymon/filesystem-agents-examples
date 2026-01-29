/**
 * Orders Skill
 * 
 * Provides order data and helper functions.
 * Links to products via productId field.
 * 
 * @exports orders - Array of order objects
 * @exports getOrdersByProduct - Filter orders by productId
 * @exports getOrdersByCustomer - Filter orders by customerId
 * @exports getOrdersByStatus - Filter orders by status
 */

export const orders = [
  { id: "o001", productId: "p001", customerId: "c001", quantity: 2, date: "2026-01-15", status: "delivered" },
  { id: "o002", productId: "p002", customerId: "c002", quantity: 1, date: "2026-01-16", status: "delivered" },
  { id: "o003", productId: "p005", customerId: "c001", quantity: 1, date: "2026-01-18", status: "shipped" },
  { id: "o004", productId: "p001", customerId: "c003", quantity: 1, date: "2026-01-20", status: "processing" },
  { id: "o005", productId: "p006", customerId: "c002", quantity: 3, date: "2026-01-21", status: "delivered" },
  { id: "o006", productId: "p004", customerId: "c004", quantity: 1, date: "2026-01-22", status: "shipped" },
  { id: "o007", productId: "p002", customerId: "c001", quantity: 2, date: "2026-01-23", status: "processing" },
  { id: "o008", productId: "p008", customerId: "c005", quantity: 1, date: "2026-01-24", status: "pending" },
  { id: "o009", productId: "p007", customerId: "c003", quantity: 5, date: "2026-01-25", status: "delivered" },
  { id: "o010", productId: "p001", customerId: "c002", quantity: 1, date: "2026-01-26", status: "pending" },
];

export const getOrdersByProduct = (productId) => orders.filter(o => o.productId === productId);
export const getOrdersByCustomer = (customerId) => orders.filter(o => o.customerId === customerId);
export const getOrdersByStatus = (status) => orders.filter(o => o.status === status);
