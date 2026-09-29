/**
 * A request's state. Replace these separate fields with a discriminated union of four states, tagged by
 * `status`: 'idle'; 'loading'; 'success', which has `data: T`; and 'error', which has `error: string`.
 */
export interface RequestState<T> {
  status: string;
  data?: T;
  error?: string;
}

/**
 * What can happen to a request, also a discriminated union, tagged by `type`: 'start'; 'succeed', which has
 * `data: T`; 'fail', which has `error: string`; and 'reset'.
 */
export interface RequestEvent<T> {
  type: string;
  data?: T;
  error?: string;
}

/**
 * The next state. 'start' always leads to loading and 'reset' to idle. 'succeed' and 'fail' count only while
 * loading: an answer that arrives after a reset or a new start is stale, so the state stays as it is.
 */
export function requestReducer<T>(state: RequestState<T>, event: RequestEvent<T>): RequestState<T> {
  throw new Error('Write requestReducer');
}

/** "Not loaded yet", "Loading…", "No results", "1 result", "3 results" or "Failed: <error>". */
export function describeRequest(state: RequestState<readonly string[]>): string {
  throw new Error('Write describeRequest');
}
