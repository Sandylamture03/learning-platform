// @vitest-environment happy-dom
import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuantityPicker } from './solution.jsx';

afterEach(cleanup);

const value = (container) => container.querySelector('output')?.textContent;
const button = (name) => screen.getByRole('button', { name });

describe('QuantityPicker', () => {
  it('starts at min, or at initial when it is given', () => {
    const { container, unmount } = render(<QuantityPicker min={2} />);
    expect(value(container)).toBe('2');
    unmount();
    const second = render(<QuantityPicker initial={4} />);
    expect(value(second.container)).toBe('4');
  });

  it('goes up and down by one', async () => {
    const { container } = render(<QuantityPicker />);
    await userEvent.click(button('Increase'));
    await userEvent.click(button('Increase'));
    expect(value(container)).toBe('3');
    await userEvent.click(button('Decrease'));
    expect(value(container)).toBe('2');
  });

  it('disables each button at its limit, and never goes past it', async () => {
    const { container } = render(<QuantityPicker min={1} max={2} />);
    expect(button('Decrease').disabled).toBe(true);
    await userEvent.click(button('Increase'));
    expect(value(container)).toBe('2');
    expect(button('Increase').disabled).toBe(true);
    expect(button('Decrease').disabled).toBe(false);
  });

  it('calls onChange with each new quantity', async () => {
    const onChange = vi.fn();
    render(<QuantityPicker onChange={onChange} />);
    await userEvent.click(button('Increase'));
    await userEvent.click(button('Increase'));
    await userEvent.click(button('Decrease'));
    expect(onChange.mock.calls).toEqual([[2], [3], [2]]);
  });

  it('gives each picker its own quantity', async () => {
    render(
      <>
        <section aria-label="Tea">
          <QuantityPicker />
        </section>
        <section aria-label="Cake">
          <QuantityPicker />
        </section>
      </>,
    );
    const tea = screen.getByRole('region', { name: 'Tea' });
    const cake = screen.getByRole('region', { name: 'Cake' });
    await userEvent.click(within(tea).getByRole('button', { name: 'Increase' }));
    expect(tea.querySelector('output')?.textContent).toBe('2');
    expect(cake.querySelector('output')?.textContent).toBe('1');
  });
});
