// Mounts a UI module (@lp/platform-kit's UiModule) into an element React leaves alone. The Phase 2 widgets are
// hosted this way, unchanged: the module gets the element and the platform context, and fills the element itself.
import type { UiModule } from '@lp/platform-kit';
import { useEffect, useRef, useState } from 'react';
import { usePlatform } from './platform.tsx';

export interface ModuleOutletProps {
  /** Loads the module, usually a dynamic import. Keep it stable (defined outside the component), or it remounts. */
  load: () => Promise<{ default: UiModule }>;
  /** Handed to the module as the host element's data-src: the URL of its data. */
  src?: string | undefined;
  /** Names the region the module fills, for assistive technology. */
  label: string;
  className?: string;
}

export function ModuleOutlet({ load, src, label, className }: ModuleOutletProps) {
  const host = useRef<HTMLDivElement>(null);
  const platform = usePlatform();
  const [failure, setFailure] = useState<{ error: unknown; attempt: number } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let active = true;
    // Resolves once the module is mounted, so an unmount always runs after the mount it undoes.
    const mounted = load().then(async ({ default: module }) => {
      if (!active) return undefined;
      await module.mount(el, platform);
      return module;
    });
    mounted.catch((error: unknown) => {
      if (active) setFailure({ error, attempt });
    });
    return () => {
      active = false;
      void mounted.then((module) => module?.unmount(el)).catch(() => {});
    };
  }, [load, src, platform, attempt]);

  if (failure) {
    return (
      <div className="notice notice--error" role="alert">
        <p>This part of the page could not load. Check your connection, then try again.</p>
        <button
          type="button"
          className="button button--small"
          onClick={() => {
            setFailure(null);
            setAttempt(failure.attempt + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }
  // No React children: everything inside this element belongs to the module.
  return <section ref={host} className={className} data-src={src} aria-label={label} />;
}
