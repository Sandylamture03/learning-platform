// @ts-check
// <lp-resource-finder src="data/resources.json">: search and filter every resource the tracks link to.
//
// The element's children are the no-JavaScript fallback: the page puts the full list inside it, the shadow root
// covers it once this script runs, and a slot shows it again if the catalogue can't load.
/** @import { CatalogueResource, ResourceCatalogue } from '@lp/contracts' */
/** @import { UiModule } from '@lp/platform-kit' */
import { debounce, h, safeHref } from './dom.js';
import { describeResults, filterResources } from './search.js';

export const TAG = 'lp-resource-finder';

/** How long to wait after the last keystroke before searching. */
export const SEARCH_DELAY_MS = 250;

const STYLES = new URL('./widgets.css', import.meta.url).href;

export class ResourceFinder extends HTMLElement {
  /** @type {ResourceCatalogue | undefined} */
  #catalogue;
  /** The fetch in flight, shared by every update that needs the catalogue. @type {Promise<ResourceCatalogue> | undefined} */
  #loading;
  /** Aborted on disconnect: removes every listener and cancels the fetch. @type {AbortController | undefined} */
  #connection;
  /** Numbers the updates, so one that finishes after a newer one started is dropped instead of shown. */
  #latest = 0;
  #searchSoon = debounce(() => void this.#update(), SEARCH_DELAY_MS);
  /** @type {Map<string, string>} */
  #trackTitles = new Map();
  /** @type {Map<string, string>} */
  #typeLabels = new Map();

  // The shadow DOM, built once. Ids only need to be unique inside this shadow root.
  #search = h('input', {
    id: 'search',
    type: 'search',
    name: 'q',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-describedby': 'search-hint',
  });
  #track = h('select', { id: 'track', name: 'track', disabled: true }, h('option', { value: '' }, 'All tracks'));
  #type = h('select', { id: 'type', name: 'type', disabled: true }, h('option', { value: '' }, 'All types'));
  #form = h(
    'form',
    { class: 'finder', role: 'search', 'aria-label': 'Resources' },
    h(
      'div',
      { class: 'field field--wide' },
      h('label', { for: 'search' }, 'Search'),
      this.#search,
      h('p', { id: 'search-hint', class: 'hint' }, 'Words from the title or the site, such as “grid” or “mdn”.'),
    ),
    h('div', { class: 'field' }, h('label', { for: 'track' }, 'Track'), this.#track),
    h('div', { class: 'field' }, h('label', { for: 'type' }, 'Type'), this.#type),
  );
  #status = h('p', { class: 'status', role: 'status' }, 'Loading resources…');
  #list = h('ul', { class: 'results', role: 'list' });
  #clear = h('button', { type: 'button', class: 'button button--secondary' }, 'Clear search and filters');
  #empty = h(
    'div',
    { class: 'empty', hidden: true },
    h('p', {}, 'Try fewer words, or another track or type.'),
    this.#clear,
  );
  #fallback = h('div', { class: 'fallback', hidden: true }, h('slot'));

  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).append(
      h('link', { rel: 'stylesheet', href: STYLES }),
      this.#form,
      this.#status,
      this.#list,
      this.#empty,
      this.#fallback,
    );
  }

  connectedCallback() {
    this.#connection = new AbortController();
    const { signal } = this.#connection;
    if (!this.#catalogue) this.setAttribute('aria-busy', 'true');

    // One listener on the form handles all three controls (event delegation).
    this.#form.addEventListener(
      'input',
      (event) => {
        if (event.target === this.#search) {
          this.#searchSoon();
        } else {
          // A filter changed: search now, and drop the keystroke search it makes redundant.
          this.#searchSoon.cancel();
          void this.#update();
        }
      },
      { signal },
    );
    this.#form.addEventListener(
      'submit',
      (event) => {
        event.preventDefault(); // Enter searches now instead of reloading the page.
        this.#searchSoon.flush();
      },
      { signal },
    );
    this.#clear.addEventListener('click', () => this.#reset(), { signal });
    void this.#update();
  }

  disconnectedCallback() {
    this.#connection?.abort();
    this.#searchSoon.cancel();
    this.#loading = undefined; // the aborted fetch can't be reused; reconnecting starts a new one
    this.#latest += 1; // an update still waiting must not render into a detached element
  }

  /** The form as it is now. */
  #query() {
    return { text: this.#search.value.trim(), track: this.#track.value, type: this.#type.value };
  }

  async #update() {
    const run = ++this.#latest;
    const query = this.#query();
    let catalogue;
    try {
      catalogue = await this.#load();
    } catch {
      if (run === this.#latest) this.#showError();
      return;
    }
    // A newer update started while this one waited for the catalogue: these results are for an old query.
    if (run !== this.#latest) return;

    const results = filterResources(catalogue.resources, query);
    this.#list.replaceChildren(...results.map((r) => this.#item(r)));
    this.#status.textContent = describeResults(results.length, catalogue.resources.length, query, {
      track: this.#trackTitles.get(query.track),
      type: this.#typeLabels.get(query.type),
    });
    this.#empty.hidden = results.length > 0;
    this.removeAttribute('aria-busy');
  }

  /** @returns {Promise<ResourceCatalogue>} */
  #load() {
    if (this.#catalogue) return Promise.resolve(this.#catalogue);
    if (!this.#loading) {
      const loading = this.#fetchCatalogue(this.#connection?.signal);
      const forget = () => {
        if (this.#loading === loading) this.#loading = undefined; // a failed load is retried by the next update
      };
      loading.then(forget, forget);
      this.#loading = loading;
    }
    return this.#loading;
  }

  /** @param {AbortSignal | undefined} signal */
  async #fetchCatalogue(signal) {
    const src = this.getAttribute('src');
    if (!src) throw new Error(`<${TAG}> needs a src attribute`);
    const response = await fetch(src, { signal });
    if (!response.ok) throw new Error(`Loading ${src} failed with HTTP ${response.status}`);
    /** @type {ResourceCatalogue} */
    const catalogue = await response.json();

    this.#trackTitles = new Map(catalogue.tracks.map((t) => [t.id, t.title]));
    this.#typeLabels = new Map(catalogue.types.map((t) => [t.id, t.label]));
    this.#track.append(...catalogue.tracks.map((t) => h('option', { value: t.id }, t.title)));
    this.#type.append(...catalogue.types.map((t) => h('option', { value: t.id }, t.label)));
    this.#track.disabled = false;
    this.#type.disabled = false;
    this.#catalogue = catalogue;
    return catalogue;
  }

  /** @param {CatalogueResource} resource */
  #item(resource) {
    const href = safeHref(resource.url);
    const tracks = resource.tracks.map((id) => this.#trackTitles.get(id) ?? id).join(', ');
    const meta = [this.#typeLabels.get(resource.type) ?? resource.type, resource.host, tracks].filter(Boolean);
    return h(
      'li',
      { class: 'result' },
      href ? h('a', { href }, resource.title) : resource.title,
      h('span', { class: 'result__meta' }, meta.join(' · ')),
    );
  }

  #reset() {
    this.#search.value = '';
    this.#track.value = '';
    this.#type.value = '';
    this.#searchSoon.cancel();
    void this.#update();
    this.#search.focus();
  }

  #showError() {
    this.#status.textContent =
      this.children.length > 0
        ? 'The search could not load, so here is the full list.'
        : 'The resources could not load. Reload the page to try again.';
    this.#form.hidden = true;
    this.#list.hidden = true;
    this.#fallback.hidden = false;
    this.removeAttribute('aria-busy');
  }
}

// A second copy of this file on the page must not throw.
if (!customElements.get(TAG)) customElements.define(TAG, ResourceFinder);

/**
 * The shell's way in (Phase 3). The host element carries the catalogue's URL: <div data-src="/data/resources.json">.
 * @type {UiModule}
 */
const resourceFinder = {
  mount(el) {
    const finder = document.createElement(TAG);
    if (el.dataset.src) finder.setAttribute('src', el.dataset.src);
    el.append(finder);
  },
  unmount(el) {
    el.replaceChildren(); // disconnectedCallback removes the listeners and cancels the fetch
  },
};
export default resourceFinder;
