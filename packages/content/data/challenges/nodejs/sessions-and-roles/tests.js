import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { hashPassword, newSessionToken, requireRole, verifyPassword } from './solution.js';

describe('passwords', () => {
  it('hash to "salt:hash" in hex, with a new salt every time, and never contain the password', async () => {
    const one = await hashPassword('correct horse battery');
    const two = await hashPassword('correct horse battery');
    expect(one).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);
    expect(one).not.toBe(two);
    expect(one).not.toContain('horse');
  });

  it('verify the right password only', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', stored)).toBe(true);
    expect(await verifyPassword('Correct horse battery', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('say false, instead of throwing, for a stored value that is not a hash', async () => {
    for (const stored of ['', 'plain text', 'abc:def', `${'0'.repeat(32)}:${'f'.repeat(10)}`, undefined]) {
      expect(await verifyPassword('anything', stored), String(stored)).toBe(false);
    }
  });
});

describe('newSessionToken', () => {
  it('makes a random 32-byte token for the cookie, and its SHA-256 for the database', () => {
    const { token, tokenHash } = newSessionToken();
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(newSessionToken().token).not.toBe(token);
  });
});

describe('requireRole', () => {
  /** A stand-in for Express's res that records what was sent. */
  function fakeResponse() {
    const res = { statusCode: 200, body: undefined };
    res.status = (code) => Object.assign(res, { statusCode: code });
    res.json = (body) => Object.assign(res, { body });
    return res;
  }

  it('answers 401 when nobody is signed in', () => {
    const res = fakeResponse();
    const next = vi.fn();
    requireRole('admin')({}, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: expect.any(String) });
    expect(next).not.toHaveBeenCalled();
  });

  it('answers 403 when the learner is signed in but has another role', () => {
    const res = fakeResponse();
    const next = vi.fn();
    requireRole('admin', 'editor')({ user: { id: 7, role: 'member' } }, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('lets the request through, untouched, for an allowed role', () => {
    const res = fakeResponse();
    const next = vi.fn();
    requireRole('admin', 'editor')({ user: { id: 7, role: 'editor' } }, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.body).toBeUndefined();
  });
});
