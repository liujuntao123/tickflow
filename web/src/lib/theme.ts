export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'tf-theme';

export function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolveIsDark(mode));
  document.documentElement.style.colorScheme = resolveIsDark(mode) ? 'dark' : 'light';
  window.localStorage.setItem(STORAGE_KEY, mode);
}

/** 在 react 挂载前调用，避免首屏主题闪烁。 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem('tf-theme')||'system';var d=m==='dark'||(m!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`;