import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './solution.js';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits for the pause before calling fn', () => {
    const fn = vi.fn();
    const search = debounce(fn, 300);
    search('r');
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('restarts the wait on every call and uses the last arguments', () => {
    const fn = vi.fn();
    const search = debounce(fn, 300);
    search('r');
    vi.advanceTimersByTime(200);
    search('re');
    vi.advanceTimersByTime(200);
    search('rea');
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('rea');
  });

  it('passes every argument through', () => {
    const fn = vi.fn();
    debounce(fn, 100)('a', 2, { three: 3 });
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('a', 2, { three: 3 });
  });

  it('runs again after a later pause', () => {
    const fn = vi.fn();
    const save = debounce(fn, 100);
    save(1);
    vi.advanceTimersByTime(100);
    save(2);
    vi.advanceTimersByTime(100);
    expect(fn.mock.calls).toEqual([[1], [2]]);
  });

  it('gives each debounced function its own timer', () => {
    const first = vi.fn();
    const second = vi.fn();
    const a = debounce(first, 100);
    const b = debounce(second, 100);
    a();
    vi.advanceTimersByTime(50);
    b();
    vi.advanceTimersByTime(50);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
