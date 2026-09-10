import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, EllipsisVertical } from 'lucide-react';
import { useDismissable } from '../../hooks/useDismissable';
import { useOutsideClose } from '../../hooks/useOutsideClose';
import { useMenuKeyboard } from '../../hooks/useMenuKeyboard';
import { useScrollShadow } from '../../hooks/useScrollShadow';

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  title?: string | undefined;
  destructive?: boolean;
}

interface ActionMenuProps {
  label: string;
  items: ActionMenuItem[];
  iconOnly?: boolean;
  children?: ReactNode;
}

export function ActionMenu({ label, items, iconOnly = false, children }: ActionMenuProps) {
  const menuShadow = useScrollShadow<HTMLDivElement>();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);
  const menu = useDismissable(open, close, wrapRef);
  const onMenuKeyDown = useMenuKeyboard(open, close, wrapRef);
  useOutsideClose(open, menu.requestClose, wrapRef);

  if (items.length === 0) return null;

  return (
    <div className="fo-action-menu-wrap" ref={wrapRef} onKeyDown={onMenuKeyDown}>
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
      {open && (
        <div
          className="fo-action-menu fo-scroll-shade" ref={menuShadow}
          data-closing={menu.closing ? 'true' : undefined}
          role="menu"
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
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
          {children}
        </div>
      )}
    </div>
  );
}
