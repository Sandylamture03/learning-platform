import { z } from 'zod';

/** Limits shared by the sign-up form's HTML attributes and the server-side check. */
export const SIGNUP_LIMITS = {
  nameMax: 100,
  emailMax: 254,
  hoursMin: 1,
  hoursMax: 40,
} as const;

export const StartingLevel = z.enum(['new', 'some', 'interview']);
export type StartingLevel = z.infer<typeof StartingLevel>;

export const STARTING_LEVELS: Record<StartingLevel, string> = {
  new: 'New to coding',
  some: 'I have built a few small things',
  interview: 'Job-ready and preparing for interviews',
};

/**
 * The sign-up form's fields, as the browser posts them (application/x-www-form-urlencoded).
 * Built from the live track list so the form and the check can't drift apart.
 */
export function waitlistSignup(trackIds: readonly [string, ...string[]]) {
  return z.strictObject({
    name: z.string().trim().min(1, 'Enter your name').max(SIGNUP_LIMITS.nameMax),
    email: z.email('Enter an email address like name@example.com').max(SIGNUP_LIMITS.emailMax),
    track: z.enum(trackIds, 'Choose a track'),
    level: z.enum(StartingLevel.options, 'Choose where you are starting from'),
    hoursPerWeek: z.coerce
      .number('Enter a number of hours')
      .int('Enter a whole number of hours')
      .min(SIGNUP_LIMITS.hoursMin)
      .max(SIGNUP_LIMITS.hoursMax),
    updates: z.literal('yes', 'Tick the box so we can email you'),
  });
}

export type WaitlistSignup = z.infer<ReturnType<typeof waitlistSignup>>;
