/**
 * Events between UI modules. Names are versioned, and payloads carry ids, never whole objects,
 * so a module can change its internals without breaking its listeners.
 */
export type PlatformEvents = {
  'topic.opened.v1': { trackId: string; topicId: string };
  'topic.completed.v1': { trackId: string; topicId: string; score: number };
  'review.due.v1': { count: number };
  'session.signed-out.v1': Record<string, never>;
};

export function createEventBus<E extends Record<string, object>>(target: EventTarget = new EventTarget()) {
  return {
    emit<K extends keyof E & string>(type: K, detail: E[K]): void {
      target.dispatchEvent(new CustomEvent(type, { detail }));
    },
    /** Returns the unsubscribe function; call it when the module unmounts. */
    on<K extends keyof E & string>(type: K, handler: (detail: E[K]) => void): () => void {
      const listener = (event: Event) => handler((event as CustomEvent<E[K]>).detail);
      target.addEventListener(type, listener);
      return () => target.removeEventListener(type, listener);
    },
  };
}

export type EventBus = ReturnType<typeof createEventBus<PlatformEvents>>;
