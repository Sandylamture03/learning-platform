## The DOM is a tree of objects

The browser turns your HTML into the DOM: a tree of objects, one for each element and each run of text. JavaScript can read and change that tree, and the page follows every change.

To find elements:

- `document.querySelector('.card')` returns the first match, or `null`.
- `document.querySelectorAll('li')` returns every match as a list you can loop over with `for...of`.
- `element.closest('li')` walks up from an element to the nearest one that matches, starting with the element itself.
- Call these on an element instead of `document` to search only inside it: `list.querySelector('.selected')`.

To change them:

- Text: `status.textContent = 'Saved'`.
- Attributes and state: `button.setAttribute('aria-expanded', 'true')`, `panel.hidden = true`, and `item.dataset.id` to read a `data-id` attribute.
- Classes: `card.classList.add('is-open')`, `remove` and `toggle`.
- New elements: `document.createElement('li')`, then `list.append(item)`; `item.remove()` takes one out.

## Text goes in as text

`innerHTML` reads its string as HTML. If any part of that string came from a user, a URL or an API, you have a cross-site scripting (XSS) hole: a “name” such as `<img src=x onerror="stealCookies()">` runs code on your page. `textContent` makes a text node instead, and the browser shows the characters exactly as typed.

```js
const item = document.createElement('li');
item.textContent = comment.author; // safe, whatever the author typed
item.classList.add('comment');
list.append(item);
```

The rule: build elements and set `textContent`. Use `innerHTML` only for a string you wrote yourself, never for data. React follows the same rule, since `{name}` in JSX always renders as text.

## Events: listen, bubble, cancel

`button.addEventListener('click', onClick)` calls `onClick(event)` every time the button is clicked. The parts of `event` you will use most:

- `event.target` is the element the event started on. For a click, that can be an icon inside the button.
- `event.currentTarget` is the element the listener is on.
- `event.key` says which key was pressed, in keyboard events.

Most events **bubble**: after the listeners on the target run, the event travels up through each ancestor to the `document`, running their listeners too. Click a button inside a `div` and the listeners run on the button, then the `div`, then up to the document, whatever order you added them in. (Before bubbling there is a capture phase going down the tree; you will rarely need `{ capture: true }`.)

Two methods control what happens next:

- `event.preventDefault()` cancels the browser's own action: a form loading a new page, a link navigating, a checkbox changing.
- `event.stopPropagation()` stops the event reaching listeners on ancestors. You rarely want it: it silently breaks delegation and any listener higher up.

```js
form.addEventListener('submit', (event) => {
  event.preventDefault(); // stay on this page
  const email = new FormData(form).get('email');
  status.textContent = `Thanks, we will write to ${email}.`;
});
```

Listen for `submit` on the form rather than `click` on its button: `submit` also fires when the user presses Enter in a field, and it fires only after the browser's own validation passes. Returning `false` from a listener added with `addEventListener` does nothing.

## Event delegation

Instead of a listener on every item, put one listener on the container and let events bubble up to it. `event.target.closest(selector)` finds the item the event came from, even when it landed on a child such as an icon:

```js
list.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action="delete"]');
  if (!button) return;
  button.closest('li').remove();
});
```

One listener instead of hundreds, and it keeps working for items added later, with nothing to wire up again after each change. React sets up its event handling on the root of your app for the same reasons.

## Clean up after yourself

A listener keeps its function, and everything that function closes over, alive until the listener is removed. Anything that comes and goes, like a modal or a component, must remove the listeners it added. Two ways:

- `element.removeEventListener('click', onClick)`, with the *same* function you added. A new arrow function is a different function, so it removes nothing.
- Pass `{ signal: controller.signal }` from an `AbortController` when you add listeners, then call `controller.abort()` to remove all of them at once. The same signal can cancel a `fetch`. The widgets on this site clean up exactly this way.

## Mistakes that cost time

- **Running a script before the elements exist.** Load it with `<script type="module">`, which waits for the HTML to be parsed, or put the script at the end of the body.
- **Not checking for `null`.** `querySelector` returns `null` when nothing matches, and the next line throws.
- **Using `event.target` when you meant the element with the listener.** The target might be a child. Use `event.currentTarget`, or `closest`.
- **Listening for `click` on a submit button** instead of `submit` on the form.

## Say it in an interview

“Events bubble from the element where they happen up through its ancestors, so one listener on a container can handle events from all of its children. That's event delegation: I use `event.target.closest()` to find the item that was clicked, and it keeps working for items added later. I call `preventDefault` to stop the browser's default action, like a form submission, I set `textContent` rather than `innerHTML` for anything from users, and I remove listeners with an `AbortController` signal when a component goes away.”
