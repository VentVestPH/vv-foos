import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useDismissable } from '../../hooks/useDismissable';
import { useMenuKeyboard } from '../../hooks/useMenuKeyboard';

interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  title?: string;
  destructive?: boolean;
}

interface ActionMenuProps {
  label: string;
  items: ActionMenuItem[];
  children?: ReactNode;
}

export function ActionMenu({ label, items, children }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const menu = useDismissable(open, close, wrapRef);
  const onMenuKeyDown = useMenuKeyboard(open, close, wrapRef);

  if (items.length === 0) return null;

  return (
    <div className="fo-action-menu-wrap" ref={wrapRef} onKeyDown={onMenuKeyDown}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
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
        {label} <span className="fo-utility-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          className="fo-action-menu"
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
