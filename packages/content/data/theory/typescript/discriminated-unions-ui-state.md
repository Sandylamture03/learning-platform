## The problem with separate flags

A component that loads data usually starts like this:

```ts
interface UsersState {
  isLoading: boolean;
  error?: string;
  users?: User[];
}
```

Three independent fields make eight combinations, and only four make sense. Nothing stops `isLoading: true` with an `error`, or neither users nor an error once loading has finished, and every render has to guess what those mean. Bugs like “the spinner and the error both show” live in those extra combinations.

## A union of states, with one tag

List the states that can really happen, and give each a **tag**, a literal property that says which state it is:

```ts
type UsersRequest =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; users: User[] }
  | { status: 'error'; message: string };
```

That is a **discriminated union**: an object union whose members share a tag with a different literal value each. Now there are exactly four states, and each carries only the data it has: `users` exists only on success, and `message` only on error. The impossible combinations can't even be written.

## Narrowing on the tag

Check the tag, and TypeScript narrows to that member, as in [the narrowing lesson](lesson:narrowing):

```ts
function summary(request: UsersRequest): string {
  switch (request.status) {
    case 'idle':
      return 'Not loaded yet';
    case 'loading':
      return 'Loading…';
    case 'success':
      return `${request.users.length} users`; // users exists here
    case 'error':
      return `Failed: ${request.message}`;
  }
}
```

Read `request.users` outside the `success` branch and it is a compile error. Add a `default` with a `never` check and adding a fifth state points at every `switch` that must handle it.

## In React

Keep the whole union in one piece of state: `useState<UsersRequest>({ status: 'idle' })`. Each update sets a complete new state, such as `setRequest({ status: 'success', users })`, so there is no moment when two flags disagree. Rendering becomes one early return or `case` per state, which is the four-state pattern from [the lists lesson](lesson:lists-and-conditional-rendering) with the compiler checking it. TanStack Query's results work the same way: check `isPending` or `status` first, and `data` narrows.

## Beyond requests

The same tool models anything that is one of several shapes:

- **Actions for a reducer:** `{ type: 'add'; item: Item } | { type: 'remove'; id: string } | { type: 'clear' }`.
- **Payment methods:** a card has a number and expiry, PayPal has an email, and a bank transfer has an IBAN.
- **A multi-step form,** where each step holds the fields gathered so far.
- **API results:** `{ ok: true; data: T } | { ok: false; error: string }`.

## Mistakes that cost time

- **Optional fields everywhere** instead of separate states, which brings the impossible combinations back.
- **A `boolean` as the tag,** which caps you at two states. Use string literals; they also read better.
- **Reading data before checking the tag,** then silencing the error with `!` or `as`.
- **No `never` check,** so a new state slips through every `switch` unnoticed.

## Say it in an interview

“Instead of separate `isLoading`, `error` and `data` fields, I model state as a discriminated union: each state is an object with a literal `status` tag and only the data that state has. That removes impossible combinations like loading with an error, and checking the tag narrows the type, so I can only read `data` in the success state. I add a `never` check in the default branch, so adding a new state makes the compiler list every place that needs updating.”
