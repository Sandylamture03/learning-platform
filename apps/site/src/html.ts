/**
 * A tiny HTML templating helper: html`<p>${text}</p>` escapes every interpolated value,
 * so content can never inject markup. Nest templates freely; arrays are joined.
 */
export class SafeHtml {
  readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  toString(): string {
    return this.value;
  }
}

export type HtmlValue = SafeHtml | string | number | boolean | null | undefined | readonly HtmlValue[];

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

function render(value: HtmlValue): string {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  // null, undefined and booleans render nothing, so `${condition && html`...`}` works.
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  return escapeHtml(String(value));
}

export function html(strings: TemplateStringsArray, ...values: HtmlValue[]): SafeHtml {
  let out = strings[0] ?? '';
  values.forEach((value, i) => {
    out += render(value) + (strings[i + 1] ?? '');
  });
  return new SafeHtml(out);
}

/** Joins rendered items with a separator: join(links, ', '). */
export function join(items: readonly HtmlValue[], separator: HtmlValue): SafeHtml {
  return html`${items.map((item, i) => html`${i > 0 && separator}${item}`)}`;
}
