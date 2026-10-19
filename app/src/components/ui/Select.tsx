import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useScrollShadow } from '../../hooks/useScrollShadow';
import { FieldHelp } from './FieldHelp';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectChangeEvent {
  target: { value: string; name: string };
}

interface SelectProps {
  label?: string;
  help?: ReactNode;
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
  fitMenuContent?: boolean;
  onChange?: (event: SelectChangeEvent) => void;
}

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
  help,
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
  fitMenuContent = false,
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
  const [query, setQuery] = useState('');
  const [placement, setPlacement] = useState<Placement | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const menuShadow = useScrollShadow<HTMLDivElement>();

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const all = items.map((item, index) => ({ item, index }));
    return needle === '' ? all : all.filter(({ item }) => item.label.toLowerCase().includes(needle));
  }, [items, query]);
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
    (index: number, seed = '') => {
      if (disabled === true) return;
      setQuery(seed);
      keyboardNav.current = true;
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
      const item = shown[index]?.item;
      if (item !== undefined && item.value !== current) {
        onChange?.({ target: { value: item.value, name: name ?? '' } });
      }
      closeMenu(refocus);
    },
    [closeMenu, current, shown, name, onChange],
  );

  const keyboardNav = useRef(false);

  useLayoutEffect(() => {
    if (!open || shown.length === 0 || !keyboardNav.current) return;
    const list = listRef.current;
    if (list === null) return;
    const el = list.children[activeIndex];
    if (el instanceof HTMLElement) el.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, shown.length]);

  useEffect(() => {
    if (open) searchRef.current?.focus({ preventScroll: true });
  }, [open]);

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

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    keyboardNav.current = true;
    const alt = event.altKey;
    if (open) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(true);
      }
      return;
    }
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
      openMenu(items.length - 1);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !alt) {
      event.preventDefault();
      openMenu(0, event.key);
    }
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    keyboardNav.current = true;
    const last = shown.length - 1;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
      return;
    }
    if (event.key === 'Tab') {
      commit(activeIndex, true);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(activeIndex, true);
      return;
    }
    if (event.key === 'ArrowUp' && event.altKey) {
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
    if (event.key === 'PageDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(last, i + PAGE_STEP));
      return;
    }
    if (event.key === 'PageUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - PAGE_STEP));
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
          <div
            ref={(el) => {
              menuRef.current = el;
              menuShadow(el);
            }}
            className="field-select-menu fo-scroll-shade"
            data-fit-content={fitMenuContent ? 'true' : undefined}
            data-closing={closing ? 'true' : undefined}
            style={{
              left: `${placement.left}px`,
              top: placement.above ? 'auto' : `${placement.top}px`,
              bottom: placement.above ? `${window.innerHeight - placement.top}px` : 'auto',
              minWidth: `${placement.minWidth}px`,
              maxWidth: `${placement.maxWidth}px`,
              maxHeight: `${placement.maxHeight}px`,
            }}
          >
            <div className="field-select-search">
              <input
                ref={searchRef}
                type="search"
                className="field-select-search-input"
                placeholder="Search…"
                autoComplete="off"
                spellCheck={false}
                aria-label={`Search ${label ?? ariaLabel ?? 'options'}`}
                aria-controls={listId}
                aria-activedescendant={shown.length > 0 ? `${selectId}-opt-${activeIndex}` : undefined}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onSearchKeyDown}
              />
            </div>
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              className="field-select-list"
              aria-labelledby={label !== undefined ? labelId : undefined}
            >
              {items.length === 0 && (
                <li className="field-select-empty" role="option" aria-disabled="true" aria-selected="false">
                  {emptyLabel}
                </li>
              )}
              {items.length > 0 && shown.length === 0 && (
                <li className="field-select-empty" role="option" aria-disabled="true" aria-selected="false">
                  No matches
                </li>
              )}
              {shown.map(({ item: o }, i) => (
                <li
                  key={o.value}
                  id={`${selectId}-opt-${i}`}
                  role="option"
                  className="field-select-option"
                  aria-selected={o.value === current}
                  data-active={i === activeIndex ? 'true' : 'false'}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => commit(i, true)}
                  onPointerMove={() => {
                    keyboardNav.current = false;
                    setActiveIndex(i);
                  }}
                >
                  {o.label}
                </li>
              ))}
            </ul>
          </div>,
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
      {label !== undefined && help !== undefined ? (
        <div className="field-label-row">
          <label className="field-label" id={labelId} htmlFor={selectId}>
            {label}
            {required === true && <span className="field-required"> *</span>}
          </label>
          <FieldHelp label={label}>{help}</FieldHelp>
        </div>
      ) : (
        label !== undefined && (
          <label className="field-label" id={labelId} htmlFor={selectId}>
            {label}
            {required === true && <span className="field-required"> *</span>}
          </label>
        )
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
