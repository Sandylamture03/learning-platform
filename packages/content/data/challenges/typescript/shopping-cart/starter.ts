// Describe the data first, then write the three functions. All prices are in cents.

/** A product from the catalogue. */
export interface Product {
  id: string;
  name: string;
  // Add the price, and the optional sale price.
}

/** One line of the cart: a product and how many of it. */
export interface CartLine {
  product: Product;
  // Add the quantity.
}

/** The cart. Make it read-only, so no code can push to it or sort it in place. */
export type Cart = CartLine[];

/** What one unit costs: the sale price when there is one, otherwise the price. */
export function unitPrice(product: Product): number {
  throw new Error('Write unitPrice');
}

/** A new cart with one more of `product`: a new line with quantity 1, or one more on its existing line. */
export function addToCart(cart: Cart, product: Product): Cart {
  throw new Error('Write addToCart');
}

/** What the whole cart costs. */
export function cartTotal(cart: Cart): number {
  throw new Error('Write cartTotal');
}
