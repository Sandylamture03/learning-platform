// @ts-check
// Small helpers shared by the widgets.

/** @typedef {Node | string | number | false | null | undefined} Child */

/**
 * Creates an element: h('a', { href: url }, title).
 * Strings always become text nodes, so text from JSON or from the learner can never turn into markup.
 * An attribute set to true is written empty (`disabled`); false and undefined leave it out.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, string | number | boolean | undefined>} [attrs]
 * @param {...(Child | readonly Child[])} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    el.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'number' ? String(child) : child);
  }
  return el;
}

/**
 * Waits until `ms` have passed without another call, then calls `fn` once.
 * `flush()` runs a waiting call now; `cancel()` drops it (call it when the widget disconnects).
 * @param {() => void} fn
 * @param {number} ms
 */
export function debounce(fn, ms) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;

  const debounced = () => {
    clearTimeout(timer);
    timer = setTimeout(flush, ms);
  };
  function flush() {
    if (timer === undefined) return;
    cancel();
    fn();
  }
  function cancel() {
    clearTimeout(timer);
    timer = undefined;
  }
  return Object.assign(debounced, { flush, cancel });
}

/**
 * Links only go to https:// pages. The build already checks every URL; this keeps a bad one from ever
 * becoming a javascript: link if the data comes from somewhere else later.
 * @param {string} url
 * @returns {string | undefined}
 */
export function safeHref(url) {
  try {
    return new URL(url).protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}
