import type { ReactNode } from 'react';
import { useOverlayDismiss } from '../../../hooks/useOverlayDismiss';

interface DialogProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode | ((close: () => void) => ReactNode);
  onClose: () => void;
}

export function Dialog({ title, children, footer, onClose }: DialogProps) {
  const { closing, requestClose } = useOverlayDismiss(onClose);

  return (
    <div
      className="rq-overlay"
      data-closing={closing ? 'true' : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={requestClose}
    >
      <div
        className="rq-dialog"
        data-closing={closing ? 'true' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rq-dialog-head">
          <h2>{title}</h2>
          <button type="button" className="rq-dialog-x" onClick={requestClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        <div className="rq-dialog-body">{children}</div>
        {footer && (
          <div className="rq-dialog-foot">
            {typeof footer === 'function' ? footer(requestClose) : footer}
          </div>
        )}
      </div>
    </div>
  );
}
