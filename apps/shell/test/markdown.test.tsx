import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, describe, expect, it } from 'vitest';
import { InlineMarkdown, Markdown } from '../src/markdown.tsx';

afterEach(cleanup);

const renderInRouter = (ui: ReactNode) =>
  render(<RouterProvider router={createMemoryRouter([{ path: '*', element: ui }])} />);

describe('Markdown', () => {
  it('renders the same structure as the site, with text as text', () => {
    const { container } = renderInRouter(
      <Markdown source={'## What `this` is\n\n- one <b>\n- two\n\n```js\nconst a = "<i>";\n```'} name="lesson.md" />,
    );
    expect(container.innerHTML).toBe(
      '<h2 id="what-this-is">What <code>this</code> is</h2>' +
        '<ul><li>one &lt;b&gt;</li><li>two</li></ul>' +
        '<pre class="code"><code>const a = "&lt;i&gt;";</code></pre>',
    );
  });

  it('links a lesson it knows inside the app, and keeps only the words for one it does not', () => {
    const links = [{ id: 'event-loop', title: 'The event loop', trackId: 'javascript', written: true }];
    const { container } = renderInRouter(
      <InlineMarkdown
        text="See [the loop](lesson:event-loop), [closures](lesson:closures) and [MDN](https://developer.mozilla.org)."
        name="note"
        links={links}
      />,
    );
    expect(container.innerHTML).toBe(
      'See <a href="/tracks/javascript/event-loop" data-discover="true">the loop</a>, <span>closures</span> and ' +
        '<a href="https://developer.mozilla.org">MDN</a>.',
    );
  });
});
