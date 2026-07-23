import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  isDark: boolean;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  themeMode: 'system',
  toggleTheme: () => {},
  setThemeMode: () => {},
});

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyDark(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('alert-buddy-theme');
    return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'system';
  });
  const [isDark, setIsDark] = useState(() => (themeMode === 'system' ? systemPrefersDark() : themeMode === 'dark'));

  useEffect(() => {
    applyDark(isDark);
  }, [isDark]);

  // Track OS-level changes live while in "system" mode
  useEffect(() => {
    if (themeMode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setIsDark(mq.matches);
    setIsDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('alert-buddy-theme', mode);
    setIsDark(mode === 'system' ? systemPrefersDark() : mode === 'dark');
  };

  // Header icon toggle — flips between light/dark, opting out of "system"
  const toggleTheme = () => setThemeMode(isDark ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ isDark, themeMode, toggleTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
