/**
 * Handles `type` events on every element inside `root` that matches `selector`, including elements
 * added later, with a single listener on root. Calls handler(event, matchedElement).
 * Returns a function that removes the listener.
 *
 * @param {Element} root
 * @param {string} type
 * @param {string} selector
 * @param {(event: Event, match: Element) => void} handler
 * @returns {() => void}
 */
export function delegate(root, type, selector, handler) {
  // Your code here.
}
