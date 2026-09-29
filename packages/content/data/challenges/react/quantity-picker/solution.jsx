import { useState } from 'react';

/**
 * A − / + control for how many of something to buy.
 * @param {{ min?: number, max?: number, initial?: number, onChange?: (quantity: number) => void }} props
 */
export function QuantityPicker({ min = 1, max = 10, initial = min, onChange }) {
  const [quantity, setQuantity] = useState(initial);

  function change(by) {
    const next = Math.min(max, Math.max(min, quantity + by));
    setQuantity(next);
    // Tell the parent here, in the event handler, where the change happens.
    onChange?.(next);
  }

  return (
    <fieldset>
      <legend>Quantity</legend>
      <button type="button" aria-label="Decrease" disabled={quantity <= min} onClick={() => change(-1)}>
        −
      </button>
      <output>{quantity}</output>
      <button type="button" aria-label="Increase" disabled={quantity >= max} onClick={() => change(1)}>
        +
      </button>
    </fieldset>
  );
}
