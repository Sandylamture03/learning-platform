/** Formats a price in cents as dollars: 1999 -> "$19.99". */
export function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * One product in a catalogue grid. Prices are in cents.
 * @param {{ name: string, price: number, salePrice?: number, inStock: boolean, onAdd?: () => void }} props
 */
export function ProductCard({ name, price, salePrice, inStock, onAdd }) {
  // Work the condition out once, above the JSX, and give it a name.
  const onSale = salePrice !== undefined && salePrice < price;
  return (
    <article className="product-card">
      <h3>{name}</h3>
      {onSale && <span className="badge">Sale</span>}
      <p className="price">
        {onSale ? (
          <>
            {formatPrice(salePrice)} <s>{formatPrice(price)}</s>
          </>
        ) : (
          formatPrice(price)
        )}
      </p>
      {!inStock && <p className="stock">Out of stock</p>}
      <button type="button" disabled={!inStock} onClick={onAdd}>
        Add to cart
      </button>
    </article>
  );
}
