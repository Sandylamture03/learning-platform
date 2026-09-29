## From an array to a list

Data from an API is usually an array, and the screen shows it as a list. React renders arrays of elements, so `map` turns each item into JSX:

```jsx
function ProductList({ products }) {
  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>{product.name}</li>
      ))}
    </ul>
  );
}
```

`filter`, `toSorted` and `slice` fit in front of `map` the same way they do anywhere else in JavaScript. Work out the list above the `return`, give it a name, and keep the JSX simple.

## Keys: how React tells items apart

Every item in a rendered array needs a `key` that is unique among its siblings. When the list changes, React compares the old and new keys to work out which items were added, removed or moved, and keeps each item's DOM and state with the right key.

- **Take the key from the data:** a database id, a slug, an email. It stays with the item wherever it moves.
- **Put the key on the outermost element `map` returns,** such as the `<li>` or the `<ProductCard>`, not on something inside it.
- **Keys don't reach the component.** `key` is for React only; if the child needs the id, pass it as a separate prop too.

The array index looks like a key but isn't one. It works for a list that never changes order. When an item is inserted, deleted or sorted, the indexes shift, and React matches old DOM and state to the wrong items: a checkbox stays ticked on the wrong row, and a half-typed input jumps to another item. Keys generated during render, such as `Math.random()`, are worse: every render makes new keys, so React throws the items away and rebuilds them each time.

## Conditional rendering

JSX has no `if`, but JavaScript does, and you have three tools:

- **An early return** for whole-screen states: `if (isLoading) return <Spinner />;`.
- **The ternary** to choose between two things: `{isOpen ? <Close /> : <Open />}`.
- **`&&`** to show something or nothing: `{error && <p role="alert">{error}</p>}`.

`null`, `undefined`, `true` and `false` render nothing, which is why `&&` works. Numbers are different: `{count && <Badge />}` shows a stray `0` when `count` is 0, because `&&` returns its left side and React renders numbers. Make the condition a real boolean: `{count > 0 && <Badge />}`.

## Every list has four states

A list that comes from the network is not just “the list”. Before you write the happy path, decide what each of these looks like:

1. **Loading:** the data is on its way.
2. **Error:** it failed; say so, and offer a way to try again.
3. **Empty:** it arrived with nothing in it, or nothing matches the filter; say that, instead of showing a blank space.
4. **Loaded:** the list itself.

Early returns handle the first three one by one, so the `map` at the end only runs when there is something to show. Showing all four states is a large part of what separates a junior's pull request from a reviewed one.

## Mistakes that cost time

- **No key, or the index as the key,** on a list that can change.
- **The key on the wrong element,** such as an inner `<span>` instead of the element `map` returns.
- **`{items.length && …}`,** which renders `0` for an empty list.
- **Nested ternaries** three levels deep. Use early returns, or pull the branch into a small component.
- **Forgetting the empty and error states,** so a failed request looks like a blank page.

## Say it in an interview

“I render lists with `map`, and give each item a key from the data, such as its id, so React can match items between renders when the list changes. Index keys break when items are inserted, removed or reordered, because state and DOM stay at the old positions. For conditions I use early returns for whole states, a ternary to pick between two elements, and `&&` for show-or-nothing, with a real boolean on the left so 0 never renders. And every list gets loading, error, empty and loaded states.”
