// Describe the data first, then write the three functions. All prices are in cents.

/** A product from the catalogue. */
export interface Product {
  id: string;
  name: string;
  priceCents: number;
  salePriceCents?: number;
}

/** One line of the cart: a product and how many of it. */
export interface CartLine {
  product: Product;
  quantity: number;
}

/** The cart. Read-only, so no code can push to it or sort it in place. */
export type Cart = readonly CartLine[];

/** What one unit costs: the sale price when there is one, otherwise the price. */
export function unitPrice(product: Product): number {
  return product.salePriceCents ?? product.priceCents;
}

/** A new cart with one more of `product`: a new line with quantity 1, or one more on its existing line. */
export function addToCart(cart: Cart, product: Product): Cart {
  const existing = cart.find((line) => line.product.id === product.id);
  if (!existing) return [...cart, { product, quantity: 1 }];
  return cart.map((line) => (line === existing ? { ...line, quantity: line.quantity + 1 } : line));
}

/** What the whole cart costs. */
export function cartTotal(cart: Cart): number {
  return cart.reduce((sum, line) => sum + unitPrice(line.product) * line.quantity, 0);
}
