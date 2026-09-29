import { describe, expect, it } from 'vitest';
import { parseSignUp } from './solution.js';

const valid = { name: 'Asha Rao', email: 'asha@example.com', password: 'correct horse battery' };

describe('parseSignUp', () => {
  it('returns the cleaned data: trimmed, the email lowercased, and newsletter defaulting to false', () => {
    expect(parseSignUp({ ...valid, name: '  Asha Rao ', email: ' Asha@Example.COM ' })).toEqual({
      ok: true,
      data: { name: 'Asha Rao', email: 'asha@example.com', password: 'correct horse battery', newsletter: false },
    });
  });

  it('turns an age sent as text into a number, and leaves out an age that was not sent', () => {
    expect(parseSignUp({ ...valid, age: '27', newsletter: true })).toEqual({
      ok: true,
      data: { ...valid, age: 27, newsletter: true },
    });
    expect(parseSignUp(valid).data).not.toHaveProperty('age');
  });

  it('names each field’s problem, with a message a person can act on', () => {
    expect(parseSignUp({ name: '   ', email: 'asha@', password: 'short', age: '12' })).toEqual({
      ok: false,
      fields: {
        name: 'Enter your name',
        email: 'Enter an email address like name@example.com',
        password: 'Use at least 8 characters',
        age: 'You must be 13 or older',
      },
    });
  });

  it('refuses fields it does not know, so nobody can sign themselves up as an admin', () => {
    const result = parseSignUp({ ...valid, role: 'admin' });
    expect(result.ok).toBe(false);
    expect(Object.keys(result.fields)).toEqual(['body']);
    expect(result.fields.body).toContain('role');
  });

  it('refuses a body that is not an object at all, without throwing', () => {
    expect(parseSignUp(null).ok).toBe(false);
    expect(parseSignUp('name=Asha').ok).toBe(false);
  });

  it('caps the length of the name and the password', () => {
    expect(parseSignUp({ ...valid, name: 'x'.repeat(101) }).fields).toEqual({ name: 'Use at most 100 characters' });
    expect(parseSignUp({ ...valid, password: 'x'.repeat(129) }).fields).toEqual({
      password: 'Use at most 128 characters',
    });
  });
});
