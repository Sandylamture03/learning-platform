## Scope: where a name can be used

Every variable lives in a scope: the part of the code where its name means that variable. You meet three kinds every day:

- **Block scope.** `let` and `const` declared inside braces around statements (an `if`, a `for`, a `while` or a bare `{ }`) exist only inside those braces.
- **Function scope.** Parameters and variables declared in a function body exist only inside that function.
- **Module scope.** A variable at the top level of a file loaded with `import` belongs to that file. Other files can use it only if you `export` it.

When your code uses a name, JavaScript looks for it in the current scope first, then in the scope around that, and so on out to the module and the global scope. The first match wins. The lookup follows where the code is *written*, not where it is called from, which is why this is called lexical scope.

```js
const label = 'outer';
if (true) {
  const label = 'inner'; // a second variable, only inside these braces
  console.log(label); // inner
}
console.log(label); // outer
```

Declaring a name that already exists further out makes a new variable that *shadows* the outer one while you are inside the block. Nothing is overwritten.

Not every pair of braces is a block. The braces in `{ total: 0 }` build an object: they make a value, and you cannot declare variables inside them.

## Closures: functions remember where they were made

A function can use the variables of the scopes around it. The part that surprises people is how long that lasts: the function keeps those variables for as long as the function itself exists, even after the code that created them has finished. A function together with the variables it keeps is a **closure**.

```js
function makeCounter() {
  let count = 0;
  return () => {
    count += 1;
    return count;
  };
}

const next = makeCounter();
next(); // 1
next(); // 2
```

`makeCounter` has returned, yet the arrow function it returned still reads and updates `count`. Nothing copied the number: the function holds on to the variable itself. Call `makeCounter` again and you get a new `count`, with a counter of its own.

Technically every JavaScript function is a closure. The word matters when a function outlives the code that made it: a function you return, a callback you pass to `setTimeout` or `addEventListener`, an event handler in a React component.

## Where closures show up at work

- **Private state.** Only the returned function can reach `count`. No other code can reset it or set it to `'banana'`.
- **Callbacks that remember.** A click handler made inside a loop over products remembers which product it belongs to.
- **Helpers that keep a value between calls.** `debounce` keeps a timer id, `once` keeps a flag, a cache keeps its results.
- **React.** Each render makes new handler functions that close over that render's props and state. A “stale closure” bug is a function still holding the variables from an old render.

Loops are where `let` earns its place. Each turn of a `for (let …)` loop gets a new `i`, so each callback remembers its own:

```js
for (let i = 1; i <= 3; i++) {
  setTimeout(() => console.log(i), 0);
}
// 1, 2, 3
```

With the old `var`, all three callbacks share one variable and log 4, 4, 4. You don't need to master `var`; just don't use it.

## Mistakes that cost time

- **Expecting a copy.** A closure keeps the variable, not the value it had when the function was made, so it sees every later change.
- **State in the wrong place.** In a helper like `debounce`, `let timer` must live in the outer function. Declared inside the returned function, it starts empty on every call and the helper does nothing.
- **Holding memory by accident.** A long-lived listener that closes over a large array keeps that array in memory until the listener is removed.

## Say it in an interview

“A closure is a function together with the variables from the scope where it was written. Because JavaScript uses lexical scope, an inner function can keep reading and updating an outer function's variables even after the outer function has returned. I use closures for private state, for callbacks that need to remember something, and in helpers like `debounce`, where the timer id has to survive between calls.”
