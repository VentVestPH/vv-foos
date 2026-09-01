import type { ReactNode } from 'react';

interface DialogProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}

/** Modal used for rejection reasons, promotion prompts, and saved-view names. */
export function Dialog({ title, children, footer, onClose }: DialogProps) {
  return (
    <div
      className="rq-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="rq-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="rq-dialog-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="rq-dialog-x"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>
        <div className="rq-dialog-body">{children}</div>
        {footer && <div className="rq-dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}
