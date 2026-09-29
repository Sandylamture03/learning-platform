// Runtime behaviour is checked by `pnpm test`; the lines marked @ts-expect-error are checked by `pnpm typecheck`,
// which fails if the types allow an impossible state.
import { describe, expect, it } from 'vitest';
import { describeRequest, type RequestEvent, type RequestState, requestReducer } from './solution.ts';

type Names = readonly string[];
const run = (events: RequestEvent<Names>[]) =>
  events.reduce<RequestState<Names>>((state, event) => requestReducer(state, event), { status: 'idle' });

describe('requestReducer', () => {
  it('goes from idle to loading to success', () => {
    expect(run([{ type: 'start' }])).toEqual({ status: 'loading' });
    expect(run([{ type: 'start' }, { type: 'succeed', data: ['Asha'] }])).toEqual({
      status: 'success',
      data: ['Asha'],
    });
  });

  it('goes from loading to error, and starts again from there', () => {
    const failed = run([{ type: 'start' }, { type: 'fail', error: 'Network down' }]);
    expect(failed).toEqual({ status: 'error', error: 'Network down' });
    expect(requestReducer(failed, { type: 'start' })).toEqual({ status: 'loading' });
  });

  it('ignores an answer that arrives when nothing is loading', () => {
    expect(run([{ type: 'succeed', data: ['Asha'] }])).toEqual({ status: 'idle' });
    expect(run([{ type: 'start' }, { type: 'reset' }, { type: 'fail', error: 'Late' }])).toEqual({ status: 'idle' });
    const done = run([{ type: 'start' }, { type: 'succeed', data: ['Asha'] }]);
    expect(requestReducer(done, { type: 'succeed', data: ['Ben'] })).toBe(done);
  });
});

describe('describeRequest', () => {
  it('describes every state', () => {
    expect(describeRequest({ status: 'idle' })).toBe('Not loaded yet');
    expect(describeRequest({ status: 'loading' })).toBe('Loading…');
    expect(describeRequest({ status: 'success', data: [] })).toBe('No results');
    expect(describeRequest({ status: 'success', data: ['Asha'] })).toBe('1 result');
    expect(describeRequest({ status: 'success', data: ['Asha', 'Ben', 'Chen'] })).toBe('3 results');
    expect(describeRequest({ status: 'error', error: 'Network down' })).toBe('Failed: Network down');
  });

  it('cannot even express an impossible state (checked by tsc)', () => {
    // @ts-expect-error: a loading request has no data yet
    const loadingWithData: RequestState<Names> = { status: 'loading', data: [] };
    // @ts-expect-error: a successful request always has its data
    const successWithoutData: RequestState<Names> = { status: 'success' };
    // @ts-expect-error: an error always says what went wrong
    const errorWithoutMessage: RequestState<Names> = { status: 'error' };
    // @ts-expect-error: there is no 'done' state
    const unknownStatus: RequestState<Names> = { status: 'done' };
    expect([loadingWithData, successWithoutData, errorWithoutMessage, unknownStatus]).toHaveLength(4);
  });
});
