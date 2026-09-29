// Runtime behaviour is checked by `pnpm test`; the type assertions and the lines marked @ts-expect-error are
// checked by `pnpm typecheck`, which fails if the types are wider than they should be.
import { describe, expect, expectTypeOf, it } from 'vitest';
import { isTaskStatus, nextStatus, STATUSES, statusLabel, type TaskStatus } from './solution.ts';

describe('task statuses', () => {
  it('lists the three statuses in board order', () => {
    expect(STATUSES).toEqual(['todo', 'doing', 'done']);
  });

  it('recognises a status in a string from outside, and rejects anything else', () => {
    expect(['todo', 'doing', 'done'].every(isTaskStatus)).toBe(true);
    expect(isTaskStatus('archived')).toBe(false);
    expect(isTaskStatus('Todo')).toBe(false);
    expect(isTaskStatus('')).toBe(false);
  });

  it('moves a task one column to the right, and leaves a done task done', () => {
    expect(nextStatus('todo')).toBe('doing');
    expect(nextStatus('doing')).toBe('done');
    expect(nextStatus('done')).toBe('done');
  });

  it('labels each column', () => {
    expect(STATUSES.map(statusLabel)).toEqual(['To do', 'In progress', 'Done']);
  });

  it('derives TaskStatus from STATUSES and narrows with the guard (checked by tsc)', () => {
    expectTypeOf<TaskStatus>().toEqualTypeOf<'todo' | 'doing' | 'done'>();
    const fromUrl: string = new URLSearchParams('status=doing').get('status') ?? '';
    if (isTaskStatus(fromUrl)) expectTypeOf(fromUrl).toEqualTypeOf<TaskStatus>();
    // @ts-expect-error: 'archived' is not a status
    const archived: TaskStatus = 'archived';
    expect(archived).toBe('archived');
  });
});
