/** Resolves in a new task, after rendering, input and other timers have had a turn. */
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Calls handle(item) for every item, in order, at most `chunkSize` items per task. The first chunk runs
 * straight away; before each later chunk, wait for a new task (setTimeout with 0 ms), so the browser can
 * render and handle input in between. Resolves with handle's return values, in order.
 *
 * @template T, R
 * @param {readonly T[]} items
 * @param {(item: T) => R} handle
 * @param {number} chunkSize
 * @returns {Promise<R[]>}
 */
export async function processInChunks(items, handle, chunkSize) {
  const results = [];
  for (let start = 0; start < items.length; start += chunkSize) {
    // Awaiting a microtask (await null) would not help: microtasks run before the browser gets a turn.
    if (start > 0) await nextTask();
    for (const item of items.slice(start, start + chunkSize)) {
      results.push(handle(item));
    }
  }
  return results;
}
