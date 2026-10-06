const KEY = 'foos.staleBuildReloadAt';
const WINDOW_MS = 30000;
const PATTERN = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export function isStaleBuildError(error: unknown): boolean {
  return error instanceof Error && PATTERN.test(error.message);
}

export function reloadForStaleBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function installStaleBuildReload(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForStaleBuild()) event.preventDefault();
  });
}
