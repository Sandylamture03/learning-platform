import { describe, expect, it } from 'vitest';
import { processInChunks } from './solution.js';

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('processInChunks', () => {
  it('resolves with every result, in order', async () => {
    await expect(processInChunks([1, 2, 3, 4, 5], (n) => n * 10, 2)).resolves.toEqual([10, 20, 30, 40, 50]);
  });

  it('runs the first chunk straight away and one chunk per task after that', async () => {
    const handled = [];
    const done = processInChunks([1, 2, 3, 4, 5], (n) => handled.push(n), 2);
    expect(handled).toEqual([1, 2]);
    await nextTask();
    expect(handled).toEqual([1, 2, 3, 4]);
    await nextTask();
    expect(handled).toEqual([1, 2, 3, 4, 5]);
    await done;
  });

  it('lets a task that arrived during a chunk run before the next chunk', async () => {
    const log = [];
    await processInChunks(
      ['a', 'b', 'c', 'd'],
      (item) => {
        log.push(item);
        // Stands in for a click that happens while the first chunk is running.
        if (item === 'a') setTimeout(() => log.push('click'), 0);
      },
      2,
    );
    expect(log).toEqual(['a', 'b', 'click', 'c', 'd']);
  });

  it('resolves with an empty array when there are no items', async () => {
    await expect(processInChunks([], (n) => n, 3)).resolves.toEqual([]);
  });

  it('rejects when handle throws', async () => {
    const broken = () => {
      throw new Error('Bad item');
    };
    await expect(processInChunks([1], broken, 1)).rejects.toThrow('Bad item');
  });
});
