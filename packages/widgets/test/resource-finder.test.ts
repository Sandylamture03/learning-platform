import { afterEach, describe, expect, it, vi } from 'vitest';
import resourceFinder, { SEARCH_DELAY_MS, TAG } from '../src/resource-finder.js';
import { catalogue, fakeContext, fakeFetch, must, recordText, settle } from './fixtures.ts';

function addFinder(host: HTMLElement = document.body) {
  const el = document.createElement(TAG);
  el.setAttribute('src', '/data/resources.json');
  host.append(el);
  return parts(el);
}

function parts(el: Element) {
  const root = must(el.shadowRoot, 'a shadow root');
  const status = must(root.querySelector('[role="status"]'), 'the status');
  return {
    el,
    root,
    status,
    search: must(root.querySelector<HTMLInputElement>('input[type="search"]'), 'the search box'),
    track: must(root.querySelector<HTMLSelectElement>('#track'), 'the track filter'),
    type: must(root.querySelector<HTMLSelectElement>('#type'), 'the type filter'),
    form: must(root.querySelector('form'), 'the form'),
    empty: must(root.querySelector<HTMLElement>('.empty'), 'the empty state'),
    fallback: must(root.querySelector<HTMLElement>('.fallback'), 'the fallback'),
    titles: () => [...root.querySelectorAll('.result')].map((li) => li.firstChild?.textContent),
  };
}

/** What a keystroke does: change the value, then fire input from the field. */
function typeInto(input: HTMLInputElement, text: string) {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function choose(select: HTMLSelectElement, value: string) {
  select.value = value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
}

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('<lp-resource-finder>', () => {
  it('shows every resource and fills the filters once the catalogue arrives', async () => {
    const { fetch } = fakeFetch(catalogue);
    const finder = addFinder();
    expect(finder.el.getAttribute('aria-busy')).toBe('true');
    expect(finder.status.textContent).toBe('Loading resources…');

    await settle();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe('/data/resources.json');
    expect(finder.titles()).toEqual([
      'CSS grid layout',
      'Flexbox in 20 minutes',
      'Quick Start',
      'Grid layouts in React',
    ]);
    expect(finder.status.textContent).toBe('Showing all 4 resources.');
    expect([...finder.track.options].map((o) => o.text)).toEqual(['All tracks', 'HTML5 & CSS3', 'React']);
    expect([...finder.type.options].map((o) => o.text)).toEqual(['All types', 'Docs', 'Video']);
    expect(finder.track.disabled).toBe(false);
    expect(finder.el.hasAttribute('aria-busy')).toBe(false);
  });

  it('describes each result: type, site and tracks', async () => {
    fakeFetch(catalogue);
    const finder = addFinder();
    await settle();
    const last = [...finder.root.querySelectorAll('.result')].at(-1);
    expect(last?.querySelector('a')?.getAttribute('href')).toBe('https://example.com/grid-react');
    expect(last?.querySelector('.result__meta')?.textContent).toBe('Video · example.com · HTML5 & CSS3, React');
  });

  it('searches once typing pauses, not on every keystroke', async () => {
    vi.useFakeTimers();
    fakeFetch(catalogue);
    const finder = addFinder();
    await settle();
    const shown = recordText(finder.status);

    for (const text of ['g', 'gr', 'gri', 'grid']) {
      typeInto(finder.search, text);
      await vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS / 2);
    }
    expect(shown).toEqual([]); // still typing
    await vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS);
    await settle();

    expect(shown).toEqual(['Showing 2 of 4 resources for “grid”.']);
    expect(finder.titles()).toEqual(['CSS grid layout', 'Grid layouts in React']);
  });

  it('never shows results for an old query, even when the catalogue arrives late', async () => {
    vi.useFakeTimers();
    const network = fakeFetch(catalogue, { hold: true });
    const finder = addFinder();
    const shown = recordText(finder.status);

    // Two searches start while the catalogue is still on its way; both wait for it.
    typeInto(finder.search, 'grid');
    await vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS);
    typeInto(finder.search, 'flexbox');
    await vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS);
    network.release();
    await settle();

    expect(network.fetch).toHaveBeenCalledOnce();
    expect(shown).toEqual(['Showing 1 of 4 resources for “flexbox”.']);
    expect(finder.titles()).toEqual(['Flexbox in 20 minutes']);
  });

  it('applies a filter straight away, together with the words', async () => {
    vi.useFakeTimers();
    fakeFetch(catalogue);
    const finder = addFinder();
    await settle();

    typeInto(finder.search, 'grid');
    choose(finder.track, 'react'); // before the typing delay is up
    await settle();
    expect(finder.titles()).toEqual(['Grid layouts in React']);
    expect(finder.status.textContent).toBe('Showing 1 of 4 resources for “grid” in React.');

    choose(finder.type, 'docs');
    await settle();
    expect(finder.titles()).toEqual([]);

    // The keystroke search the filter replaced never runs.
    const shown = recordText(finder.status);
    await vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS * 2);
    expect(shown).toEqual([]);
  });

  it('searches at once on Enter', async () => {
    vi.useFakeTimers();
    fakeFetch(catalogue);
    const finder = addFinder();
    await settle();

    typeInto(finder.search, 'quick');
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    finder.form.dispatchEvent(submit);
    await settle();
    expect(submit.defaultPrevented).toBe(true);
    expect(finder.titles()).toEqual(['Quick Start']);
  });

  it('offers a way out when nothing matches', async () => {
    fakeFetch(catalogue);
    const finder = addFinder();
    await settle();
    expect(finder.empty.hidden).toBe(true);

    typeInto(finder.search, 'cobol');
    choose(finder.track, 'react');
    await settle();
    expect(finder.titles()).toEqual([]);
    expect(finder.empty.hidden).toBe(false);
    expect(finder.status.textContent).toBe('No resources for “cobol” in React.');

    must(finder.empty.querySelector('button')).click();
    await settle();
    expect(finder.search.value).toBe('');
    expect(finder.track.value).toBe('');
    expect(finder.titles()).toHaveLength(4);
    expect(finder.root.activeElement).toBe(finder.search);
  });

  it('shows titles as text, and links only to https pages', async () => {
    fakeFetch({
      ...catalogue,
      resources: [
        { ...catalogue.resources[0], title: '<img src=x onerror=alert(1)>' },
        { ...catalogue.resources[1], url: 'javascript:alert(1)' },
      ],
    });
    const finder = addFinder();
    await settle();
    expect(finder.root.querySelector('img')).toBeNull();
    expect(finder.titles()).toEqual(['<img src=x onerror=alert(1)>', 'Flexbox in 20 minutes']);
    expect(finder.root.querySelectorAll('.results a')).toHaveLength(1);
  });

  it('stops listening and cancels the fetch when it leaves the page', async () => {
    vi.useFakeTimers();
    const network = fakeFetch(catalogue, { hold: true });
    const finder = addFinder();
    const shown = recordText(finder.status);
    typeInto(finder.search, 'grid'); // a search waiting to run

    finder.el.remove();
    expect(network.requests[0]?.signal?.aborted).toBe(true);
    typeInto(finder.search, 'react');
    await vi.advanceTimersByTimeAsync(SEARCH_DELAY_MS * 2);
    network.release();
    await settle();
    expect(shown).toEqual([]);

    // Put back on the page, it starts again with a fresh request.
    document.body.append(finder.el);
    network.release();
    await settle();
    expect(network.fetch).toHaveBeenCalledTimes(2);
    expect(finder.titles()).toEqual(['Quick Start', 'Grid layouts in React']);
  });

  it("shows the page's own list when the catalogue can't load", async () => {
    fakeFetch({}, { status: 404 });
    const el = document.createElement(TAG);
    el.setAttribute('src', '/data/resources.json');
    el.append(Object.assign(document.createElement('ul'), { className: 'static-list' }));
    document.body.append(el);
    const finder = parts(el);
    await settle();

    expect(finder.status.textContent).toBe('The search could not load, so here is the full list.');
    expect(finder.fallback.hidden).toBe(false);
    expect(finder.form.hidden).toBe(true);
    expect(el.hasAttribute('aria-busy')).toBe(false);
  });

  it('mounts into a host element and unmounts cleanly', async () => {
    const network = fakeFetch(catalogue, { hold: true });
    const host = document.createElement('div');
    host.dataset.src = '/api/resources';
    document.body.append(host);

    await resourceFinder.mount(host, fakeContext());
    const el = must(host.querySelector(TAG));
    expect(el.getAttribute('src')).toBe('/api/resources');
    network.release();
    await settle();
    expect(parts(el).titles()).toHaveLength(4);

    await resourceFinder.unmount(host);
    expect(host.childElementCount).toBe(0);
  });
});
