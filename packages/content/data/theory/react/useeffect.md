## What effects are for

Rendering has to stay pure: work out the JSX from props and state, and touch nothing else. Some components still need to reach outside React: start a timer, listen to the window, connect to a chat server, fetch data when an id changes. An **effect** is code that React runs *after* it has updated the page, to keep the component in sync with such an outside system:

```jsx
import { useEffect, useState } from 'react';

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <time>{now.toLocaleTimeString()}</time>;
}
```

The question an effect answers is “what must be set up while this component is on screen, and how do I undo it?”, not “what should happen after this render?”.

## The dependency array

The second argument lists every value from the component that the effect reads: props, state, and anything calculated from them. React runs the effect after the first render, then again after any render where one of those values changed.

- **`[userId]`:** run when `userId` changes.
- **`[]`:** the effect reads nothing reactive, so it runs once, after the component first appears.
- **No array at all:** run after every render. You rarely want this.

Don't leave values out to make an effect run less. The effect would then read stale values from an old render. The linter rule `react-hooks/exhaustive-deps` (on in the Vite template) points out every missing dependency; when it complains, change the code, not the list.

## Cleanup

The function an effect returns is its **cleanup**. React calls it before the effect runs again with new values, and when the component leaves the page. Everything an effect starts, its cleanup stops:

- `setInterval` / `clearInterval`, and `setTimeout` / `clearTimeout`;
- `addEventListener` / `removeEventListener`;
- a subscription or connection / its unsubscribe or close;
- a `fetch` / `controller.abort()`.

In development, Strict Mode mounts every component, runs its effects, cleans them up, and runs them again, on purpose. If that breaks something (two intervals, a duplicate subscription), the cleanup is missing. It doesn't happen in production.

## Fetching in an effect

Fetching when an id changes is the classic effect, and it has a trap: answers can arrive out of order. The user opens user 1, then user 2; if user 1's request is slower, its answer arrives last and overwrites user 2. The cure is the cleanup: abort the old request when the id changes, and ignore the `AbortError` it causes. Also handle all three states (loading, error, success), as in [the async code lesson](lesson:async-code).

Doing this by hand once teaches you what a data library does for you. In real apps, TanStack Query handles caching, retries, races and refetching, and most `fetch`-in-an-effect code goes away.

## You might not need an effect

Effects are an escape hatch, and the most common review comment on junior React code is “this doesn't need an effect”:

- **Data you can calculate from props or state:** calculate it while rendering. `const total = items.reduce(…)`, not an effect that copies it into more state.
- **Work caused by a user action,** such as sending a form or showing a toast after a click: do it in the event handler, where you know what happened.
- **Resetting state when a prop changes:** give the component a `key` from that prop, and React starts it fresh.

## Mistakes that cost time

- **Missing dependencies,** leaving the effect with stale values.
- **An object or function made during render as a dependency.** It is new on every render, so the effect runs every time. Create it inside the effect, or keep it stable.
- **Setting state that the effect depends on,** unconditionally, which loops forever.
- **`useEffect(async () => …)`.** An async function returns a promise, and an effect may only return a cleanup function. Define the async function inside the effect and call it.
- **No cleanup,** so timers and listeners pile up.

## Say it in an interview

“`useEffect` synchronises a component with something outside React, such as a timer, a subscription, a browser API or a request. It runs after React has updated the page, re-runs when a value in its dependency array changes, and its cleanup undoes what it set up before the next run and on unmount. Strict Mode runs effects twice in development to prove the cleanup works. I don't use effects for values I can calculate while rendering or for logic that belongs in an event handler, and in real apps I fetch with a library like TanStack Query instead.”
