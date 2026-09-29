## Never trust the body

Everything a client sends (the body, the query string, path parameters, headers, cookies) is whatever the client chose to send. A browser form has checks, but anyone can call your API with `curl` and skip them. So the server checks every input again, at the edge, before it reaches your logic or your database.

Unchecked input causes two kinds of trouble. **Bugs:** a missing field becomes `undefined` deep in your code, or `"5"` gets added to a number as a string. **Security holes:** an extra `"role": "admin"` field saved straight into the database (mass assignment), a 10 MB string in a name field, or text that ends up inside SQL, as in [the SQL lesson](lesson:sql-postgresql-prisma).

## A schema is the check and the type

Writing checks by hand, as in [the narrowing lesson](lesson:narrowing), works for two fields and turns into a mess at ten. A **schema library** such as Zod describes the shape once, and gives you both the runtime check and, in TypeScript, the type:

```ts
import { z } from 'zod';

const NewTask = z.strictObject({
  title: z.string().trim().min(1, 'Enter a title').max(200),
  dueDate: z.iso.date().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

type NewTask = z.infer<typeof NewTask>; // { title: string; dueDate?: string; priority: 'low' | 'normal' | 'high' }
```

- `schema.parse(data)` returns the checked data or throws a `ZodError`.
- `schema.safeParse(data)` never throws: it returns `{ success: true, data }` or `{ success: false, error }`. Prefer it at an API's edge, where bad input is normal, not exceptional.
- The data you get back is **cleaned**: trimmed, defaults filled in, and with `z.strictObject` unknown keys are refused. Use the parsed value, never the original body.

## Validating at the edge

Check input once, where it enters, and let the rest of the code trust it. In Express that is a small middleware or a helper at the top of each handler:

```js
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Check the fields and try again', fields: fieldErrors(result.error) });
    }
    req.body = result.data;
    next();
  };
}

app.post('/api/tasks', validate(NewTask), createTask);
```

The query string and path parameters are always strings, so schemas for them **coerce**: `z.coerce.number().int().min(1).default(1)` turns `?page=2` into the number `2`, and refuses `?page=two`.

## Error messages people can act on

A `ZodError` has an `issues` array; each issue has a `path` (such as `['email']`) and a `message`. Turn them into one message per field, so a form can show each one beside its input:

```js
function fieldErrors(error) {
  const fields = {};
  for (const issue of error.issues) fields[issue.path.join('.') || 'body'] ??= issue.message;
  return fields;
}
```

Write messages that say what to do ("Enter an email address like name@example.com"), not what went wrong in the parser ("Invalid string").

## Mistakes that cost time

- **Validating in the browser only.** It helps people; it protects nothing.
- **Using `req.body` after validating,** instead of the parsed data, and losing the trimming and defaults.
- **`z.object` where you meant `z.strictObject`:** `z.object` drops unknown keys silently, which is fine for reading, but refusing them catches typos and mass-assignment attempts.
- **No limits:** every string needs a `max`, and the body parser needs a size limit (`express.json({ limit: '10kb' })`).
- **Checking the shape but not the meaning:** a valid `taskId` can still belong to someone else. That is authorization, in [the auth lesson](lesson:auth).

## Say it in an interview

“I treat every input as untrusted and validate it once at the edge, before any logic or database code sees it. I describe the shape with a schema library like Zod, which gives me the runtime check and the TypeScript type from one definition. I use safeParse so bad input becomes a 400 with one message per field, strict objects so unknown keys are refused, coercion for query strings, and length limits everywhere. Then the rest of the code works with the parsed, cleaned data, never the raw body.”
