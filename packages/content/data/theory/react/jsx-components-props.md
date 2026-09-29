## Components are functions

A React app is a tree of components. A component is a JavaScript function that returns what should appear on screen, written in JSX:

```jsx
function Welcome() {
  return <h1>Welcome back</h1>;
}
```

You use it like an HTML tag: `<Welcome />`. Two rules make that work:

- **Names start with a capital letter.** JSX treats `<welcome />` as an HTML element and `<Welcome />` as your component.
- **One component, one job.** A product page is a `Layout`, a `ProductList`, many `ProductCard`s and a `Price`. Most teams put each component in its own file and export it.

## JSX is JavaScript underneath

JSX looks like HTML, but every tag becomes a function call that describes an element. That explains its rules:

- **Return one root.** A function returns one value, so wrap siblings in a parent element or in a fragment, `<>…</>`, which adds nothing to the page.
- **Close every tag,** including the ones HTML lets you leave open: `<img />`, `<input />`, `<br />`.
- **Attributes are camelCase JavaScript names:** `className` instead of `class`, `htmlFor` instead of `for`, `onClick`, and `style={{ width: 40 }}`, which takes an object.
- **Braces hold any JavaScript expression:** `{user.name}`, `{price * quantity}`, `{isOpen ? 'Close' : 'Open'}`. Statements such as `if` and `for` can't go inside braces; do that work above the `return`.

Text you put in braces is always shown as text, never run as HTML, so `{comment}` is safe even when a user wrote it.

## Props flow down

Props are how a parent hands data to a child. The parent writes them as attributes, and the child receives them as one object, which you usually destructure in the parameter list:

```jsx
function Price({ cents, currency = 'USD' }) {
  const text = new Intl.NumberFormat('en', { style: 'currency', currency }).format(cents / 100);
  return <span className="price">{text}</span>;
}

<Price cents={1999} />; // $19.99
```

- **Anything can be a prop:** strings, numbers (in braces), arrays, objects, functions and other elements.
- **A default** such as `currency = 'USD'` fills in a prop the parent leaves out.
- **`children`** is whatever the parent puts between the opening and closing tags. It is how you build wrappers such as `Card`, `Layout` or `Modal` that don't know what they will hold.
- **Props are read-only.** A component never changes its props. When something has to change, the parent owns that data and passes down a function to change it, which the next lessons cover.

## Keep components pure

Given the same props, a component should return the same JSX, and do nothing else while it renders: no changing variables outside it, no requests, no timers. React may render a component many times, in any order, and in development Strict Mode deliberately calls it twice to expose code that breaks this rule. Work that has to happen outside rendering goes in event handlers, or in effects when nothing else fits.

## Thinking in components

Before you write code for a screen, draw boxes around its parts and name them. Each box that repeats (a card, a row) or has one clear job (a search bar, a price) becomes a component. Then decide which component owns each piece of data: it lives in the closest component that needs it, and flows down from there as props. That habit is most of [Thinking in React](https://react.dev/learn/thinking-in-react).

## Mistakes that cost time

- **Lowercase component names.** `<card />` renders an unknown HTML tag and your function never runs.
- **Returning two roots.** Wrap them in a fragment.
- **Changing a prop,** for example `props.items.push(item)`. Nothing re-renders, and the parent's data changes behind its back.
- **Calling a component like a function,** `{ProductCard(product)}`. Write `<ProductCard {...product} />` or pass named props, so React can track it.
- **One giant component.** If a component needs scrolling to read, split it.

## Say it in an interview

“A React component is a function that takes props and returns JSX describing the UI. JSX compiles to plain function calls, which is why it needs one root, closed tags and camelCase attributes, and why braces take any expression. Data flows one way: parents pass props down, props are read-only, and `children` lets a component wrap content it doesn't know about. I keep components pure, same props in, same output out, and split a screen into small components that each do one thing.”
