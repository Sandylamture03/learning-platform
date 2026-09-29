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
  const listener = (event) => {
    // closest() starts at the element the event came from, so a click on an icon inside a button still finds it.
    const match = event.target.closest(selector);
    // closest() can walk past root to an ancestor that also matches; only elements inside root count.
    if (match && root.contains(match)) handler(event, match);
  };
  root.addEventListener(type, listener);
  // The same function object that was added, so removeEventListener can find it.
  return () => root.removeEventListener(type, listener);
}
