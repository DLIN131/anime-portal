import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import * as OpenCC from 'opencc-js';

export type ZhMode = 'tw' | 'cn';

const toTw = OpenCC.Converter({ from: 'cn', to: 'twp' });
const toCn = OpenCC.Converter({ from: 'tw', to: 'cn' });
const cnToTw = OpenCC.Converter({ from: 'cn', to: 'tw' });

/** 全是繁體字才算繁體；繁簡混用的字串當作簡體，顯示時再整句轉換 */
export function isTraditional(s: string): boolean {
  return cnToTw(s) === s && toCn(s) !== s;
}

const STORAGE_KEY = 'zh-mode';

function loadMode(): ZhMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'cn' ? 'cn' : 'tw';
  } catch {
    return 'tw';
  }
}

interface ZhContextValue {
  mode: ZhMode;
  setMode: (m: ZhMode) => void;
  /** 將任意中文字串轉成目前選擇的字形 */
  t: (s: string | undefined | null) => string;
}

const ZhContext = createContext<ZhContextValue | null>(null);

export function ZhProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ZhMode>(loadMode);
  const setMode = useCallback((m: ZhMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* 無法儲存時忽略 */
    }
  }, []);
  const t = useCallback((s: string | undefined | null) => (s ? (mode === 'tw' ? toTw(s) : toCn(s)) : ''), [mode]);
  const value = useMemo(() => ({ mode, setMode, t }), [mode, setMode, t]);
  return <ZhContext.Provider value={value}>{children}</ZhContext.Provider>;
}

/** 前 200 字內假名比例偏高即視為日文 */
export function isJapanese(s: string): boolean {
  const head = s.slice(0, 200);
  const kana = head.match(/[぀-ヿ]/g)?.length ?? 0;
  return kana > head.length * 0.1;
}

/** Bangumi 簡介常在「[简介原文]」之後附上日文原文，日文部分不做繁簡轉換 */
export function convertSummary(t: (s: string) => string, summary: string): string {
  // 整段都是日文（含假名）時保留原文
  if (isJapanese(summary)) return summary;
  const idx = summary.search(/\[(简介原文|簡介原文)\]/);
  if (idx < 0) return t(summary);
  return t(summary.slice(0, idx)) + '[簡介原文]' + summary.slice(idx).replace(/^\[[^\]]+\]/, '');
}

export function useZh() {
  const ctx = useContext(ZhContext);
  if (!ctx) throw new Error('useZh must be used inside ZhProvider');
  return ctx;
}
