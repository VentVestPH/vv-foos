const BUSY_SELECTOR = '[aria-busy="true"], .skeleton, .spinner';
const POLL_MS = 100;
const SETTLE_MS = 200;
const CAP_MS = 6000;

export function printExpanded(expand: () => void): void {
  expand();

  const start = Date.now();

  const attempt = () => {
    const scope = document.querySelector('.record-page') ?? document.body;
    const elapsed = Date.now() - start;
    const stillLoading = scope.querySelector(BUSY_SELECTOR) !== null;

    if ((stillLoading || elapsed < SETTLE_MS) && elapsed < CAP_MS) {
      window.setTimeout(attempt, POLL_MS);
      return;
    }

    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  };

  window.setTimeout(attempt, POLL_MS);
}
