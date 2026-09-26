// 设置页修复验证 —— jsdom 组件级：键位冲突拦截 / Esc 取消 / 试听两项持久化
import 'fake-indexeddb/auto';
// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Settings } from '../src/pages/Settings';
import { SettingsProvider } from '../src/settingsContext';
import { loadSettings } from '../src/lib/storage';
import { createElement } from 'react';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function flush(ms = 30) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

beforeEach(async () => {
  const dbs = await indexedDB.databases();
  for (const d of dbs) if (d.name) indexedDB.deleteDatabase(d.name);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(SettingsProvider, null, createElement(Settings)));
  });
  await flush();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const keydown = (key: string) =>
  act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
  });

const clickRebind = (testid: string) =>
  act(async () => {
    container.querySelector<HTMLButtonElement>(`[data-testid="${testid}"]`)!.click();
  });

const msg = () => container.querySelector('[data-testid="rebind-msg"]')?.textContent ?? '';
const keys = () => [...container.querySelectorAll('[data-testid="keymap-table"] tbody kbd')].map((k) => k.textContent);

describe('设置页改键位', () => {
  it('改绑到已占用的键被拦下，不出现重复键', async () => {
    await clickRebind('rebind-z');
    await flush();
    await keydown('x'); // x 已被 鼓·八 占用
    expect(msg()).toContain('占用');
    const ks = keys();
    expect(new Set(ks).size).toBe(ks.length); // 全表唯一
    expect(ks.filter((k) => k === 'x').length).toBe(1);
    // 等待状态仍在，换空键可成功
    await keydown('p');
    expect(msg()).toContain('已绑定 p');
    const saved = await loadSettings();
    expect(saved!.keyMap.find((b) => b.instrumentId === 'gu' && b.glyphIndex === 0)!.key).toBe('p');
  });

  it('Esc 取消改绑，键位保持原样', async () => {
    await clickRebind('rebind-z');
    await flush();
    await keydown('Escape');
    expect(msg()).toContain('已取消');
    expect(keys()).toContain('z');
    expect(keys()).not.toContain('escape');
    const saved = await loadSettings();
    // 取消不产生任何写入；即便此前有存档，z 也保持原样
    expect(saved?.keyMap.find((b) => b.instrumentId === 'gu' && b.glyphIndex === 0)?.key ?? 'z').toBe('z');
  });
});

describe('试听设置持久化', () => {
  it('高亮开关与伸缩值写入 IndexedDB', async () => {
    const chk = container.querySelector<HTMLInputElement>('[data-testid="chk-show-highlight"]')!;
    expect(chk.checked).toBe(true);
    await act(async () => {
      chk.click(); // 关掉
    });
    const rng = container.querySelector<HTMLInputElement>('[data-testid="rng-stretch"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(rng, '1.5');
      rng.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush(50);
    const saved = await loadSettings();
    expect(saved!.showHighlight).toBe(false);
    expect(saved!.currentBeatStretch).toBe(1.5);
  });
});
