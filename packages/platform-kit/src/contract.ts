import type { EventBus } from './event-bus.ts';

/** What the shell hands every UI module, whatever it is written in. Read-only by design. */
export interface PlatformContext {
  readonly user: { readonly id: string; readonly roles: readonly string[] } | null;
  readonly locale: string;
  readonly theme: 'light' | 'dark';
  /** A short-lived token for the module's own API calls (Phase 4). */
  getAccessToken(): Promise<string>;
  isEnabled(flag: string): boolean;
  /** The shell owns the router; modules ask it to navigate. */
  navigate(path: string): void;
  readonly events: EventBus;
}

/**
 * The only thing a UI module must export. React routes, plain JavaScript custom elements
 * (Phase 2 widgets) and anything else mount into an element the shell gives them.
 */
export interface UiModule {
  mount(el: HTMLElement, ctx: PlatformContext): void | Promise<void>;
  unmount(el: HTMLElement): void | Promise<void>;
}
