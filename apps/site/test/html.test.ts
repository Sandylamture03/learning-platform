import { describe, expect, it } from 'vitest';
import { html } from '../src/html.ts';
import { linkFrom } from '../src/routes.ts';

describe('html', () => {
  it('escapes interpolated text', () => {
    const name = '<script>alert("hi")</script> & more';
    expect(html`<p title="${name}">${name}</p>`.value).toBe(
      '<p title="&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt; &amp; more">&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt; &amp; more</p>',
    );
  });

  it('nests templates and joins arrays without escaping them twice', () => {
    const items = ['a & b', 'c'].map((t) => html`<li>${t}</li>`);
    expect(html`<ul>${items}</ul>`.value).toBe('<ul><li>a &amp; b</li><li>c</li></ul>');
  });

  it('renders nothing for false, null and undefined', () => {
    const show = false;
    expect(html`<p>${show && html`<b>no</b>`}${null}${undefined}</p>`.value).toBe('<p></p>');
  });
});

describe('linkFrom', () => {
  it('makes links relative to the current page', () => {
    const fromTrack = linkFrom('tracks/react.html');
    expect(fromTrack('index.html')).toBe('../index.html');
    expect(fromTrack('tracks/index.html')).toBe('index.html');
    expect(fromTrack('assets/site.css')).toBe('../assets/site.css');
    expect(linkFrom('index.html')('tracks/react.html#topics')).toBe('tracks/react.html#topics');
  });

  it('uses root-absolute links for the 404 page', () => {
    expect(linkFrom('404.html', { absolute: true })('tracks/index.html')).toBe('/tracks/index.html');
  });
});
