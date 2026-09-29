## One thread, one thing at a time

JavaScript in a web page runs on the main thread, which it shares with the browser's own work: working out styles and layout, painting the screen and handling input. Only one piece of code runs at a time, and once it starts it runs to the end. Nothing interrupts a function halfway through.

So how do timers, clicks and network responses fit in? The **event loop** decides what runs next.

## The call stack

When a function is called, it goes on top of the **call stack**; when it returns, it comes off. The stack is what is running right now, and the stack trace in an error message is a snapshot of it. When the stack is empty, the code that was running has finished.

## Tasks

Work that starts from outside your running code waits in a queue as a **task** (you will also hear “macrotask”): running a script, a `setTimeout` callback, a click listener, a network response arriving. The event loop repeats the same steps:

1. Take the oldest task from the queue and run it until the call stack is empty.
2. Run every waiting microtask (see below).
3. If it is time for a new frame, render: update styles and layout, then paint. At 60 frames a second that is about every 16 ms.
4. Go back to step 1.

`setTimeout(callback, 0)` does not mean “now”. It means “queue the callback as a task after at least 0 ms”, so it runs after the current code and after every microtask that is already waiting.

## Microtasks

Promise callbacks don't join the task queue. `.then`, `.catch` and `.finally` callbacks, the rest of an async function after an `await`, and anything passed to `queueMicrotask` go in the **microtask queue**. That queue is emptied completely after each task, before the browser renders and before the next task starts. A microtask that queues another microtask gets it run in the same batch.

```js
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve()
  .then(() => console.log('C'))
  .then(() => console.log('D'));
console.log('E');
// A, E, C, D, B
```

Step by step: the script is one task. It logs A, queues the timer's callback as a task, queues C as a microtask and logs E. The script ends, so the microtasks run: C, and D, which C's promise queued. Only then does the loop take the next task, and B is logged.

## await, seen from the event loop

`await` splits an async function in two. The part before it runs straight away; the part after it waits as a microtask until the promise settles, and meanwhile the code that called the function carries on.

```js
async function save() {
  console.log('1: start saving');
  await Promise.resolve();
  console.log('3: saved');
}
save();
console.log('2: the caller carries on');
```

## Why pages freeze

Rendering happens between tasks, and so does handling the next click. A task that takes three seconds blocks all of it: no painting, no clicks, no timers. The browser treats any task over 50 ms as a *long task*, the kind users feel as lag.

- **Keep tasks short.** Split big jobs into chunks, and between chunks wait for a new task with `await new Promise((resolve) => setTimeout(resolve, 0))`. Awaiting a microtask doesn't help, because microtasks run before the browser gets a turn.
- **Move heavy computation off the main thread** into a Web Worker, which runs in parallel and sends its result back as a message.
- **Never write a microtask loop.** A promise callback that always queues another one starves rendering completely.

## In Node.js

Node.js uses the same model: one thread, a loop that takes tasks (timers, I/O callbacks, `setImmediate`) in phases, and all the microtasks in between. `process.nextTick` callbacks run even before promise callbacks. The Node.js track covers the phases; the ordering rules in this lesson still hold.

## Mistakes that cost time

- **Treating `setTimeout(fn, 0)` as immediate.** It waits for the current task and all microtasks.
- **Thinking asynchronous code runs in parallel with yours.** The network and the timers wait elsewhere, but every callback runs on the one main thread.
- **Updating the screen, then blocking.** Text you set before a long loop doesn't appear until the loop has finished, because rendering waits for the task to end.

## Say it in an interview

“JavaScript runs on one thread with a call stack. The event loop takes one task at a time, such as a script, a timer callback or an event, and runs it to completion. After each task it empties the microtask queue, which holds promise callbacks and the code after each `await`, and then the browser can render. That's why a resolved promise's callback runs before a `setTimeout` of 0, and why a long task freezes the page: nothing else, not even rendering, can run until it finishes.”
