import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * A tiny localStorage-backed list store shared by every component, so that
 * toggling a favourite in one place updates every other view immediately.
 */
function createListStore(key: string, max = Infinity) {
  let value: string[] = read();
  const listeners = new Set<() => void>();

  function read(): string[] {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  function set(next: string[]) {
    value = next.slice(0, max);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: keep in memory only */
    }
    listeners.forEach((l) => l());
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === key) {
        value = read();
        listeners.forEach((l) => l());
      }
    });
  }

  return {
    get: () => value,
    set,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const favoritesStore = createListStore('scp-favorites');
const historyStore = createListStore('scp-history', 50);

export function useFavorites() {
  const favorites = useSyncExternalStore(favoritesStore.subscribe, favoritesStore.get);
  const toggle = useCallback((id: string) => {
    const current = favoritesStore.get();
    favoritesStore.set(current.includes(id) ? current.filter((x) => x !== id) : [id, ...current]);
  }, []);
  return { favorites, toggle, isFavorite: (id: string) => favorites.includes(id) };
}

export function useHistory() {
  const history = useSyncExternalStore(historyStore.subscribe, historyStore.get);
  const clear = useCallback(() => historyStore.set([]), []);
  return { history, clear };
}

export function addToHistory(id: string) {
  const current = historyStore.get();
  if (current[0] === id) return;
  historyStore.set([id, ...current.filter((x) => x !== id)]);
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */
export type Theme = 'light' | 'dark';
const themeListeners = new Set<() => void>();

function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (l) => {
      themeListeners.add(l);
      return () => themeListeners.delete(l);
    },
    getTheme,
  );
  const toggle = useCallback(() => {
    const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('scp-theme', next);
    } catch {
      /* ignore */
    }
    themeListeners.forEach((l) => l());
  }, []);
  return { theme, toggle };
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} — SCP Foundation` : 'SCP Foundation — Archivio';
  }, [title]);
}
