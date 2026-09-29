import { afterEach, describe, expect, it, vi } from 'vitest';
import { debounce, h, safeHref } from '../src/dom.js';

describe('h', () => {
  it('builds elements with attributes and text', () => {
    const link = h('a', { href: 'https://react.dev', hidden: false, 'data-x': 1 }, 'React ', h('strong', {}, 'docs'));
    expect(link.outerHTML).toBe('<a href="https://react.dev" data-x="1">React <strong>docs</strong></a>');
    expect(h('input', { disabled: true }).hasAttribute('disabled')).toBe(true);
  });

  it('puts strings in as text, never as markup', () => {
    const p = h('p', {}, '<img src=x onerror=alert(1)>');
    expect(p.children).toHaveLength(0);
    expect(p.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('skips empty children and flattens lists', () => {
    expect(h('p', {}, [null, 'a', false], ['b'], undefined, 3).textContent).toBe('ab3');
  });
});

describe('debounce', () => {
  afterEach(() => vi.useRealTimers());

  it('calls once, after the calls stop', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced();
    vi.advanceTimersByTime(60);
    debounced();
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('can run a waiting call now, or drop it', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced.flush(); // nothing waiting: nothing to run
    expect(fn).not.toHaveBeenCalled();
    debounced();
    debounced.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('safeHref', () => {
  it('allows https links only', () => {
    expect(safeHref('https://react.dev/learn')).toBe('https://react.dev/learn');
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('http://example.com')).toBeUndefined();
    expect(safeHref('not a url')).toBeUndefined();
  });
});
