## TypeScript follows your checks

A union like `string | number | null` is safe but awkward: you can only use what every member supports. **Narrowing** is how you get to one member. TypeScript reads your `if`s, `return`s and `switch`es, and inside each branch it knows the type is smaller:

```ts
function label(value: string | number | null): string {
  if (value === null) return 'none';
  // Here value is string | number: null returned above.
  if (typeof value === 'number') return value.toFixed(2); // number
  return value.toUpperCase(); // string, the only type left
}
```

Nothing new runs at runtime: these are ordinary JavaScript checks, and TypeScript simply follows them. That is also why early returns are so common in TypeScript: every `return` removes a member for the rest of the function.

## The checks that narrow

- **`typeof`** for primitives: `'string'`, `'number'`, `'boolean'`, `'bigint'`, `'function'`, `'undefined'` and `'object'`. Watch out: `typeof null` is `'object'`.
- **Equality:** `value === null`, and `value == null`, which matches both `null` and `undefined`.
- **Truthiness:** `if (user)` removes `null` and `undefined`, but also `0`, `''` and `false`, which may be real values. Prefer an explicit check when they are.
- **`instanceof`** for classes: `error instanceof Error`, `value instanceof Date`.
- **`in`** for object shapes: `'radius' in shape` tells a `Circle` from a `Rectangle`.
- **`Array.isArray(value)`** for arrays.

## Type guards for data you can't trust

Data from the network, `localStorage` or `JSON.parse` has no guarantees, so type it as `unknown` and check it. A **type guard** is a function returning `value is Type`, which narrows wherever it returns true:

```ts
interface User {
  id: number;
  name: string;
}

function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'number' &&
    'name' in value &&
    typeof value.name === 'string'
  );
}
```

The compiler trusts a type guard's answer, so it must actually check what it claims. For anything bigger than a few fields, a schema library such as Zod writes the checks for you. And TypeScript infers simple guards on its own: since version 5.5, `items.filter((item) => item !== null)` returns an array without `null` in its type.

## Exhaustiveness with never

`never` is the type with no values. When a `switch` has handled every member of a union, the variable in its `default` branch has the type `never`, and you can assert that:

```ts
type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'square':
      return shape.side ** 2;
    default: {
      const unhandled: never = shape;
      throw new Error(`Unknown shape: ${JSON.stringify(unhandled)}`);
    }
  }
}
```

Add `{ kind: 'triangle' }` to `Shape` later, and this function stops compiling until it handles triangles. That turns “we forgot a case” from a production bug into a compile error.

## Mistakes that cost time

- **Casting instead of checking.** `data as User` narrows nothing at runtime; if the API changes, the crash moves somewhere else.
- **`typeof value === 'object'`** and forgetting that `null` passes it.
- **Truthiness checks that drop real values** such as `0` or an empty string.
- **Type guards that lie,** returning `true` without checking every field they promise.

## Say it in an interview

“Narrowing is TypeScript following my runtime checks: after `typeof`, `instanceof`, `in`, an equality check or an early return, it knows which member of a union I have. For untrusted data I start from `unknown` and write a type guard that returns `value is Type`, or use a schema library like Zod. And I use `never` in a `switch` default so the compiler tells me when a new case appears that I don't handle.”
