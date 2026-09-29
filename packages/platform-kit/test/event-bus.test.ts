import { describe, expect, it, vi } from 'vitest';
import { createEventBus, type PlatformEvents } from '../src/index.ts';

describe('createEventBus', () => {
  it('delivers typed payloads to listeners', () => {
    const bus = createEventBus<PlatformEvents>();
    const seen = vi.fn();
    bus.on('topic.completed.v1', seen);
    bus.emit('topic.completed.v1', { trackId: 'react', topicId: 'useeffect', score: 0.9 });
    expect(seen).toHaveBeenCalledWith({ trackId: 'react', topicId: 'useeffect', score: 0.9 });
  });

  it('stops delivering after unsubscribe', () => {
    const bus = createEventBus<PlatformEvents>();
    const seen = vi.fn();
    const off = bus.on('review.due.v1', seen);
    off();
    bus.emit('review.due.v1', { count: 3 });
    expect(seen).not.toHaveBeenCalled();
  });
});
