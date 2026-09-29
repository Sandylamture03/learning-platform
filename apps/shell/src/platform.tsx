// What the shell hands every UI module (@lp/platform-kit's PlatformContext), made once and kept for the app's
// lifetime: a module mounted with it can hold on to it, and ModuleOutlet never remounts a module because it changed.
import { createEventBus, type PlatformContext, type PlatformEvents } from '@lp/platform-kit';
import { useQuery } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { type CompleteTopic, queries, useCompleteTopic } from './api.ts';

const Platform = createContext<PlatformContext | null>(null);
/** Quiz results passed while nobody was signed in, waiting to be saved. */
const PendingResults = createContext<readonly CompleteTopic[]>([]);

export function usePlatform(): PlatformContext {
  const platform = useContext(Platform);
  if (!platform) throw new Error('usePlatform needs a <PlatformProvider> above it');
  return platform;
}

/** The quiz result for `topicId` that is waiting for the learner to sign in, if there is one. */
export function usePendingResult(topicId: string): CompleteTopic | undefined {
  return useContext(PendingResults).find((r) => r.topicId === topicId);
}

const prefersDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

export function PlatformProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const user = useQuery(queries.me()).data?.user ?? null;
  // The latest navigate and user, read when a module asks, so the context object itself never has to change.
  const navigateRef = useRef(navigate);
  const userRef = useRef(user);
  useEffect(() => {
    navigateRef.current = navigate;
    userRef.current = user;
  }, [navigate, user]);

  const [platform] = useState<PlatformContext>(() => ({
    get user() {
      const current = userRef.current;
      return current ? { id: current.id, roles: ['learner'] } : null;
    },
    locale: 'en',
    get theme() {
      return prefersDark() ? 'dark' : 'light';
    },
    // The session is an httpOnly cookie the browser sends by itself; modules on this origin need no token.
    getAccessToken: () => Promise.reject(new Error('The session is a cookie; call the API on this origin')),
    isEnabled: () => false,
    navigate: (path) => {
      void navigateRef.current(path);
    },
    events: createEventBus<PlatformEvents>(),
  }));

  // A passed quiz reports topic.completed.v1. The shell saves it for the signed-in learner, or keeps it until
  // someone signs in, so passing a quiz first and making an account second loses nothing.
  const { mutate: completeTopic } = useCompleteTopic();
  const [pending, setPending] = useState<CompleteTopic[]>([]);
  useEffect(
    () =>
      platform.events.on('topic.completed.v1', ({ topicId, trackId, score }) => {
        const result = { topicId, trackId, score };
        if (userRef.current) completeTopic(result);
        else setPending((waiting) => [...waiting.filter((r) => r.topicId !== topicId), result]);
      }),
    [platform, completeTopic],
  );
  useEffect(() => {
    if (!user || pending.length === 0) return;
    for (const result of pending) completeTopic(result);
    setPending([]);
  }, [user, pending, completeTopic]);

  return (
    <Platform value={platform}>
      <PendingResults value={pending}>{children}</PendingResults>
    </Platform>
  );
}
