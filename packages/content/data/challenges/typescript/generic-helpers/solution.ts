// Three helpers whose return types follow their arguments.

/** The first item, or undefined for an empty array. first([3, 1]) has the type number | undefined. */
export function first<T>(items: readonly T[]): T | undefined {
  return items[0];
}

/** Each item's value for `key`, in order. pluck(people, 'age') has the type number[]; a key that is not a property is an error. */
export function pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][] {
  return items.map((item) => item[key]);
}

/**
 * The items grouped by the key `keyOf` returns for each: groupBy(people, (p) => p.team).
 * Groups keep the items' order; keys with no items are left out, hence Partial.
 */
export function groupBy<T, K extends PropertyKey>(items: readonly T[], keyOf: (item: T) => K): Partial<Record<K, T[]>> {
  const groups: Partial<Record<K, T[]>> = {};
  for (const item of items) {
    const key = keyOf(item);
    const group = groups[key];
    if (group) group.push(item);
    else groups[key] = [item];
  }
  return groups;
}
