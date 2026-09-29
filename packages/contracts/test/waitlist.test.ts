import { describe, expect, it } from 'vitest';
import { waitlistSignup } from '../src/index.ts';

const Signup = waitlistSignup(['html-css', 'javascript']);
const form = {
  name: 'Asha',
  email: 'asha@example.com',
  track: 'html-css',
  level: 'new',
  hoursPerWeek: '10',
  updates: 'yes',
};

describe('waitlistSignup', () => {
  it('accepts the form as the browser posts it', () => {
    expect(Signup.parse(form)).toEqual({ ...form, hoursPerWeek: 10 });
  });

  it('rejects a bad email, an unknown track and too many hours', () => {
    const result = Signup.safeParse({ ...form, email: 'asha', track: 'cobol', hoursPerWeek: '80' });
    expect(result.error?.issues.map((i) => i.path[0])).toEqual(['email', 'track', 'hoursPerWeek']);
  });

  it('requires the consent box', () => {
    const { updates: _, ...withoutConsent } = form;
    expect(Signup.safeParse(withoutConsent).error?.issues[0]?.message).toBe('Tick the box so we can email you');
  });
});
