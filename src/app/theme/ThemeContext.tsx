import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * System-wide appearance control for ParkJom.
 *
 * The preference is stored per browser in `localStorage` so it survives sign-out,
 * applies before the first paint (see the bootstrap script in `index.html`), and
 * covers every surface: marketing pages, auth screens, and all three dashboards.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'parkjom-theme';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: '#f5f5f7',
  dark: '#0b0b0d',
};

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readStoredTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(stored)) return stored;
  } catch {
    // localStorage can be unavailable (private mode, sandboxed webviews).
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(DARK_MEDIA_QUERY).matches;
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean = systemPrefersDark(),
): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

/** Writes the resolved theme onto <html> so CSS (`:root`, `.dark`) can react. */
export function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[theme]);
}

interface ThemeContextValue {
  /** What the user picked: light, dark, or follow the OS. */
  preference: ThemePreference;
  /** What is actually rendered right now. */
  resolved: ResolvedTheme;
  isDark: boolean;
  setPreference: (preference: ThemePreference) => void;
  /** Flips between light and dark, pinning an explicit preference. */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredTheme);
  const [prefersDark, setPrefersDark] = useState<boolean>(systemPrefersDark);

  const resolved = resolveTheme(preference, prefersDark);

  // Track OS-level changes so "System" keeps matching the device live.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // Keep multiple tabs/windows of the same account in sync.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      if (isThemePreference(event.newValue)) setPreferenceState(event.newValue);
      else setPreferenceState('system');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage failures; the in-memory preference still applies.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(resolveTheme(preference, prefersDark) === 'dark' ? 'light' : 'dark');
  }, [preference, prefersDark, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      isDark: resolved === 'dark',
      setPreference,
      toggleTheme,
    }),
    [preference, resolved, setPreference, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
