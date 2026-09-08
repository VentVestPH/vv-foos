import { useEffect, type RefObject } from 'react';

export function useOutsideClose(
  open: boolean,
  close: () => void,
  scope: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const node = scope.current;
      if (!node) return;
      if (event.target instanceof Node && node.contains(event.target)) return;
      close();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, close, scope]);
}
