import { useEffect, useState } from 'react';

/** The saved value, or `fallback` when nothing is saved or what is saved is not JSON. */
function read(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved === null ? fallback : JSON.parse(saved);
  } catch {
    return fallback;
  }
}

/**
 * Like useState, but the value is saved in localStorage as JSON and read back after a reload.
 * @template T
 * @param {string} key
 * @param {T} initialValue
 * @returns {[T, (next: T | ((current: T) => T)) => void]}
 */
export function useLocalStorage(key, initialValue) {
  // A function passed to useState runs on the first render only, so storage is read once, not on every render.
  const [value, setValue] = useState(() => read(key, initialValue));

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  // useState's setter already takes a value or an updater function.
  return [value, setValue];
}
