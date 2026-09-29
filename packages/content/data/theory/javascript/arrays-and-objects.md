## Five moves cover most of the job

An API sends an array of objects; the screen needs something else. Most of the time the reshaping is one of five moves:

- **Change every item:** `map` returns a new array of the same length.
- **Keep some items:** `filter` returns a new array with the items that pass a test.
- **Find one item:** `find` returns the first match, or `undefined`.
- **Ask a yes-or-no question:** `some` (does any item pass?), `every` (do all pass?), `includes` (is this exact value there?).
- **Boil the list down to one value:** `reduce` builds a total, an object keyed by id, or a count per group.

```js
const todos = [
  { id: 1, userId: 1, title: 'Write tests', completed: true },
  { id: 2, userId: 1, title: 'Fix login bug', completed: false },
  { id: 3, userId: 2, title: 'Review PR', completed: true },
];

const openTitles = todos
  .filter((todo) => !todo.completed)
  .map((todo) => todo.title); // ['Fix login bug']
const firstDone = todos.find((todo) => todo.completed); // the 'Write tests' todo
const allDone = todos.every((todo) => todo.completed); // false
```

A chain reads top to bottom like a recipe. Each step returns a new array, so `todos` itself never changes.

## reduce without the fear

`reduce` walks the array and carries one value along, the accumulator. Your function gets the accumulator and the current item, and returns the next accumulator. Always pass the starting value as the second argument:

```js
const orders = [{ amount: 10 }, { amount: 25 }, { amount: 5 }];
const total = orders.reduce((sum, order) => sum + order.amount, 0); // 40
```

Leave out the `0` and the first order *object* becomes the starting sum. Adding a number to an object makes a string, and the total comes out as `'[object Object]255'`.

The accumulator can be an object too. Changing it inside `reduce` is fine, because it is a new object that only `reduce` can see:

```js
const countByUser = todos.reduce((counts, todo) => {
  counts[todo.userId] = (counts[todo.userId] ?? 0) + 1;
  return counts;
}, {}); // { 1: 2, 2: 1 }
```

If a `for...of` loop or `Object.groupBy` says it more clearly, use that. `reduce` is a tool, not a test of skill.

## Destructuring, ?. and ??

Destructuring pulls values out of an object by name, or out of an array by position:

```js
const post = { title: 'Closures', author: { name: 'Sam' } };
const { title, tags = [], author: { name } } = post;
// title is 'Closures', tags is [], name is 'Sam'

const [first, second] = ['gold', 'silver', 'bronze']; // 'gold', 'silver'
```

- A default such as `tags = []` applies only when the value is `undefined`, not when it is `null` or `0`.
- Destructure in the parameter list to pick out options: `function avatar({ name, size = 40 }) { … }`. React components read their props exactly this way.
- `user?.address?.city` gives `undefined` if anything along the way is `null` or `undefined`, instead of throwing.
- `count ?? 10` falls back only on `null` or `undefined`. `count || 10` also replaces `0` and `''`, which is usually a bug.
- `Object.entries(prices)` turns an object into `[key, value]` pairs, so you can use array methods on it; `Object.fromEntries` turns pairs back into an object.

## Copy, don't change

Some array methods change the array they are called on: `push`, `pop`, `shift`, `unshift`, `splice`, `sort` and `reverse`. Others return a new array and leave the original alone: `map`, `filter`, `slice`, `concat`, and the newer `toSorted`, `toReversed`, `toSpliced` and `with`.

Why care? A variable holds a *reference* to an array or object, not a copy of it, so other code may be holding the same one. And React decides whether to re-render by comparing references: change an array in place and React sees the same array, so it may skip the update.

Spread makes the copies:

```js
const user = { name: 'Asha', role: 'dev' };
const promoted = { ...user, role: 'lead' }; // later properties win

const items = ['b', 'a'];
const added = [...items, 'c']; // ['b', 'a', 'c']
const sorted = items.toSorted(); // ['a', 'b']; items is still ['b', 'a']
```

Spread is shallow: nested objects are shared, not copied. To change something nested, spread every level on the way down: `{ ...user, address: { ...user.address, city: 'Pune' } }`.

`JSON.stringify` turns data into a string to send or store, and `JSON.parse` turns it back. Functions and `undefined` values are dropped on the way, and dates come back as strings.

## Mistakes that cost time

- **`reduce` without a starting value.** It works until the first item isn't the kind of value you're adding up.
- **`sort()` on props or state.** It changes the original. Use `toSorted()`.
- **Sorting numbers with no compare function.** They are compared as strings, so `[10, 9, 1].toSorted()` gives `[1, 10, 9]`. Use `(a, b) => a - b`.
- **`map` just to loop.** If you don't use the new array, you wanted `for...of`.
- **`||` for defaults when `0` or `''` is a real value.** Use `??`.

## Say it in an interview

“`map`, `filter` and `reduce` each return something new instead of changing the array: `map` transforms every item, `filter` keeps the items that pass a test, and `reduce` folds the array into one value, such as a total or a lookup object. On shared data I avoid methods that mutate, like `sort` and `splice`, and use spread or `toSorted` instead, because React compares references to decide what to re-render.”
