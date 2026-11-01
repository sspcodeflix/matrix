import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/** System follows the OS; Light and Dark set data-theme on <html>. */
export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setPreference: (p: ThemePreference) => void;
  /** Top-bar quick toggle: flips the resolved theme and stores it as an explicit choice. */
  toggle: () => void;
}

const STORAGE_KEY = 'matrix.theme';
const ThemeContext = createContext<ThemeState | null>(null);

function readStored(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(readStored);
  const [osDark, setOsDark] = useState(() => darkQuery().matches);

  useEffect(() => {
    const q = darkQuery();
    const onChange = (e: MediaQueryListEvent) => setOsDark(e.matches);
    q.addEventListener('change', onChange);
    return () => q.removeEventListener('change', onChange);
  }, []);

  const resolved = preference === 'system' ? (osDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    const root = document.documentElement;
    if (preference === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', preference);
  }, [preference]);

  const setPreference = (p: ThemePreference) => {
    setPref(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <ThemeContext.Provider
      value={{ preference, resolved, setPreference, toggle: () => setPreference(resolved === 'dark' ? 'light' : 'dark') }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
