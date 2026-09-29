// Server state: the API client and the TanStack Query definitions the pages share.
// Every query key starts with the resource it holds, so invalidating ['progress'] refreshes every view of progress.
import {
  API,
  type ApiError,
  type LessonView,
  type Progress,
  type ProgressUpdate,
  type TopicProgress,
  type TrackSummary,
  type TrackView,
} from '@lp/contracts';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

/** An answer from the API that was not OK, with its status and the API's reason. */
export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

export const isNotFound = (error: unknown) => error instanceof ApiRequestError && error.status === 404;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, headers: { accept: 'application/json', ...init.headers } });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as ApiError | undefined;
    throw new ApiRequestError(response.status, body?.error ?? `Request failed: ${response.status} ${path}`);
  }
  return (await response.json()) as T;
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
  progress: () =>
    queryOptions({
      queryKey: ['progress'],
      queryFn: ({ signal }) => request<Progress>(API.progress, { signal }),
      // Progress changes only when this app sends it; no need to refetch it in the background.
      staleTime: Number.POSITIVE_INFINITY,
    }),
};

export interface CompleteTopic extends ProgressUpdate {
  topicId: string;
}

/**
 * Marks a topic done. The progress shows straight away (an optimistic update), goes back if the API refuses,
 * and is refetched either way so the screen ends up matching the server.
 */
export function useCompleteTopic() {
  const client = useQueryClient();
  const { queryKey } = queries.progress();
  return useMutation({
    mutationFn: ({ topicId, trackId, score }: CompleteTopic) =>
      request<TopicProgress>(API.topicProgress(topicId), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trackId, score } satisfies ProgressUpdate),
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
