const THEME_KEY = 'filepath-theme';

export function initTheme(): void {
  if (typeof document === 'undefined') return;
  const stored = localStorage.getItem(THEME_KEY);
  const dark =
    stored === '1'
      ? true
      : stored === '0'
        ? false
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
}

export function toggleTheme(): void {
  if (typeof document === 'undefined') return;
  const dark = document.documentElement.classList.toggle('dark');
  try {
    localStorage.setItem(THEME_KEY, dark ? '1' : '0');
  } catch {}
}
