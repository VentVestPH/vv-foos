import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Centralized "not available in this MVP" placeholder (redesign prompt
 * section 2, "Unimplemented controls"). Every screenshot-accurate control
 * that isn't wired to real FOOS behavior routes through this one modal
 * instead of a scattered `alert()` or a silently-broken handler, so:
 *   - it never mutates data or shows a fake success state;
 *   - it never navigates to a broken route;
 *   - there is exactly one place to later wire real behavior in.
 *
 * Usage: wrap the app in <TaleoPlaceholderProvider>, then call
 * usePlaceholder() anywhere and invoke show('Send To') on click. Or use the
 * <TaleoPlaceholderAction label="Send To" /> button below for the common
 * case of "a button that does nothing but announce itself yet".
 */
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
              {/* FOOS-TBD: wire real behavior for this control. */}
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

/**
 * Drop-in button for a screenshot-accurate control with no wired behavior
 * yet. Renders exactly like a normal Taleo action-bar button (so it "looks
 * real", per the prompt) but only ever opens the centralized placeholder.
 * FOOS-TBD: replace with a real handler once the action is implemented.
 */
export function TaleoPlaceholderAction({
  label,
  detail,
  variant = 'secondary',
  size,
  caret = false,
  className,
  // Every TaleoPlaceholderAction is by definition an action that cannot run,
  // so aria-disabled defaults to true (redesign prompt section 2). Pass
  // ariaDisabled={false} for the rare placeholder that should not announce
  // itself as unavailable. The control stays tabbable either way, so keyboard
  // users can still reach it and get the explanatory modal.
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
