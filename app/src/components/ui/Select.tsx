import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useScrollShadow } from '../../hooks/useScrollShadow';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectChangeEvent {
  target: { value: string; name: string };
}

interface SelectProps {
  label?: string;
  error?: string | undefined;
  options: SelectOption[];
  placeholder?: string;
  placeholderSelectable?: boolean;
  emptyLabel?: string;
  value?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  className?: string;
  'aria-label'?: string;
  title?: string | undefined;
  onChange?: (event: SelectChangeEvent) => void;
}

const TYPEAHEAD_RESET_MS = 500;
const PAGE_STEP = 10;
const MENU_MAX_H = 320;
const MENU_GAP = 2;

interface Placement {
  left: number;
  top: number;
  minWidth: number;
  maxWidth: number;
  maxHeight: number;
  above: boolean;
}

const MENU_EXIT_MS = 90;

export function Select({
  label,
  error,
  options,
  placeholder,
  placeholderSelectable = true,
  emptyLabel = 'Nothing to choose from yet',
  required,
  id,
  value,
  onChange,
  disabled,
  name,
  className,
  'aria-label': ariaLabel,
  title,
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const listId = `${selectId}-listbox`;
  const errorId = `${selectId}-error`;
  const labelId = `${selectId}-label`;

  const items = useMemo<SelectOption[]>(
    () =>
      placeholder !== undefined && placeholderSelectable
        ? [{ value: '', label: placeholder }, ...options]
        : options,
    [options, placeholder, placeholderSelectable],
  );

  const current = value ?? '';
  const selectedIndex = items.findIndex((o) => o.value === current);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : undefined;

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const exitTimer = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);
  const menuShadow = useScrollShadow<HTMLUListElement>();
  const typed = useRef({ buffer: '', at: 0 });
  const location = useLocation();

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (el === null) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - MENU_GAP - 8;
    const above = r.top - MENU_GAP - 8;
    const useAbove = below < Math.min(MENU_MAX_H, items.length * 40) && above > below;
    setPlacement({
      left: r.left,
      top: useAbove ? r.top - MENU_GAP : r.bottom + MENU_GAP,
      minWidth: r.width,
      maxWidth: Math.max(r.width, window.innerWidth - r.left - 16),
      maxHeight: Math.max(96, Math.min(MENU_MAX_H, useAbove ? above : below)),
      above: useAbove,
    });
  }, [items.length]);

  const openMenu = useCallback(
    (index: number) => {
      if (disabled === true) return;
      typed.current = { buffer: '', at: 0 };
      setActiveIndex(index);
      measure();
      setOpen(true);
    },
    [disabled, measure],
  );

  const beginClose = useCallback(() => {
    setOpen(false);
    setClosing(true);
    if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    exitTimer.current = window.setTimeout(() => {
      exitTimer.current = null;
      setClosing(false);
    }, MENU_EXIT_MS);
  }, []);

  const closeMenu = useCallback(
    (refocus: boolean) => {
      beginClose();
      if (refocus) triggerRef.current?.focus({ preventScroll: true });
    },
    [beginClose],
  );

  useEffect(
    () => () => {
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    },
    [],
  );

  const commit = useCallback(
    (index: number, refocus: boolean) => {
      const item = items[index];
      if (item !== undefined && item.value !== current) {
        onChange?.({ target: { value: item.value, name: name ?? '' } });
      }
      closeMenu(refocus);
    },
    [closeMenu, current, items, name, onChange],
  );

  useLayoutEffect(() => {
    if (!open || items.length === 0) return;
    const list = menuRef.current;
    if (list === null) return;
    const el = list.children[activeIndex];
    if (el instanceof HTMLElement && list.scrollHeight > list.clientHeight) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, open, items.length]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) === true) return;
      if (menuRef.current?.contains(target) === true) return;
      beginClose();
    };
    const onReflow = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target) === true) return;
      measure();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [beginClose, measure, open]);

  useEffect(() => {
    setOpen(false);
    setClosing(false);
  }, [location.pathname]);

  const jump = useCallback(
    (char: string, from: number) => {
      const now = Date.now();
      const buffer =
        now - typed.current.at < TYPEAHEAD_RESET_MS ? typed.current.buffer + char : char;
      typed.current = { buffer, at: now };
      const repeated = buffer.length > 1 && buffer.split('').every((c) => c === buffer[0]);
      const needle = (repeated ? buffer[0] : buffer).toLowerCase();
      const start = repeated ? from + 1 : 0;
      for (let i = 0; i < items.length; i += 1) {
        const index = (start + i) % items.length;
        const item = items[index];
        if (item !== undefined && item.label.toLowerCase().startsWith(needle)) return index;
      }
      return -1;
    },
    [items],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = items.length - 1;
    const alt = event.altKey;

    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openMenu(selectedIndex >= 0 ? selectedIndex : 0);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        openMenu(alt ? (selectedIndex >= 0 ? selectedIndex : 0) : 0);
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        openMenu(0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        openMenu(last);
        return;
      }
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !alt) {
        const next = jump(event.key, activeIndex);
        if (next >= 0) {
          event.preventDefault();
          openMenu(next);
        }
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === 'Tab') {
      commit(activeIndex, false);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit(activeIndex, true);
      return;
    }
    if (event.key === 'ArrowUp' && alt) {
      event.preventDefault();
      commit(activeIndex, true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(last, i + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(last);
      return;
    }
    if (event.key === 'PageDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(last, i + PAGE_STEP));
      return;
    }
    if (event.key === 'PageUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - PAGE_STEP));
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !alt) {
      const next = jump(event.key, activeIndex);
      if (next >= 0) {
        event.preventDefault();
        setActiveIndex(next);
      }
    }
  };

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      id={selectId}
      role="combobox"
      className={className === undefined ? 'field-select' : `field-select ${className}`}
      disabled={disabled}
      title={title}
      aria-expanded={open}
      aria-controls={listId}
      aria-haspopup="listbox"
      aria-required={required === true ? true : undefined}
      aria-invalid={error !== undefined ? true : undefined}
      aria-describedby={error !== undefined ? errorId : undefined}
      aria-labelledby={label !== undefined ? labelId : undefined}
      aria-label={label === undefined ? ariaLabel : undefined}
      aria-activedescendant={open ? `${selectId}-opt-${activeIndex}` : undefined}
      data-placeholder={selected === undefined || selected.value === '' ? 'true' : 'false'}
      onKeyDown={onKeyDown}
      onClick={() => (open ? closeMenu(false) : openMenu(selectedIndex >= 0 ? selectedIndex : 0))}
    >
      <span className="field-select-value">{selected?.label ?? placeholder ?? ''}</span>
      <ChevronDown size={20} className="field-select-caret" aria-hidden="true" />
    </button>
  );

  const menu =
    (open || closing) && placement !== null
      ? createPortal(
          <ul
            ref={(el) => {
              menuRef.current = el;
              menuShadow(el);
            }}
            id={listId}
            role="listbox"
            className="field-select-menu fo-scroll-shade"
            data-closing={closing ? 'true' : undefined}
            aria-labelledby={label !== undefined ? labelId : undefined}
            style={{
              left: `${placement.left}px`,
              top: placement.above ? 'auto' : `${placement.top}px`,
              bottom: placement.above ? `${window.innerHeight - placement.top}px` : 'auto',
              minWidth: `${placement.minWidth}px`,
              maxWidth: `${placement.maxWidth}px`,
              maxHeight: `${placement.maxHeight}px`,
            }}
          >
            {items.length === 0 && (
              <li className="field-select-empty" role="option" aria-disabled="true" aria-selected="false">
                {emptyLabel}
              </li>
            )}
            {items.map((o, i) => (
              <li
                key={o.value}
                id={`${selectId}-opt-${i}`}
                role="option"
                className="field-select-option"
                aria-selected={o.value === current}
                data-active={i === activeIndex ? 'true' : 'false'}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => commit(i, true)}
                onPointerMove={() => setActiveIndex(i)}
              >
                {o.label}
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  if (label === undefined && error === undefined) {
    return (
      <div className="field">
        {trigger}
        {name !== undefined && <input type="hidden" name={name} value={current} />}
        {menu}
      </div>
    );
  }

  return (
    <div className="field">
      {label !== undefined && (
        <label className="field-label" id={labelId} htmlFor={selectId}>
          {label}
          {required === true && <span className="field-required"> *</span>}
        </label>
      )}
      {trigger}
      {name !== undefined && <input type="hidden" name={name} value={current} />}
      {error !== undefined && (
        <span className="field-error-text" role="alert" id={errorId}>
          {error}
        </span>
      )}
      {menu}
    </div>
  );
}
