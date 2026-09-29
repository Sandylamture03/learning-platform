## Union types: this or that

A union type says a value is one of several types: `string | number`, `User | null`. It fits the many places where JavaScript already accepts more than one kind of value:

```ts
function formatId(id: string | number): string {
  return typeof id === 'number' ? id.toString().padStart(6, '0') : id;
}
```

Until you check which member you have, TypeScript only lets you do what is safe for *every* member. That checking is called narrowing, and [the narrowing lesson](lesson:narrowing) covers it in full.

## Literal types: one exact value

A literal type is a single value used as a type: `'loading'`, `404`, `true`. On its own that is rarely useful; in a union, it lists exactly what is allowed:

```ts
type Variant = 'primary' | 'secondary' | 'ghost';
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
```

This replaces “magic strings”. A button that takes `variant: Variant` shows the three options in autocomplete, and `variant="primery"` is a compile error instead of an unstyled button in production.

Inference follows `const` and `let`: `const status = 'idle'` has the type `'idle'`, because it can never change, while `let status = 'idle'` widens to `string`, because it might. Annotate the variable, `let status: Status = 'idle'`, to keep it narrow.

## as const: derive the type from the data

You often need the allowed values at runtime too, to fill a `<select>` or check input. Write them once, as data, and derive the type:

```ts
const SIZES = ['sm', 'md', 'lg'] as const;
type Size = (typeof SIZES)[number]; // 'sm' | 'md' | 'lg'
```

`as const` makes the array read-only and keeps each element as its literal type, and `(typeof SIZES)[number]` means “the type of any element”. Add `'xl'` to the array and the type follows. It works for objects too: `const ROUTES = { home: '/', cart: '/cart' } as const`.

TypeScript's `enum` does a similar job, but it is not plain JavaScript with types on top: it generates code. Setups that run TypeScript by stripping types, such as Node.js and this repo (`erasableSyntaxOnly`), don't allow it. Use a union of literals instead.

## null and undefined are members too

With `strict` on, “maybe missing” is part of the type: `User | null` for “nobody signed in yet”, and an optional property `avatarUrl?: string` for “this field may be absent”. TypeScript then makes you handle the missing case before you use the value, with a check, optional chaining (`user?.name`) or a default (`user?.name ?? 'Guest'`). A large share of production crashes in JavaScript are exactly this bug.

## Mistakes that cost time

- **`string` where a union belongs,** such as `status: string`, which accepts every typo.
- **Writing the values twice,** once in an array and once in a type, so they drift. Derive the type with `as const`.
- **Forgetting `| null`** for data that has not loaded yet, then fighting the checker with `!` everywhere.
- **`let` widening** a literal to `string`, then passing it where the union is expected.

## Say it in an interview

“A union type means a value can be one of several types, like `string | number` or `User | null`, and TypeScript makes me narrow it before using anything that isn't common to all of them. Literal types turn a union into a list of allowed values, like `'idle' | 'loading' | 'error'`, which replaces magic strings and catches typos at compile time. When I need the values at runtime too, I keep them in an array `as const` and derive the type from it, and I use unions of literals instead of `enum`.”
