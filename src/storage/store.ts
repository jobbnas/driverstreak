import { signal } from '@preact/signals';
import type { Stats } from '@/types';
import { STORAGE_KEY, defaultStats } from './stats';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

function safeStorage(): StorageLike {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = '__ds_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch {
    /* private mode or blocked */
  }
  return memoryStorage();
}

/** Migrates any stored shape to the current Stats version. Unknown/invalid input yields defaults. */
export function migrate(raw: unknown): Stats {
  const base = defaultStats();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Stats>;
  if (r.version !== 1) return base;
  return {
    version: 1,
    runs: Array.isArray(r.runs) ? r.runs : [],
    exams: Array.isArray(r.exams) ? r.exams : [],
    questions: r.questions && typeof r.questions === 'object' ? r.questions : {},
    daily: { ...base.daily, ...(r.daily ?? {}) },
    recent: r.recent && typeof r.recent === 'object' ? r.recent : {},
    settings: { ...base.settings, ...(r.settings ?? {}) },
  };
}

export function loadStats(storage: StorageLike = safeStorage()): Stats {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? migrate(JSON.parse(raw)) : defaultStats();
  } catch {
    return defaultStats();
  }
}

export function saveStats(stats: Stats, storage: StorageLike = safeStorage()): void {
  const attempt = (s: Stats): boolean => {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(s));
      return true;
    } catch {
      return false;
    }
  };
  if (attempt(stats)) return;
  // Quota: trim history and retry.
  const trimmed: Stats = { ...stats, runs: stats.runs.slice(-50), exams: stats.exams.slice(-10) };
  attempt(trimmed);
}

/** App-wide reactive stats store with debounced persistence. */
export function createStore(storage: StorageLike = safeStorage(), debounceMs = 250) {
  const stats = signal<Stats>(loadStats(storage));
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    saveStats(stats.value, storage);
  };

  const update = (fn: (s: Stats) => Stats) => {
    stats.value = fn(stats.value);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };

  const reset = () => {
    stats.value = defaultStats();
    flush();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  return { stats, update, flush, reset };
}

export type Store = ReturnType<typeof createStore>;
