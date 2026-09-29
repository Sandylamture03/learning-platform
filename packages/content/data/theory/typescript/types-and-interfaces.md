## Why types

JavaScript finds out that `user.adress` is `undefined` when the code runs, maybe in front of a user. TypeScript describes the shape of your data, and the compiler and your editor check every use against it while you type: a misspelt property, a missing argument or a string where a number belongs is an error before the code ever runs. The types also document the code, and editor autocompletion comes from them. They disappear at runtime: TypeScript compiles to plain JavaScript, and Node.js can even run `.ts` files by stripping the types out.

## Annotations and inference

You add a type with a colon, but you don't need one everywhere, because TypeScript *infers* types from values:

```ts
let count = 0; // inferred as number
count = 'ten'; // Error: Type 'string' is not assignable to type 'number'.

function total(prices: number[], discount = 0): number {
  return prices.reduce((sum, price) => sum + price, 0) - discount;
}
```

- **Annotate function parameters.** TypeScript can't guess them (a default value like `discount = 0` counts).
- **Annotate what you export,** such as a function's return type, so a change inside it can't silently change its promise to callers.
- **Let inference do the rest:** `const name = 'Asha'` needs no `: string`.

## The everyday types

- **`string`, `number`, `boolean`** for the primitives, and **`bigint`** if you ever need it.
- **Arrays:** `string[]`, or `Array<string>`, which means the same.
- **`null` and `undefined`:** with `strict` on (always turn it on), they are not part of other types, so a value that may be missing says so: `User | null`.
- **`unknown`** for a value you haven't checked yet, such as parsed JSON. You must narrow it before using it.
- **`any`** switches checking off. Treat it as a bug to fix, not a type.

## Object types

Most of your types describe objects, with a `type` alias or an `interface`:

```ts
interface User {
  readonly id: number;
  name: string;
  email: string;
  avatarUrl?: string; // optional: may be missing
  tags: string[];
}
```

- **`?` marks a property as optional.** Its type becomes `string | undefined`, and TypeScript makes you handle the missing case.
- **`readonly`** stops reassignment, which suits ids and anything that should never change after creation.
- **Nest them** (`address: Address`), and use `Record<string, number>` for an object used as a dictionary.

TypeScript compares *shapes*, not names: any object with the right properties is a `User`, wherever it came from. One extra rule catches typos: an object literal with properties the type doesn't have is an error.

## type or interface?

For object shapes, both work, and the difference rarely matters:

- **`interface`** can only describe objects, and extends others with `extends`.
- **`type`** can name anything: a union (`type Id = string | number`), a function type, a tuple. It combines object types with `&`.

A common convention is `interface` for object shapes and `type` for everything else; another is `type` everywhere. Pick one per codebase and move on.

## Mistakes that cost time

- **Reaching for `any`** when the type is hard. Use `unknown` and narrow it, or find the real type.
- **Annotating everything,** including values inference already knows, so the code is noisy and the annotations drift.
- **Silencing an error with `as`.** `data as User` tells the compiler to trust you; it checks nothing at runtime.
- **Leaving `strict` off,** which lets `null` slip into every type.

## Say it in an interview

“TypeScript adds static types to JavaScript, so mistakes like a misspelt property or a missing argument show up in the editor instead of at runtime. I annotate parameters and exported functions and let inference handle the rest. I describe objects with `interface` or `type`, using `?` for optional and `readonly` for fixed properties, and I keep `strict` on and avoid `any`: unknown data starts as `unknown` and gets checked.”
