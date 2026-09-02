import type { ReactNode } from 'react';
import { useOverlayDismiss } from '../../../hooks/useOverlayDismiss';

interface ModalProps {
  title: string;
  children: ReactNode;

  onClose?: () => void;
}

export function Modal({ title, children, onClose }: ModalProps) {
  const { closing, requestClose } = useOverlayDismiss(onClose);

  return (
    <div
      className="sales-modal-overlay"
      data-closing={closing ? 'true' : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={requestClose}
    >
      <div
        className="sales-modal"
        data-closing={closing ? 'true' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sales-modal-head">
          <h2>{title}</h2>
          {onClose && (
            <button type="button" className="sales-modal-x" onClick={requestClose} aria-label="Close">
              ×
            </button>
          )}
        </div>
        <div className="sales-modal-body">{children}</div>
      </div>
    </div>
  );
}
