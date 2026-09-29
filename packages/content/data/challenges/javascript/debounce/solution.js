/**
 * Returns a debounced copy of fn. Every call restarts the wait; fn runs once `ms` milliseconds
 * pass without another call, with the arguments of the last call.
 *
 * @param {(...args: any[]) => void} fn
 * @param {number} ms
 * @returns {(...args: any[]) => void}
 */
export function debounce(fn, ms) {
  // The timer id lives here, in debounce's scope, so every call of the returned function shares it.
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
