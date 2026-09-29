// Runtime behaviour is checked by `pnpm test`; the lines marked @ts-expect-error are checked by `pnpm typecheck`,
// which fails if the types let any of them through.
import { describe, expect, expectTypeOf, it } from 'vitest';
import { addToCart, type Cart, cartTotal, type Product, unitPrice } from './solution.ts';

const keyboard: Product = { id: 'p1', name: 'Keyboard', priceCents: 4900 };
const mouse: Product = { id: 'p2', name: 'Mouse', priceCents: 2500, salePriceCents: 1900 };

describe('the shopping cart', () => {
  it('charges the sale price when there is one', () => {
    expect(unitPrice(keyboard)).toBe(4900);
    expect(unitPrice(mouse)).toBe(1900);
  });

  it('adds a new product as a line of one, and counts up a product already there', () => {
    const cart = addToCart(addToCart(addToCart([], keyboard), mouse), keyboard);
    expect(cart).toEqual([
      { product: keyboard, quantity: 2 },
      { product: mouse, quantity: 1 },
    ]);
  });

  it('never changes the cart it is given', () => {
    const cart: Cart = Object.freeze([Object.freeze({ product: keyboard, quantity: 1 })]);
    expect(() => addToCart(cart, keyboard)).not.toThrow();
    expect(() => addToCart(cart, mouse)).not.toThrow();
    expect(cart).toEqual([{ product: keyboard, quantity: 1 }]);
  });

  it('totals every line at its unit price', () => {
    const cart = addToCart(addToCart(addToCart([], keyboard), mouse), mouse);
    expect(cartTotal(cart)).toBe(4900 + 2 * 1900);
    expect(cartTotal([])).toBe(0);
  });

  it('only accepts complete products and a read-only cart (checked by tsc)', () => {
    // @ts-expect-error: a product needs a price
    const noPrice: Product = { id: 'p3', name: 'Cable' };
    // @ts-expect-error: prices are numbers of cents, not strings
    const textPrice: Product = { id: 'p4', name: 'Cable', priceCents: '9.00' };
    const cart: Cart = [];
    // @ts-expect-error: a read-only cart has no push
    cart.push({ product: keyboard, quantity: 1 });
    expectTypeOf(unitPrice).returns.toEqualTypeOf<number>();
    expectTypeOf(addToCart).returns.toEqualTypeOf<Cart>();
    expect([noPrice, textPrice]).toHaveLength(2);
  });
});
