// Three helpers whose return types follow their arguments. Replace each `unknown` with type parameters.

/** The first item, or undefined for an empty array. first([3, 1]) has the type number | undefined. */
export function first(items: readonly unknown[]): unknown {
  throw new Error('Write first');
}

/** Each item's value for `key`, in order. pluck(people, 'age') has the type number[]; a key that is not a property is an error. */
export function pluck(items: readonly unknown[], key: string): unknown[] {
  throw new Error('Write pluck');
}

/**
 * The items grouped by the key `keyOf` returns for each: groupBy(people, (p) => p.team).
 * Groups keep the items' order; keys with no items are left out.
 */
export function groupBy(items: readonly unknown[], keyOf: (item: unknown) => PropertyKey): unknown {
  throw new Error('Write groupBy');
}
