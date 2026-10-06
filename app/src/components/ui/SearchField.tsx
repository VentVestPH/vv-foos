import { forwardRef, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Search as SearchIcon, X as ClearIcon } from 'lucide-react';

interface SearchFieldProps {
  value: string;
  onValueChange: (next: string) => void;
  onSubmitTerm?: ((term: string) => void) | undefined;
  ariaLabel: string;
  placeholder?: string | undefined;
  className?: string | undefined;
  type?: 'text' | 'search' | undefined;
  autoFocus?: boolean | undefined;
  disabled?: boolean | undefined;
  title?: string | undefined;
  onFocus?: (() => void) | undefined;
  onClear?: (() => void) | undefined;
  trailing?: ReactNode;
  children?: ReactNode;
  combobox?: {
    expanded: boolean;
    controls: string;
    activeDescendant: string | undefined;
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  } | undefined;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  {
    value,
    onValueChange,
    onSubmitTerm,
    ariaLabel,
    placeholder,
    className,
    type = 'text',
    autoFocus = false,
    disabled,
    title,
    onFocus,
    onClear,
    trailing,
    children,
    combobox,
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmitTerm?.(value.trim());
  };

  return (
    <form
      className={className === undefined ? 'fo-search-row' : `fo-search-row ${className}`}
      onSubmit={submit}
    >
      <span
        className="fo-search-input-wrap"
        data-inset={trailing === undefined ? 'true' : undefined}
        data-clearable={onClear !== undefined && value.length > 0 ? 'true' : undefined}
      >
        <input
          ref={(node) => {
            inputRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          className="input"
          type={type}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onFocus={onFocus}
          aria-label={ariaLabel}
          role={combobox ? 'combobox' : undefined}
          aria-autocomplete={combobox ? 'list' : undefined}
          aria-expanded={combobox?.expanded}
          aria-controls={combobox?.controls}
          aria-activedescendant={combobox?.activeDescendant}
          onKeyDown={combobox?.onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          title={title}
        />
        {onClear !== undefined && value.length > 0 && (
          <button
            type="button"
            className="fo-icon-btn fo-searchbox-clear"
            aria-label="Clear the search"
            title="Clear the search"
            disabled={disabled}
            onClick={() => {
              onClear();
              inputRef.current?.focus();
            }}
          >
            <ClearIcon size={20} />
          </button>
        )}
        {trailing === undefined && (
          <button
            type="submit"
            className="fo-icon-btn fo-searchbox-submit"
            aria-label="Search"
            title={ariaLabel}
            disabled={disabled}
          >
            <SearchIcon size={20} />
          </button>
        )}
        {children}
      </span>
      {trailing}
    </form>
  );
});
