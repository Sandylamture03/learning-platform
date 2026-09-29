// Queries for a task tracker. `db` works like a pg Pool: db.query(text, values) resolves to { rows, rowCount }.
// The tables:
//   projects (id integer PRIMARY KEY, name text NOT NULL UNIQUE)
//   tasks    (id integer PRIMARY KEY, project_id integer NOT NULL REFERENCES projects, title text NOT NULL,
//             done boolean NOT NULL DEFAULT false)

/** Adds a task and returns it as { id, projectId, title, done }. */
export async function createTask(db, { projectId, title }) {
  throw new Error('Write createTask');
}

/** A project's tasks in id order; pass { done: true } or { done: false } to keep only those. */
export async function listTasks(db, projectId, { done } = {}) {
  throw new Error('Write listTasks');
}

/** Marks a task done. True when there was such a task. */
export async function completeTask(db, id) {
  throw new Error('Write completeTask');
}

/** Every project, by name, with how many of its tasks are open and done: [{ name, open, done }]. */
export async function projectSummary(db) {
  throw new Error('Write projectSummary');
}

/** Renames a project: 'renamed', 'taken' when another project has that name, or 'missing'. */
export async function renameProject(db, id, name) {
  throw new Error('Write renameProject');
}
