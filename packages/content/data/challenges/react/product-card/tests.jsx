// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductCard } from './solution.jsx';

afterEach(cleanup);

describe('ProductCard', () => {
  it('shows the name as a heading and the price in dollars', () => {
    render(<ProductCard name="Keyboard" price={4900} inStock />);
    expect(screen.getByRole('heading', { name: 'Keyboard' })).toBeTruthy();
    expect(screen.getByText('$49.00')).toBeTruthy();
    expect(screen.queryByText('Sale')).toBeNull();
  });

  it('shows a sale badge, the sale price and the old price struck through when it is on sale', () => {
    const { container } = render(<ProductCard name="Mouse" price={2500} salePrice={1900} inStock />);
    expect(screen.getByText('Sale')).toBeTruthy();
    expect(screen.getByText('$19.00', { exact: false })).toBeTruthy();
    expect(container.querySelector('s')?.textContent).toBe('$25.00');
  });

  it('shows no sale when the sale price is not lower than the price', () => {
    render(<ProductCard name="Mouse" price={2500} salePrice={2500} inStock />);
    expect(screen.queryByText('Sale')).toBeNull();
  });

  it('says out of stock and disables the button when inStock is false', () => {
    render(<ProductCard name="Cable" price={900} inStock={false} />);
    expect(screen.getByText('Out of stock')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add to cart' }).disabled).toBe(true);
  });

  it('calls onAdd when the button is clicked', async () => {
    const onAdd = vi.fn();
    render(<ProductCard name="Cable" price={900} inStock onAdd={onAdd} />);
    expect(screen.queryByText('Out of stock')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
