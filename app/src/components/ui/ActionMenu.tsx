import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, EllipsisVertical } from 'lucide-react';
import { useDismissable } from '../../hooks/useDismissable';
import { useMenuKeyboard } from '../../hooks/useMenuKeyboard';
import { useScrollShadow } from '../../hooks/useScrollShadow';

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  title?: string | undefined;
  destructive?: boolean;
  icon?: ReactNode;
}

interface ActionMenuProps {
  label: string;
  items: ActionMenuItem[];
  iconOnly?: boolean;
  children?: ReactNode;
}

const GAP = 4;
const EDGE = 8;

interface Placement {
  left: number;
  top: number;
}

export function ActionMenu({ label, items, iconOnly = false, children }: ActionMenuProps) {
  const menuShadow = useScrollShadow<HTMLDivElement>();
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const close = useCallback(() => {
    setOpen(false);
    setPlacement(null);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);
  const menu = useDismissable(open, close);
  const onMenuKeyDown = useMenuKeyboard(open && placement !== null, close, menuRef);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = menuRef.current;
    if (!trigger || !panel) return;
    const t = trigger.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const fitsRight = t.left + width <= window.innerWidth - EDGE;
    const left = fitsRight ? t.left : Math.max(EDGE, t.right - width);
    const fitsBelow = t.bottom + GAP + height <= window.innerHeight - EDGE;
    const top = fitsBelow || t.top - GAP - height < EDGE ? t.bottom + GAP : t.top - GAP - height;
    setPlacement({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      menu.requestClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, menu, place]);

  if (items.length === 0) return null;

  return (
    <div
      className="fo-action-menu-wrap"
      ref={wrapRef}
      onKeyDown={(event) => {
        if (open && event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          event.stopPropagation();
          menu.requestClose();
          return;
        }
        onMenuKeyDown(event);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={iconOnly ? 'fo-icon-btn fo-action-menu-trigger' : 'btn btn-secondary btn-sm'}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? menu.requestClose() : setOpen(true))}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {iconOnly ? (
          <EllipsisVertical size={20} aria-hidden="true" />
        ) : (
          <>
            {label}
            <span className="fo-utility-caret" aria-hidden="true">
              <ChevronDown size={20} />
            </span>
          </>
        )}
      </button>
      {open && createPortal(
        <div
          className="fo-action-menu fo-scroll-shade"
          ref={(element) => {
            menuRef.current = element;
            menuShadow(element);
          }}
          data-closing={menu.closing ? 'true' : undefined}
          role="menu"
          aria-label={label}
          style={placement ? { left: `${placement.left}px`, top: `${placement.top}px` } : { visibility: 'hidden' }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={
                item.destructive
                  ? 'fo-action-menu-item is-destructive'
                  : 'fo-action-menu-item'
              }
              role="menuitem"
              disabled={item.disabled === true}
              title={item.title}
              onClick={() => {
                setOpen(false);
                setPlacement(null);
                item.onSelect();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}
