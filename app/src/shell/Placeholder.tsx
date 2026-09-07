import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useOverlayDismiss } from '../hooks/useOverlayDismiss';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface PlaceholderContextValue {
  show: (action: string, detail?: string) => void;
}

const PlaceholderContext = createContext<PlaceholderContextValue | null>(
  null,
);

export function PlaceholderProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState<{ action: string; detail?: string | undefined } | null>(
    null,
  );

  const show = useCallback((action: string, detail?: string) => {
    setState({ action, detail });
  }, []);

  const dismiss = useCallback(() => setState(null), []);
  const { closing, requestClose } = useOverlayDismiss(state ? dismiss : undefined);
  const panelRef = useFocusTrap<HTMLDivElement>(state !== null);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <PlaceholderContext.Provider value={value}>
      {children}
      {state && (
        <div
          className="fo-placeholder-overlay"
          data-closing={closing ? 'true' : undefined}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) requestClose();
          }}
        >
          <div
            ref={panelRef}
            className="fo-placeholder-modal"
            data-closing={closing ? 'true' : undefined}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fo-placeholder-title"
          >
            <div className="fo-placeholder-titlebar" id="fo-placeholder-title">
              {state.action}
            </div>
            <div className="fo-placeholder-body">
              This action is not available in the current FOOS MVP.
              {state.detail ? ` ${state.detail}` : ''}
              {}
            </div>
            <div className="fo-placeholder-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={requestClose}
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
    throw new Error('usePlaceholder must be used within PlaceholderProvider');
  }
  return ctx;
}

export function PlaceholderAction({
  label,
  detail,
  variant = 'secondary',
  size,
  caret = false,
  className,

}: {
  label: string;
  detail?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  caret?: boolean;
  className?: string;
}) {
  const { show } = usePlaceholder();
  const classes = [
    'btn',
    `btn-${variant}`,
    size === 'sm' ? 'btn-sm' : '',
    caret ? 'btn-caret' : '',
    'is-placeholder',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type="button"
      className={classes}
      onClick={() => show(label, detail)}
    >
      {label}
    </button>
  );
}
