## Tables, rows and keys

A relational database keeps data in **tables**: each row is one thing, each column one fact about it, and every column has a type. PostgreSQL is the most popular choice for new Node.js projects: free, strict about types, and able to do far more than most apps ask of it.

```sql
CREATE TABLE projects (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE tasks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

The **primary key** identifies each row. A **foreign key** (`REFERENCES`) links a task to its project, and the database refuses a task for a project that doesn't exist. `NOT NULL`, `UNIQUE` and `CHECK` are **constraints**: rules the database enforces for every write, from every part of your code, forever. Put a rule in a constraint and a bug elsewhere can't break it.

## The four queries you write every day

```sql
INSERT INTO tasks (project_id, title) VALUES (1, 'Write the report') RETURNING id, title, done;
SELECT id, title FROM tasks WHERE project_id = 1 AND NOT done ORDER BY created_at LIMIT 20;
UPDATE tasks SET done = true WHERE id = 42;
DELETE FROM tasks WHERE id = 42;
```

`RETURNING` hands back the rows an `INSERT`, `UPDATE` or `DELETE` touched, so you get the new id without a second query. An `UPDATE` or `DELETE` without a `WHERE` touches every row: read those twice before running them.

## Joins

A **join** combines rows from two tables on a condition, usually a foreign key. `GROUP BY` then folds rows into one per group, with aggregates such as `count`:

```sql
SELECT p.name, count(t.id) AS open_tasks
FROM projects p
LEFT JOIN tasks t ON t.project_id = p.id AND NOT t.done
GROUP BY p.id, p.name
ORDER BY p.name;
```

`LEFT JOIN` keeps projects that have no matching tasks, with `count` of 0; an inner `JOIN` would drop them.

## Parameters, never string building

From Node.js, the `pg` package (node-postgres) sends queries. **Values always go in as parameters,** `$1`, `$2` and so on, never pasted into the SQL text:

```js
// Safe: the database receives the SQL and the values separately.
const { rows } = await db.query('SELECT id, title FROM tasks WHERE project_id = $1 AND title ILIKE $2', [
  projectId,
  `%${search}%`,
]);

// SQL injection: a search of  %' OR true --  returns every row in the table.
await db.query(`SELECT id, title FROM tasks WHERE title ILIKE '%${search}%'`);
```

A parameter is only ever a value, so no input can change what the query does. This one habit removes SQL injection, one of the most common and most damaging web vulnerabilities.

## Transactions and constraints

A **transaction** groups statements so they all happen or none do: moving money between accounts must never do half. In `pg`, a transaction needs one connection from the pool for all its statements:

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, from]);
  await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, to]);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

Constraints and transactions together handle races that application code can't: two sign-ups with the same email at the same moment both pass a "does it exist?" check, but only one gets past `UNIQUE`. Handle it in one statement with `INSERT … ON CONFLICT DO NOTHING RETURNING id`, and treat no row back as "taken".

## Migrations

The schema changes as the app grows, and every copy of the database (yours, a teammate's, CI's, production's) must change the same way. A **migration** is one numbered change, usually a SQL file such as `004_add_due_date.sql`, applied once in order and recorded in a table. Never edit a migration that has run somewhere: add a new one.

## ORMs such as Prisma

An **ORM** maps tables to objects in code. **Prisma** reads a schema file, generates a typed client (`prisma.task.findMany({ where: { projectId, done: false } })`), and writes migrations for you with `prisma migrate dev`. Drizzle and Kysely are lighter, SQL-shaped alternatives. ORMs save typing and give you types; they don't replace knowing SQL, because you still need to read the queries they generate, add indexes, and write the report query the ORM makes awkward.

## Mistakes that cost time

- **Building SQL with template strings.** Always parameters.
- **Checks in code that belong in constraints,** such as "emails are unique", which break under concurrent requests.
- **The N+1 query:** loading 50 projects, then running one query per project for its tasks. Use a join, or one query with `WHERE project_id = ANY($1)`.
- **A transaction across `pool.query` calls,** which may each use a different connection.
- **No index on columns you filter by,** which is fine with 100 rows and painful with a million.
- **Surprise strings:** `pg` returns `bigint` columns, including every `count(…)`, as strings, because they can be larger than a JavaScript number can hold. Cast small counts with `count(*)::int`.

## Say it in an interview

“I model data as tables with primary and foreign keys, and put rules in constraints (NOT NULL, UNIQUE, CHECK, foreign keys) so the database enforces them for every write. I always pass values as query parameters, which rules out SQL injection, and I use transactions when several writes must succeed or fail together. Schema changes go through numbered migrations that run the same way everywhere. I'm happy with an ORM like Prisma for everyday queries and types, but I read the SQL it generates and drop to plain SQL for reports and tricky joins.”
