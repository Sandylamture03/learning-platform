## The problem generics solve

Say you write `first(items)`, which returns the first element of an array. What is its return type? For `number[]` it should be `number`; for `User[]`, `User`. With `any[]` you lose the type at the first call:

```ts
function first(items: any[]): any {
  return items[0];
}
const user = first(users); // any: no checks, no autocomplete
```

A **generic** function takes a type parameter as well as values, and links them:

```ts
function first<T>(items: readonly T[]): T | undefined {
  return items[0];
}
const user = first(users); // User | undefined
```

`T` is a placeholder filled in at each call. You rarely write it yourself: TypeScript infers it from the arguments.

## Reading generics

You will read far more generics than you write, because every library uses them:

- **`Array<User>`** is the same as `User[]`.
- **`Promise<Response>`:** a promise that resolves to a `Response`. An async function returning `User` has the type `Promise<User>`.
- **`Record<string, number>`:** an object whose keys are strings and whose values are numbers.
- **`useState<User | null>(null)`:** here you pass the type yourself, because the starting value `null` is all TypeScript could infer. Without it, `setUser(user)` is an error.
- **`Map<string, User[]>`, `Set<string>`, `Partial<User>`, `Pick<User, 'id' | 'name'>`:** read the angle brackets as “of”: a map of strings to user arrays.

## Writing generic functions

Add a type parameter when a function's output type depends on its input type, and use it to connect them. Several parameters are fine: `function pair<A, B>(a: A, b: B): [A, B]`. A good sign you need a generic is an `any` in a signature; a sign you don't is a type parameter used only once, which connects nothing.

## Constraints

A plain `T` could be anything, so you can't read properties from it. **`extends`** constrains it: `T extends { id: string }` accepts any object with a string `id`, and lets you use `item.id`.

**`keyof T`** is the union of `T`'s property names, which lets a function accept only keys that exist:

```ts
function pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][] {
  return items.map((item) => item[key]);
}

const names = pluck(users, 'name'); // string[]
pluck(users, 'nmae'); // Error: Argument of type '"nmae"' is not assignable to parameter of type 'keyof User'.
```

`T[K]` is an *indexed access type*: the type of property `K` on `T`, so `pluck` returns `string[]` for names and `number[]` for ids.

## Generic types

Types take parameters too, which is how you describe a shape that wraps another:

```ts
interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
}

async function getPage<T>(url: string): Promise<Page<T>> {
  const response = await fetch(url);
  return response.json();
}
```

Note what that does not do: `response.json()` returns `any`, and nothing checks the data really is a `Page<T>`. Types at the edge of your app are promises you make; checking them at runtime is what the narrowing and Zod lessons are for.

## Mistakes that cost time

- **`any` where a type parameter belongs,** losing the connection between input and output.
- **Type parameters used once,** adding angle brackets that buy nothing.
- **Passing type arguments inference already knows,** like `first<number>([1, 2])`.
- **Trusting a generic cast at the network edge,** as if `getPage<User>` checked the data.

## Say it in an interview

“Generics are type parameters: they let one function or type work with many types while keeping them connected, so `first` of a `User[]` returns a `User`, not `any`. TypeScript usually infers them from the arguments, and I pass them explicitly when it can't, as in `useState<User | null>(null)`. I constrain them with `extends` when I need properties, and use `keyof` so a function only accepts real property names.”
