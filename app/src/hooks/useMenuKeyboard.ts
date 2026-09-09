import { useCallback, useEffect, type KeyboardEvent, type RefObject } from 'react';

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])';

function itemsIn(scope: HTMLElement | null): HTMLElement[] {
  if (!scope) return [];
  return Array.from(scope.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
}

export function useMenuKeyboard(
  open: boolean,
  close: () => void,
  scopeRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const first = itemsIn(scopeRef.current)[0];
    if (first) first.focus({ preventScroll: true });
  }, [open, scopeRef]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!open) return;
      const items = itemsIn(scopeRef.current);
      if (items.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const index = active ? items.indexOf(active) : -1;

      const move = (next: number) => {
        event.preventDefault();
        event.stopPropagation();
        const target = items[(next + items.length) % items.length];
        if (!target) return;
        target.focus({ preventScroll: true });
        const scope = scopeRef.current;
        if (scope && scope.scrollHeight > scope.clientHeight) {
          target.scrollIntoView({ block: 'nearest' });
        }
      };

      switch (event.key) {
        case 'ArrowDown':
          move(index + 1);
          return;
        case 'ArrowUp':
          move(index - 1);
          return;
        case 'Home':
          move(0);
          return;
        case 'End':
          move(items.length - 1);
          return;
        case 'Tab':
          close();
          return;
        default:
          return;
      }
    },
    [open, close, scopeRef],
  );

  return onKeyDown;
}
