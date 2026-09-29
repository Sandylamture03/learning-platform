// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocalStorage } from './solution.js';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useLocalStorage', () => {
  it('returns the initial value when nothing is saved', () => {
    const { result } = renderHook(() => useLocalStorage('theme', 'light'));
    expect(result.current[0]).toBe('light');
  });

  it('reads the saved value on the first render', () => {
    localStorage.setItem('favourites', JSON.stringify(['Pune', 'Oslo']));
    const { result } = renderHook(() => useLocalStorage('favourites', []));
    expect(result.current[0]).toEqual(['Pune', 'Oslo']);
  });

  it('saves every change as JSON', () => {
    const { result } = renderHook(() => useLocalStorage('settings', { dense: false }));
    act(() => result.current[1]({ dense: true }));
    expect(result.current[0]).toEqual({ dense: true });
    expect(JSON.parse(localStorage.getItem('settings') ?? 'null')).toEqual({ dense: true });
  });

  it('takes an updater function, like useState', () => {
    const { result } = renderHook(() => useLocalStorage('count', 0));
    act(() => {
      result.current[1]((n) => n + 1);
      result.current[1]((n) => n + 1);
    });
    expect(result.current[0]).toBe(2);
    expect(localStorage.getItem('count')).toBe('2');
  });

  it('falls back to the initial value when what is saved is not JSON', () => {
    localStorage.setItem('theme', 'not json {');
    const { result } = renderHook(() => useLocalStorage('theme', 'light'));
    expect(result.current[0]).toBe('light');
  });

  it('reads localStorage once, not on every render', () => {
    const getItem = vi.spyOn(localStorage, 'getItem');
    const { result, rerender } = renderHook(() => useLocalStorage('theme', 'light'));
    rerender();
    act(() => result.current[1]('dark'));
    rerender();
    expect(getItem).toHaveBeenCalledTimes(1);
  });

  it('keeps separate values for separate keys', () => {
    const one = renderHook(() => useLocalStorage('a', 1));
    const two = renderHook(() => useLocalStorage('b', 1));
    act(() => one.result.current[1](5));
    expect(two.result.current[0]).toBe(1);
    expect(localStorage.getItem('b')).toBe('1');
  });
});
