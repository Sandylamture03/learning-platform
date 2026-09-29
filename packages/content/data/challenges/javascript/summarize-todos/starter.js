/**
 * @typedef {{ userId: number, id: number, title: string, completed: boolean }} Todo
 * @typedef {{ userId: number, done: number, total: number, rate: number }} UserSummary
 */

/**
 * One summary per user: how many of their todos are done, how many they have, and the share done
 * (rounded to two decimals). Highest rate first; users with the same rate in userId order.
 * Must not change `todos` or the objects in it.
 *
 * @param {readonly Todo[]} todos
 * @returns {UserSummary[]}
 */
export function summarizeTodos(todos) {
  // Your code here.
}
