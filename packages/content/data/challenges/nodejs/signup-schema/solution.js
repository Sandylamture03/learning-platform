// Check a sign-up form's body with Zod before anything else sees it.
import { z } from 'zod';

export const SignUp = z.strictObject({
  name: z.string().trim().min(1, 'Enter your name').max(100, 'Use at most 100 characters'),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter an email address like name@example.com')),
  password: z.string().min(8, 'Use at least 8 characters').max(128, 'Use at most 128 characters'),
  // Forms send numbers as text, so coerce; and it may be left out.
  age: z.coerce.number().int('Enter a whole number').min(13, 'You must be 13 or older').max(120).optional(),
  newsletter: z.boolean().default(false),
});

/**
 * { ok: true, data } with the cleaned data, or { ok: false, fields } with one message per field,
 * keyed by the field's name ("body" for a problem with the whole object).
 */
export function parseSignUp(body) {
  const result = SignUp.safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  const fields = {};
  for (const issue of result.error.issues) fields[issue.path.join('.') || 'body'] ??= issue.message;
  return { ok: false, fields };
}
