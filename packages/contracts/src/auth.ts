import { z } from 'zod';

/** Limits shared by the account forms' HTML attributes and the API's check. */
export const ACCOUNT_LIMITS = {
  nameMax: 100,
  emailMax: 254,
  /** NIST SP 800-63B: at least 8 characters, and no rules about which characters. */
  passwordMin: 8,
  /** Long enough for any passphrase, short enough that hashing it stays cheap. */
  passwordMax: 128,
} as const;

/** An email address, trimmed and lowercased so each address has one account. */
const Email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter an email address like name@example.com').max(ACCOUNT_LIMITS.emailMax));

/** The body of POST /api/auth/sign-up. */
export const SignUp = z.strictObject({
  name: z.string().trim().min(1, 'Enter your name').max(ACCOUNT_LIMITS.nameMax),
  email: Email,
  password: z
    .string()
    .min(ACCOUNT_LIMITS.passwordMin, `Use at least ${ACCOUNT_LIMITS.passwordMin} characters`)
    .max(ACCOUNT_LIMITS.passwordMax, `Use at most ${ACCOUNT_LIMITS.passwordMax} characters`),
});
export type SignUp = z.infer<typeof SignUp>;

/** The body of POST /api/auth/sign-in. */
export const SignIn = z.strictObject({
  email: Email,
  password: z.string().min(1, 'Enter your password').max(ACCOUNT_LIMITS.passwordMax),
});
export type SignIn = z.infer<typeof SignIn>;

/** A learner's account, as the API shows it. The password never leaves the server. */
export interface User {
  id: string;
  name: string;
  email: string;
}

/** GET /api/me, and the answer to signing up or in: who is signed in, if anyone. */
export interface Me {
  user: User | null;
}
