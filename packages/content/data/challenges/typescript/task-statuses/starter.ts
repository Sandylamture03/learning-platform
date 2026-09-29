/** The board's columns, in order: 'todo', 'doing', 'done'. Keep their literal types. */
export const STATUSES = ['todo', 'doing', 'done'];

/** Derive this from STATUSES, so the list and the type can never disagree. */
export type TaskStatus = string;

/** True when a string from a URL or a form is one of the statuses. */
export function isTaskStatus(value: string): value is TaskStatus {
  throw new Error('Write isTaskStatus');
}

/** The next column to the right; 'done' stays 'done'. */
export function nextStatus(status: TaskStatus): TaskStatus {
  throw new Error('Write nextStatus');
}

/** The column's heading: "To do", "In progress" or "Done". */
export function statusLabel(status: TaskStatus): string {
  throw new Error('Write statusLabel');
}
