/** Everything a cell in the data table can hold. */
export type Cell = string | number | boolean | Date | null | undefined;

/**
 * The text a cell shows: "—" for null, undefined or an empty string; a number with thousands separators
 * (1234.5 -> "1,234.5"); "Yes" or "No" for a boolean; a date as YYYY-MM-DD (in UTC); any other string trimmed.
 */
export function formatCell(value: Cell): string {
  if (value == null) return '—'; // == null matches both null and undefined
  if (typeof value === 'number') return value.toLocaleString('en');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  // Only string is left. An explicit check, not `if (!value)`, which would also catch 0 and false above.
  const text = value.trim();
  return text === '' ? '—' : text;
}

export interface User {
  id: number;
  name: string;
}

/** True when unknown data, such as parsed JSON, is a User: an object with a number id and a string name. */
export function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null && // typeof null is 'object'
    'id' in value &&
    typeof value.id === 'number' &&
    'name' in value &&
    typeof value.name === 'string'
  );
}
