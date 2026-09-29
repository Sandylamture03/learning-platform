// What the shell hands every UI module (@lp/platform-kit's PlatformContext), made once and kept for the app's
// lifetime: a module mounted with it can hold on to it, and ModuleOutlet never remounts a module because it changed.
import { createEventBus, type PlatformContext, type PlatformEvents } from '@lp/platform-kit';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useCompleteTopic } from './api.ts';

const Platform = createContext<PlatformContext | null>(null);

export function usePlatform(): PlatformContext {
  const platform = useContext(Platform);
  if (!platform) throw new Error('usePlatform needs a <PlatformProvider> above it');
  return platform;
}

const prefersDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

export function PlatformProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  // The latest navigate, read when a module calls it, so the context object itself never has to change.
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const [platform] = useState<PlatformContext>(() => ({
    user: null, // accounts arrive in Phase 4
    locale: 'en',
    get theme() {
      return prefersDark() ? 'dark' : 'light';
    },
    getAccessToken: () => Promise.reject(new Error('Sign-in arrives with accounts in Phase 4')),
    isEnabled: () => false,
    navigate: (path) => {
      void navigateRef.current(path);
    },
    events: createEventBus<PlatformEvents>(),
  }));

  // A passed quiz reports topic.completed.v1; the shell records it.
  const { mutate: completeTopic } = useCompleteTopic();
  useEffect(
    () =>
      platform.events.on('topic.completed.v1', ({ topicId, trackId, score }) =>
        completeTopic({ topicId, trackId, score }),
      ),
    [platform, completeTopic],
  );

  return <Platform value={platform}>{children}</Platform>;
}
