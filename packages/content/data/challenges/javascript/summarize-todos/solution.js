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
  // A Map keeps userId a number; the keys of a plain object would turn it into a string.
  const counts = new Map();
  for (const { userId, completed } of todos) {
    const count = counts.get(userId) ?? { done: 0, total: 0 };
    counts.set(userId, { done: count.done + (completed ? 1 : 0), total: count.total + 1 });
  }

  return [...counts]
    .map(([userId, { done, total }]) => ({ userId, done, total, rate: Math.round((done / total) * 100) / 100 }))
    .toSorted((a, b) => b.rate - a.rate || a.userId - b.userId);
}
