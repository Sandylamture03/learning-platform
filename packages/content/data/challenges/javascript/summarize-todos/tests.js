import { describe, expect, it } from 'vitest';
import { summarizeTodos } from './solution.js';

/** A few todos in the shape of https://jsonplaceholder.typicode.com/todos */
const todos = [
  { userId: 1, id: 1, title: 'delectus aut autem', completed: false },
  { userId: 1, id: 2, title: 'quis ut nam facilis', completed: true },
  { userId: 1, id: 3, title: 'fugiat veniam minus', completed: true },
  { userId: 2, id: 4, title: 'et porro tempora', completed: true },
  { userId: 2, id: 5, title: 'laboriosam mollitia', completed: true },
  { userId: 3, id: 6, title: 'qui ullam ratione', completed: false },
  { userId: 3, id: 7, title: 'illo expedita consequatur', completed: false },
  { userId: 4, id: 8, title: 'quo adipisci enim', completed: true },
];

/** Freezes an array and every object in it, so any change throws a TypeError. */
function frozen(items) {
  return Object.freeze(items.map((item) => Object.freeze({ ...item })));
}

describe('summarizeTodos', () => {
  it('counts done and total todos for each user, highest rate first', () => {
    expect(summarizeTodos(todos)).toEqual([
      { userId: 2, done: 2, total: 2, rate: 1 },
      { userId: 4, done: 1, total: 1, rate: 1 },
      { userId: 1, done: 2, total: 3, rate: 0.67 },
      { userId: 3, done: 0, total: 2, rate: 0 },
    ]);
  });

  it('keeps userId a number', () => {
    for (const summary of summarizeTodos(todos)) expect(typeof summary.userId).toBe('number');
  });

  it('puts users with the same rate in userId order', () => {
    const tied = [
      { userId: 9, id: 1, title: 'a', completed: true },
      { userId: 3, id: 2, title: 'b', completed: true },
      { userId: 5, id: 3, title: 'c', completed: true },
    ];
    expect(summarizeTodos(tied).map((s) => s.userId)).toEqual([3, 5, 9]);
  });

  it('returns an empty array when there are no todos', () => {
    expect(summarizeTodos([])).toEqual([]);
  });

  it('does not change the array or the todos in it', () => {
    const input = frozen(todos);
    expect(() => summarizeTodos(input)).not.toThrow();
    expect(input).toEqual(todos);
  });
});
