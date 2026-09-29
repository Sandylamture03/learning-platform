/** Everything a cell in the data table can hold. */
export type Cell = string | number | boolean | Date | null | undefined;

/**
 * The text a cell shows: "—" for null, undefined or an empty string; a number with thousands separators
 * (1234.5 -> "1,234.5"); "Yes" or "No" for a boolean; a date as YYYY-MM-DD (in UTC); any other string trimmed.
 */
export function formatCell(value: Cell): string {
  throw new Error('Write formatCell');
}

export interface User {
  id: number;
  name: string;
}

/** True when unknown data, such as parsed JSON, is a User: an object with a number id and a string name. */
export function isUser(value: unknown): value is User {
  throw new Error('Write isUser');
}
