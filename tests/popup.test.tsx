import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../src/popup/App';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
import type { Summary } from '../src/shared/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const summary: Summary = {
  settings: { ...DEFAULT_SETTINGS }, watchedCount: 0, filteredToday: 0, filteredAllTime: 0, totalMarked: 0, storageBytes: 0,
  home: { visits: 0, served: 0, distinct: 0, repeats: 0, watched: 0, since: 0, top: [] }
};
let root: Root;
let container: HTMLElement;
beforeEach(async () => {
  vi.stubGlobal('chrome', {
    storage: { onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
    runtime: { getManifest: () => ({ version: '1.0.2' }), sendMessage: vi.fn(async () => ({ ok: true, data: summary })) }
  });
  container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(<App />); });
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

function tab(label: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button => button.textContent === label)!;
}

it('keeps an unsaved filter draft when switching tabs', async () => {
  await act(async () => { tab('Filters').click(); });
  const textarea = container.querySelector<HTMLTextAreaElement>('#blocked-titles')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'reaction');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { tab('Stats').click(); });
  await act(async () => { tab('Filters').click(); });
  expect(container.querySelector<HTMLTextAreaElement>('#blocked-titles')!.value).toBe('reaction');
  expect(container.querySelector<HTMLButtonElement>('.content-filters button[type="submit"]')!.disabled).toBe(false);
});

it('points every tab at a panel in the document', () => {
  const tabs = [...container.querySelectorAll('[role="tab"]')];
  expect(tabs).toHaveLength(4);
  expect(tabs.every(element => container.querySelector(`#${element.getAttribute('aria-controls')}`))).toBe(true);
  expect(container.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1);
});
