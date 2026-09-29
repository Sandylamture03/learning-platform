// Runtime behaviour is checked by `pnpm test`; the type assertions are checked by `pnpm typecheck`.
import { describe, expect, expectTypeOf, it } from 'vitest';
import { type Cell, formatCell, isUser, type User } from './solution.ts';

describe('formatCell', () => {
  it('shows a dash for null, undefined and empty text', () => {
    expect([null, undefined, '', '   '].map(formatCell)).toEqual(['—', '—', '—', '—']);
  });

  it('shows numbers with thousands separators, and keeps 0', () => {
    expect(formatCell(1234.5)).toBe('1,234.5');
    expect(formatCell(0)).toBe('0');
    expect(formatCell(-1500)).toBe('-1,500');
  });

  it('shows booleans as Yes or No, false included', () => {
    expect(formatCell(true)).toBe('Yes');
    expect(formatCell(false)).toBe('No');
  });

  it('shows dates as YYYY-MM-DD and trims other text', () => {
    expect(formatCell(new Date(Date.UTC(2026, 8, 29, 23, 30)))).toBe('2026-09-29');
    expect(formatCell('  Asha  ')).toBe('Asha');
  });
});

describe('isUser', () => {
  it('accepts an object with a number id and a string name', () => {
    expect(isUser({ id: 1, name: 'Asha' })).toBe(true);
    expect(isUser({ id: 1, name: 'Asha', email: 'asha@example.com' })).toBe(true);
  });

  it('rejects null, other types and objects with missing or wrong fields', () => {
    for (const value of [null, undefined, 'Asha', 42, [], {}, { id: '1', name: 'Asha' }, { id: 1 }, { name: 'Asha' }]) {
      expect(isUser(value), JSON.stringify(value)).toBe(false);
    }
  });

  it('takes any Cell, and narrows unknown data to a User (checked by tsc)', () => {
    expectTypeOf(formatCell).parameter(0).toEqualTypeOf<Cell>();
    const data: unknown = JSON.parse('{"id":1,"name":"Asha"}');
    if (isUser(data)) expectTypeOf(data).toEqualTypeOf<User>();
    expect(isUser(data)).toBe(true);
  });
});
