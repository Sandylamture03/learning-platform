import type { PlatformContext, UiModule } from '@lp/platform-kit';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { StrictMode, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModuleOutlet } from '../src/ModuleOutlet.tsx';
import { renderInPlatform } from './render.tsx';

afterEach(cleanup);

/** A module that records what the shell does to it, and writes the data URL into its element. */
function fakeModule() {
  const calls: string[] = [];
  const contexts: PlatformContext[] = [];
  const module: UiModule = {
    mount(el, ctx) {
      calls.push(`mount ${el.dataset.src}`);
      contexts.push(ctx);
      el.textContent = `showing ${el.dataset.src}`;
    },
    unmount(el) {
      calls.push(`unmount ${el.dataset.src}`);
      el.replaceChildren();
    },
  };
  return { calls, contexts, load: () => Promise.resolve({ default: module }) };
}

describe('ModuleOutlet', () => {
  it('mounts the module into its element with the data URL and the platform context', async () => {
    const { calls, contexts, load } = fakeModule();
    renderInPlatform(<ModuleOutlet load={load} src="/api/quizzes/event-loop" label="Quiz" />);
    const region = await screen.findByRole('region', { name: 'Quiz' });
    await waitFor(() => expect(region.textContent).toBe('showing /api/quizzes/event-loop'));
    expect(calls).toEqual(['mount /api/quizzes/event-loop']);
    expect(contexts[0]?.events.emit).toBeTypeOf('function');
    expect(contexts[0]?.theme).toMatch(/^(light|dark)$/);
  });

  it('unmounts the module when the outlet goes away', async () => {
    const { calls, load } = fakeModule();
    const view = renderInPlatform(<ModuleOutlet load={load} src="/a" label="Widget" />);
    await waitFor(() => expect(calls).toEqual(['mount /a']));
    view.unmount();
    await waitFor(() => expect(calls).toEqual(['mount /a', 'unmount /a']));
  });

  it('survives StrictMode: every mount is undone, and one stays', async () => {
    const { calls, load } = fakeModule();
    renderInPlatform(
      <StrictMode>
        <ModuleOutlet load={load} src="/a" label="Widget" />
      </StrictMode>,
    );
    const region = await screen.findByRole('region', { name: 'Widget' });
    await waitFor(() => expect(region.textContent).toBe('showing /a'));
    const mounts = calls.filter((c) => c.startsWith('mount')).length;
    const unmounts = calls.filter((c) => c.startsWith('unmount')).length;
    expect(mounts - unmounts).toBe(1);
  });

  it('remounts the module when the data URL changes', async () => {
    const user = userEvent.setup();
    const { calls, load } = fakeModule();
    function Switcher() {
      const [src, setSrc] = useState('/a');
      return (
        <>
          <button type="button" onClick={() => setSrc('/b')}>
            Switch
          </button>
          <ModuleOutlet load={load} src={src} label="Widget" />
        </>
      );
    }
    renderInPlatform(<Switcher />);
    await waitFor(() => expect(calls).toEqual(['mount /a']));
    await user.click(await screen.findByRole('button', { name: 'Switch' }));
    await waitFor(() => expect(calls).toEqual(['mount /a', 'unmount /b', 'mount /b']));
    expect(screen.getByRole('region', { name: 'Widget' }).textContent).toBe('showing /b');
  });

  it('never mounts a module that finished loading after the outlet went away', async () => {
    const { calls, load } = fakeModule();
    let finish = () => {};
    const slow = () =>
      new Promise<{ default: UiModule }>((resolve) => {
        finish = () => void load().then(resolve);
      });
    const view = renderInPlatform(<ModuleOutlet load={slow} src="/a" label="Widget" />);
    await screen.findByRole('region', { name: 'Widget' });
    view.unmount();
    await act(async () => finish());
    expect(calls).toEqual([]);
  });

  it('says so when the module cannot load, and tries again', async () => {
    const user = userEvent.setup();
    const { calls, load } = fakeModule();
    const flaky = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'));
    flaky.mockImplementation(load);
    renderInPlatform(<ModuleOutlet load={flaky} src="/a" label="Widget" />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('This part of the page could not load.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    const region = await screen.findByRole('region', { name: 'Widget' });
    await waitFor(() => expect(region.textContent).toBe('showing /a'));
    expect(calls).toEqual(['mount /a']);
  });
});
