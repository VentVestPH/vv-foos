import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  children: ReactNode;

  onClose?: () => void;
}

export function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div
      className="sales-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="sales-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sales-modal-head">
          <h2>{title}</h2>
          {onClose && (
            <button
              type="button"
              className="sales-modal-x"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>
        <div className="sales-modal-body">{children}</div>
      </div>
    </div>
  );
}
