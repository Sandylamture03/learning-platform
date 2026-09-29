// Queries for a task tracker. `db` works like a pg Pool: db.query(text, values) resolves to { rows, rowCount }.
// The tables:
//   projects (id integer PRIMARY KEY, name text NOT NULL UNIQUE)
//   tasks    (id integer PRIMARY KEY, project_id integer NOT NULL REFERENCES projects, title text NOT NULL,
//             done boolean NOT NULL DEFAULT false)

/** Postgres's error code for a broken UNIQUE constraint. */
const UNIQUE_VIOLATION = '23505';

/** Adds a task and returns it as { id, projectId, title, done }. */
export async function createTask(db, { projectId, title }) {
  const { rows } = await db.query(
    `INSERT INTO tasks (project_id, title) VALUES ($1, $2)
     RETURNING id, project_id AS "projectId", title, done`,
    [projectId, title],
  );
  return rows[0];
}

/** A project's tasks in id order; pass { done: true } or { done: false } to keep only those. */
export async function listTasks(db, projectId, { done } = {}) {
  // One query either way: a null parameter means "don't filter on done".
  const { rows } = await db.query(
    `SELECT id, project_id AS "projectId", title, done FROM tasks
      WHERE project_id = $1 AND ($2::boolean IS NULL OR done = $2)
      ORDER BY id`,
    [projectId, done ?? null],
  );
  return rows;
}

/** Marks a task done. True when there was such a task. */
export async function completeTask(db, id) {
  const { rowCount } = await db.query('UPDATE tasks SET done = true WHERE id = $1', [id]);
  return rowCount === 1;
}

/** Every project, by name, with how many of its tasks are open and done: [{ name, open, done }]. */
export async function projectSummary(db) {
  // count() is a bigint, which pg returns as a string; ::int makes it a number.
  const { rows } = await db.query(
    `SELECT p.name,
            count(t.id) FILTER (WHERE NOT t.done)::int AS open,
            count(t.id) FILTER (WHERE t.done)::int AS done
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id
      GROUP BY p.id, p.name
      ORDER BY p.name`,
  );
  return rows;
}

/** Renames a project: 'renamed', 'taken' when another project has that name, or 'missing'. */
export async function renameProject(db, id, name) {
  try {
    const { rowCount } = await db.query('UPDATE projects SET name = $1 WHERE id = $2', [name, id]);
    return rowCount === 1 ? 'renamed' : 'missing';
  } catch (error) {
    // The UNIQUE constraint decides, so two renames at the same moment can't both win.
    if (error.code === UNIQUE_VIOLATION) return 'taken';
    throw error;
  }
}
