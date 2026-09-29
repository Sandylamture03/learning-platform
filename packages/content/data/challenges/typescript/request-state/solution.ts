/** A request's state: exactly four, and each carries only the data it has. */
export type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

/** What can happen to a request. */
export type RequestEvent<T> =
  | { type: 'start' }
  | { type: 'succeed'; data: T }
  | { type: 'fail'; error: string }
  | { type: 'reset' };

/**
 * The next state. 'start' always leads to loading and 'reset' to idle. 'succeed' and 'fail' count only while
 * loading: an answer that arrives after a reset or a new start is stale, so the state stays as it is.
 */
export function requestReducer<T>(state: RequestState<T>, event: RequestEvent<T>): RequestState<T> {
  switch (event.type) {
    case 'start':
      return { status: 'loading' };
    case 'reset':
      return { status: 'idle' };
    case 'succeed':
      return state.status === 'loading' ? { status: 'success', data: event.data } : state;
    case 'fail':
      return state.status === 'loading' ? { status: 'error', error: event.error } : state;
    default: {
      // Every event type is handled above, so this is never reached; a new event type makes this a compile error.
      const unhandled: never = event;
      return unhandled;
    }
  }
}

/** "Not loaded yet", "Loading…", "No results", "1 result", "3 results" or "Failed: <error>". */
export function describeRequest(state: RequestState<readonly string[]>): string {
  switch (state.status) {
    case 'idle':
      return 'Not loaded yet';
    case 'loading':
      return 'Loading…';
    case 'success': {
      const count = state.data.length; // data exists only here, and TypeScript knows it
      return count === 0 ? 'No results' : count === 1 ? '1 result' : `${count} results`;
    }
    case 'error':
      return `Failed: ${state.error}`;
  }
}
