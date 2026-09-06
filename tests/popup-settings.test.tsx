import { afterEach, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from '../src/popup/App';
import { Repository } from '../src/background/repository';
import type { Request, Summary } from '../src/shared/types';

const roots: Root[] = [];
afterEach(async () => {
  await act(async () => { roots.forEach(root => root.unmount()); });
  roots.length = 0;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});
it('keeps edits from two Options windows before their storage refreshes arrive', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const data: Record<string, unknown> = {};
  const repository = new Repository();
  vi.stubGlobal('chrome', { storage: {
    session: { get: async () => ({}) },
    // The real popup debounces these notifications. Both windows can edit first.
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    local: {
      get: async (keys: string | string[] | null) => structuredClone(keys === null ? data : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter(key => key in data).map(key => [key, data[key]]))),
      set: async (values: Record<string, unknown>) => { Object.assign(data, structuredClone(values)); },
      getBytesInUse: async () => 0
    }
  }, runtime: { sendMessage: async (message: Request) => ({ ok: true, data: await repository.dispatch(message) }) } });
  const windows = [document.createElement('div'), document.createElement('div')];
  await act(async () => {
    for (const container of windows) {
      document.body.append(container);
      const root = createRoot(container); roots.push(root); root.render(<App />);
    }
  });
  for (const [index, label] of ['Hide Shorts on Home', 'Hide playlists and Mixes'].entries()) {
    const toggle = [...windows[index]!.querySelectorAll('label')].find(element => element.textContent?.includes(label))?.querySelector('input');
    expect(toggle).toBeDefined();
    await act(async () => { toggle!.click(); });
  }
  expect((await repository.dispatch({ type: 'summary' }) as Summary).settings).toMatchObject({ hideHomeShorts: true, hidePlaylists: true });
});
