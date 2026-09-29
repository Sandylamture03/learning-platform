/** The board's columns, in order. `as const` keeps each one's literal type and makes the array read-only. */
export const STATUSES = ['todo', 'doing', 'done'] as const;

/** 'todo' | 'doing' | 'done', derived from STATUSES, so the list and the type can never disagree. */
export type TaskStatus = (typeof STATUSES)[number];

/** True when a string from a URL or a form is one of the statuses. */
export function isTaskStatus(value: string): value is TaskStatus {
  // includes() on a readonly tuple only takes its own members, so widen the array to strings first.
  return (STATUSES as readonly string[]).includes(value);
}

/** The next column to the right; 'done' stays 'done'. */
export function nextStatus(status: TaskStatus): TaskStatus {
  const index = STATUSES.indexOf(status);
  return STATUSES[Math.min(index + 1, STATUSES.length - 1)] ?? status;
}

// A Record keyed by the union must list every status: add one to STATUSES and this stops compiling.
const LABELS: Record<TaskStatus, string> = { todo: 'To do', doing: 'In progress', done: 'Done' };

/** The column's heading: "To do", "In progress" or "Done". */
export function statusLabel(status: TaskStatus): string {
  return LABELS[status];
}
