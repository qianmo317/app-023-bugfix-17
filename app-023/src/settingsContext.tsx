// 全局设置上下文：加载 IndexedDB（或默认），任何变更（键位/高亮/伸缩）统一防抖持久化
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppSettings } from './types';
import { defaultSettings } from './lib/factory';
import { loadSettings, saveSettings } from './lib/storage';

interface Ctx {
  s: AppSettings;
  setShowHighlight: (v: boolean) => void;
  setStretch: (v: number) => void;
  replaceSettings: (s: AppSettings) => void;
}

const SettingsCtx = createContext<Ctx>({
  s: defaultSettings(),
  setShowHighlight: () => {},
  setStretch: () => {},
  replaceSettings: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<AppSettings>(defaultSettings());
  const [ready, setReady] = useState(false); // IndexedDB 首次加载完成前不渲染，避免默认值覆盖加载前的变更
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    loadSettings().then((loaded) => {
      setS(loaded ? { ...defaultSettings(), ...loaded } : defaultSettings());
      setReady(true);
    });
  }, []);

  // 滑条等控件会连续触发，防抖 200ms 合并为一次写入
  useEffect(() => {
    if (!ready) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveSettings(s).catch(() => {
        /* 写入失败时保留内存值，不阻塞界面 */
      });
    }, 200);
    return () => window.clearTimeout(saveTimer.current);
  }, [s, ready]);

  if (!ready) return null;

  return (
    <SettingsCtx.Provider
      value={{
        s,
        setShowHighlight: (v) => setS((prev) => ({ ...prev, showHighlight: v })),
        setStretch: (v) => setS((prev) => ({ ...prev, currentBeatStretch: v })),
        replaceSettings: (next) => setS(next),
      }}
    >
      {children}
    </SettingsCtx.Provider>
  );
}

export function useSettings(): Ctx {
  return useContext(SettingsCtx);
}
