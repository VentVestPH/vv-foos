import { ChevronDown } from 'lucide-react';
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
              <p className="fo-placeholder-lead">
                {state.action} is still in development.
              </p>
              <p className="fo-placeholder-note">
                {state.detail ??
                  'The control is here so this screen matches the one it replaces. It will do its job once the feature ships, and nothing on this record has changed.'}
              </p>
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
      {caret && (
        <span className="fo-utility-caret" aria-hidden="true">
          <ChevronDown size={20} />
        </span>
      )}
    </button>
  );
}
