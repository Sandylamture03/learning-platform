// Check a sign-up form's body with Zod before anything else sees it.
import { z } from 'zod';

// TODO: name, email, password, age (optional) and newsletter (a default), with the messages from the prompt.
export const SignUp = z.strictObject({});

/**
 * { ok: true, data } with the cleaned data, or { ok: false, fields } with one message per field,
 * keyed by the field's name ("body" for a problem with the whole object).
 */
export function parseSignUp(body) {
  return { ok: false, fields: {} };
}
