## When to write a custom hook

Once two components contain the same `useState` and `useEffect` pair (tracking the window width, whether the browser is online, a debounced search term), move that logic into a function of its own. A **custom hook** is a function whose name starts with `use` and which calls other hooks:

```jsx
import { useEffect, useState } from 'react';

export function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}
```

Components then read like a description of what they need: `const width = useWindowWidth();`. A hook can take any arguments and return anything: a value, a `[value, setValue]` pair like `useState`, or an object with several fields.

## The rules of hooks

React knows which state belongs to which `useState` call only by the *order* of the calls in each render. Two rules keep that order the same every time:

1. **Call hooks at the top level** of a component or a custom hook: never inside a condition, a loop, a nested function or after an early `return`.
2. **Call hooks only from React functions:** components and other custom hooks, not ordinary functions or event handlers.

The `use` prefix is how people, and the `react-hooks` linter, tell hooks apart and check those rules. Don't give a function that calls no hooks a `use` name.

## Shared logic, separate state

A custom hook shares *how* to keep some state, not the state itself. Two components that both call `useWindowWidth()` each get their own `useState` and their own effect; they just happen to hold the same number. To share one value between components, lift it into a common parent or put it in Context. A hook is also a closure, as in [the scope and closures lesson](lesson:scope-and-closures): each call of the component gets fresh variables, and the functions a hook returns remember that render's values.

## Two hooks every team writes

**`useDebounce(value, delay)`** returns `value`, but only once it has stopped changing for `delay` milliseconds. Each new value starts a timer in an effect, and the cleanup cancels the previous timer, so a search box fetches once when the user pauses instead of on every key.

**`useLocalStorage(key, initialValue)`** works like `useState`, but remembers the value in `localStorage` across reloads. It reads the saved value once, on the first render, by passing a function to `useState` (a *lazy initial state*), falls back to `initialValue` when nothing usable is saved, and writes each change back in an effect. The coding task asks you to write it.

## Mistakes that cost time

- **Calling a hook conditionally:** `if (enabled) useEffect(…)`. Put the condition inside the hook instead.
- **Expecting two components to share state** because they call the same hook.
- **Returning a new object or function on every render** from a hook, which then sits in someone's dependency array and re-runs their effect every time. Return stable values, or wrap functions with `useCallback` where it matters.
- **One hook that does everything.** A hook with ten return values is a component in disguise; split it.
- **Reading `localStorage` on every render** instead of once, in the lazy initial state.

## Say it in an interview

“A custom hook is a function starting with `use` that calls other hooks, so I can take stateful logic, such as a subscription or a debounced value, out of components and reuse it. It shares logic, not state: every component that calls it gets its own copy. Hooks must be called at the top level and only from components or other hooks, because React matches state to hooks by call order. `useDebounce` and `useLocalStorage` are two I write in most projects.”
