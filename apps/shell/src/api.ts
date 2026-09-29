// Server state: the API client and the TanStack Query definitions the pages share.
// Every query key starts with the resource it holds, so invalidating ['progress'] refreshes every view of progress.
import {
  API,
  type ApiError,
  type LessonView,
  type Me,
  type Progress,
  type ProgressUpdate,
  type SignIn,
  type SignUp,
  type TopicProgress,
  type TrackSummary,
  type TrackView,
} from '@lp/contracts';
import { queryOptions, useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';

/** An answer from the API that was not OK, with its status, the API's reason and any field problems. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly fields: Record<string, string>;

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.fields = fields;
  }
}

export const isNotFound = (error: unknown) => error instanceof ApiRequestError && error.status === 404;

/** GETs `path`, or sends `body` as JSON. The session cookie goes along by itself: the API is on this origin. */
async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const response = await fetch(path, {
    ...rest,
    headers: {
      accept: 'application/json',
      ...(json === undefined ? {} : { 'content-type': 'application/json' }),
      ...rest.headers,
    },
    ...(json === undefined ? {} : { body: JSON.stringify(json) }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as ApiError | undefined;
    throw new ApiRequestError(
      response.status,
      body?.error ?? `Request failed: ${response.status} ${path}`,
      body?.fields,
    );
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** Retries network failures and server errors, but not answers such as 404 that will not change. */
export function shouldRetry(failures: number, error: unknown): boolean {
  if (error instanceof ApiRequestError && error.status < 500) return false;
  return failures < 2;
}

export const queries = {
  tracks: () =>
    queryOptions({ queryKey: ['tracks'], queryFn: ({ signal }) => request<TrackSummary[]>(API.tracks, { signal }) }),
  track: (trackId: string) =>
    queryOptions({
      queryKey: ['tracks', trackId],
      queryFn: ({ signal }) => request<TrackView>(API.track(trackId), { signal }),
    }),
  lesson: (topicId: string) =>
    queryOptions({
      queryKey: ['lessons', topicId],
      queryFn: ({ signal }) => request<LessonView>(API.lesson(topicId), { signal }),
    }),
  /** Who is signed in. Signing in, up or out sets it directly, so it never needs refetching on its own. */
  me: () =>
    queryOptions({
      queryKey: ['me'],
      queryFn: ({ signal }) => request<Me>(API.me, { signal }),
      staleTime: Number.POSITIVE_INFINITY,
    }),
  progress: () =>
    queryOptions({
      queryKey: ['progress'],
      queryFn: ({ signal }) => request<Progress>(API.progress, { signal }),
      // Progress changes only when this app sends it; no need to refetch it in the background.
      staleTime: Number.POSITIVE_INFINITY,
    }),
};

/**
 * Who is signed in, and their progress. Progress is only asked for once someone is signed in; until then (and
 * while `me` loads) there is none. `user` is undefined while loading, and null when nobody is signed in.
 */
export function useProgress() {
  const me = useQuery(queries.me());
  // If the API can't say who is signed in, carry on as signed out; the pages say what else failed to load.
  const user = me.isError ? null : me.data?.user;
  const progress = useQuery({ ...queries.progress(), enabled: Boolean(user) });
  const done = new Map((user ? progress.data?.completed : undefined)?.map((p) => [p.topicId, p]));
  return { me, user, progress, done };
}

/** Signs up or in, then shows the new learner's own progress (and nobody else's). */
function useAccountMutation<T>(path: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (details: T) => request<Me>(path, { method: 'POST', json: details }),
    onSuccess: (me) => {
      client.removeQueries({ queryKey: queries.progress().queryKey });
      client.setQueryData(queries.me().queryKey, me);
    },
  });
}

export const useSignUp = () => useAccountMutation<SignUp>(API.signUp);
export const useSignIn = () => useAccountMutation<SignIn>(API.signIn);

export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => request<void>(API.signOut, { method: 'POST', json: {} }),
    onSuccess: () => {
      client.removeQueries({ queryKey: queries.progress().queryKey });
      client.setQueryData(queries.me().queryKey, { user: null } satisfies Me);
    },
  });
}

export interface CompleteTopic extends ProgressUpdate {
  topicId: string;
}

const COMPLETE_TOPIC = ['progress', 'complete'];

/**
 * Marks a topic done for the signed-in learner. The progress shows straight away (an optimistic update), goes
 * back if the API refuses, and is refetched either way so the screen ends up matching the server.
 */
export function useCompleteTopic() {
  const client = useQueryClient();
  const { queryKey } = queries.progress();
  return useMutation({
    mutationKey: COMPLETE_TOPIC,
    mutationFn: ({ topicId, trackId, score }: CompleteTopic) =>
      request<TopicProgress>(API.topicProgress(topicId), {
        method: 'PUT',
        json: { trackId, score } satisfies ProgressUpdate,
      }),
    onMutate: async ({ topicId, trackId, score }) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData(queryKey);
      const entry: TopicProgress = { topicId, trackId, score, completedAt: new Date().toISOString() };
      client.setQueryData(queryKey, (old) => ({
        completed: [...(old?.completed ?? []).filter((p) => p.topicId !== topicId), entry],
      }));
      return { previous };
    },
    onError: (_error, _variables, result) => {
      client.setQueryData(queryKey, result?.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey }),
  });
}

/**
 * The error and the update, when the latest attempt to mark `topicId` done failed, so the page can say so and
 * send it again. Undefined when nothing failed, or once a later attempt is on its way or has succeeded.
 */
export function useFailedCompletion(topicId: string) {
  const attempts = useMutationState({
    filters: { mutationKey: COMPLETE_TOPIC },
    select: ({ state }) => ({ status: state.status, error: state.error, update: state.variables as CompleteTopic }),
  });
  const last = attempts.findLast((attempt) => attempt.update.topicId === topicId);
  return last?.status === 'error' ? { error: last.error, update: last.update } : undefined;
}
