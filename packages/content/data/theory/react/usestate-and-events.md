## State is a component's memory

A component is a function, so its local variables start again on every render. To remember something between renders (the text in a search box, whether a menu is open, the items in a cart), a component asks React to keep it with `useState`:

```jsx
import { useState } from 'react';

function LikeButton() {
  const [likes, setLikes] = useState(0);
  return (
    <button type="button" onClick={() => setLikes(likes + 1)}>
      {likes} likes
    </button>
  );
}
```

`useState(0)` returns the current value and a function to change it. Calling the setter doesn't change `likes` in place: it asks React to render the component again, and on that render `useState` returns the new value. Each copy of `<LikeButton />` on the page has its own `likes`.

## Event handlers

You attach behaviour with props such as `onClick`, `onChange` and `onSubmit`, which take a function:

- **Pass the function, don't call it.** `onClick={save}` runs `save` on click; `onClick={save()}` runs it while rendering and hands React its return value.
- **Wrap it to pass arguments:** `onClick={() => remove(item.id)}`.
- **The handler gets an event object:** `event.target.value` in `onChange`, and `event.preventDefault()` in `onSubmit` to stop the browser loading a new page, as in [the DOM and events lesson](lesson:dom-and-events).
- **Name them by what happens:** a component's own function is `handleSubmit`, and a prop that lets its parent react is `onSubmit`.

Handlers are where things happen because of the user: set state, send a request, navigate. They can do what rendering must not.

## State is a snapshot

Inside one render, `likes` is a constant. The setter schedules the next render; it doesn't reach back into the current one:

```jsx
function handleClick() {
  setLikes(likes + 1);
  setLikes(likes + 1);
  setLikes(likes + 1);
  console.log(likes); // still the old value
}
```

All three calls read the same `likes`, say 0, so all three ask for 1, and one click adds one. React also batches the updates from one event into a single render. When the next value depends on the last one, pass an **updater function**. React calls it with the latest value, including updates still queued:

```jsx
setLikes((current) => current + 1); // three of these add three
```

## Objects and arrays in state

React decides whether to re-render by comparing the old and new value with `Object.is`. If you change an array or object in place and set the same reference, React sees no change and skips the render. Always set a new value, built with the copying patterns from [working with arrays and objects](lesson:arrays-and-objects):

- **Change a field:** `setUser({ ...user, name })`.
- **Add:** `setItems([...items, item])`.
- **Remove:** `setItems(items.filter((i) => i.id !== id))`.
- **Update one:** `setItems(items.map((i) => (i.id === id ? { ...i, done: true } : i)))`.

## Controlled inputs

An input is *controlled* when its value comes from state and every change goes back to state: `value={name}` and `onChange={(event) => setName(event.target.value)}`. The state is then the single source of truth, so validating, clearing or filtering on it is ordinary JavaScript. Checkboxes use `checked` instead of `value`.

## Mistakes that cost time

- **`onClick={handleClick()}`,** which runs during render, often in an endless loop of renders.
- **Mutating state:** `items.push(item); setItems(items);` renders nothing new.
- **Reading state straight after setting it,** and expecting the new value.
- **Storing what you can calculate.** A filtered list or a total is derived from state during render, not kept in a second state that can drift.
- **`setCount(count + 1)` in a loop or a timer,** where the updater form is needed.

## Say it in an interview

“`useState` gives a component memory: it returns the current value and a setter, and calling the setter makes React render again with the new value. State is a snapshot, so inside one render the value never changes; when the next value depends on the previous one, I pass an updater like `setCount(c => c + 1)`. I never mutate state: I create new objects and arrays with spread, `map` and `filter`, because React compares references to decide whether to re-render.”
