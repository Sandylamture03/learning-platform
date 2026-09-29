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
  // Your code here.
}
