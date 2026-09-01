import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface PlaceholderContextValue {
  show: (action: string, detail?: string) => void;
}

const PlaceholderContext = createContext<PlaceholderContextValue | null>(
  null,
);

export function TaleoPlaceholderProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<{ action: string; detail?: string } | null>(
    null,
  );

  const show = useCallback((action: string, detail?: string) => {
    setState({ action, detail });
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <PlaceholderContext.Provider value={value}>
      {children}
      {state && (
        <div
          className="taleo-placeholder-overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setState(null);
          }}
        >
          <div
            className="taleo-placeholder-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="taleo-placeholder-title"
          >
            <div className="taleo-placeholder-titlebar" id="taleo-placeholder-title">
              {state.action}
            </div>
            <div className="taleo-placeholder-body">
              This action is not available in the current FOOS MVP.
              {state.detail ? ` ${state.detail}` : ''}
              {}
            </div>
            <div className="taleo-placeholder-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setState(null)}
                autoFocus
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PlaceholderContext.Provider>
  );
}

export function usePlaceholder() {
  const ctx = useContext(PlaceholderContext);
  if (!ctx) {
    throw new Error('usePlaceholder must be used within TaleoPlaceholderProvider');
  }
  return ctx;
}

export function TaleoPlaceholderAction({
  label,
  detail,
  variant = 'secondary',
  size,
  caret = false,
  className,

  ariaDisabled = true,
}: {
  label: string;
  detail?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  caret?: boolean;
  className?: string;
  ariaDisabled?: boolean;
}) {
  const { show } = usePlaceholder();
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : '',
    caret ? 'btn-caret' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={classes}
      aria-disabled={ariaDisabled || undefined}
      onClick={() => show(label, detail)}
    >
      {label}
    </button>
  );
}
