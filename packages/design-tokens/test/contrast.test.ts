import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');
const [lightPart = '', darkPart = ''] = css.split('@media (prefers-color-scheme: dark)');

function colours(part: string): Record<string, string> {
  return Object.fromEntries([...part.matchAll(/--(color-[a-z0-9-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]]));
}

const light = colours(lightPart);
const themes = { light, dark: { ...light, ...colours(darkPart) } };

/** WCAG 2 relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum ratio]: 4.5 for text, 3 for borders of form controls.
const PAIRS: [string, string, number][] = [
  ['color-text', 'color-bg', 4.5],
  ['color-text', 'color-surface', 4.5],
  ['color-text', 'color-surface-sunken', 4.5],
  ['color-text-muted', 'color-bg', 4.5],
  ['color-text-muted', 'color-surface', 4.5],
  ['color-text-muted', 'color-surface-sunken', 4.5],
  ['color-accent', 'color-bg', 4.5],
  ['color-accent', 'color-surface', 4.5],
  ['color-accent', 'color-accent-soft', 4.5],
  ['color-on-accent', 'color-accent', 4.5],
  ['color-on-accent', 'color-accent-hover', 4.5],
  ['color-danger', 'color-bg', 4.5],
  ['color-danger', 'color-surface', 4.5],
  ['color-success', 'color-surface', 4.5],
  ['color-p0-text', 'color-p0-bg', 4.5],
  ['color-p1-text', 'color-p1-bg', 4.5],
  ['color-badge-text', 'color-badge-bg', 4.5],
  ['color-border-strong', 'color-surface', 3],
  ['color-border-strong', 'color-bg', 3],
];

describe.each(Object.entries(themes))('%s theme', (_, theme) => {
  it.each(PAIRS)('%s on %s meets %s:1', (fg, bg, min) => {
    const [a, b] = [theme[fg], theme[bg]];
    expect(a, fg).toBeDefined();
    expect(b, bg).toBeDefined();
    expect(contrast(a ?? '', b ?? '')).toBeGreaterThanOrEqual(min);
  });
});
