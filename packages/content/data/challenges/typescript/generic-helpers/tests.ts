// Runtime behaviour is checked by `pnpm test`; the type assertions and the lines marked @ts-expect-error are
// checked by `pnpm typecheck`, which fails if a helper returns unknown or any instead of following its arguments.
import { describe, expect, expectTypeOf, it } from 'vitest';
import { first, groupBy, pluck } from './solution.ts';

interface Person {
  name: string;
  age: number;
  team: 'web' | 'data';
}

const people: Person[] = [
  { name: 'Asha', age: 27, team: 'web' },
  { name: 'Ben', age: 34, team: 'data' },
  { name: 'Chen', age: 31, team: 'web' },
];

describe('first', () => {
  it('returns the first item, or undefined for an empty array', () => {
    expect(first([3, 1, 2])).toBe(3);
    expect(first([])).toBeUndefined();
  });

  it('returns the element type, or undefined (checked by tsc)', () => {
    expectTypeOf(first([3, 1, 2])).toEqualTypeOf<number | undefined>();
    expectTypeOf(first(people)).toEqualTypeOf<Person | undefined>();
  });
});

describe('pluck', () => {
  it('picks one property from every item, in order', () => {
    expect(pluck(people, 'name')).toEqual(['Asha', 'Ben', 'Chen']);
    expect(pluck(people, 'age')).toEqual([27, 34, 31]);
  });

  it('returns that property’s type, and only accepts real property names (checked by tsc)', () => {
    expectTypeOf(pluck(people, 'age')).toEqualTypeOf<number[]>();
    expectTypeOf(pluck(people, 'team')).toEqualTypeOf<('web' | 'data')[]>();
    // @ts-expect-error: people have no email
    const emails = pluck(people, 'email');
    expect(emails).toEqual([undefined, undefined, undefined]);
  });
});

describe('groupBy', () => {
  it('groups items by key, keeping their order', () => {
    expect(groupBy(people, (person) => person.team)).toEqual({
      web: [people[0], people[2]],
      data: [people[1]],
    });
    expect(groupBy([1, 2, 3, 4], (n) => (n % 2 === 0 ? 'even' : 'odd'))).toEqual({ odd: [1, 3], even: [2, 4] });
    expect(groupBy([], (n: number) => n)).toEqual({});
  });

  it('keys the result by what keyOf returns, with arrays of the items (checked by tsc)', () => {
    expectTypeOf(groupBy(people, (person) => person.team)).toEqualTypeOf<Partial<Record<'web' | 'data', Person[]>>>();
  });
});
