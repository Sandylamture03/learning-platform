/** Formats a price in cents as dollars: 1999 -> "$19.99". */
export function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * One product in a catalogue grid. Prices are in cents.
 * @param {{ name: string, price: number, salePrice?: number, inStock: boolean, onAdd?: () => void }} props
 */
export function ProductCard({ name, price, salePrice, inStock, onAdd }) {
  // Your code here: return the card's JSX.
  return null;
}
