import type { ReactNode } from 'react';
import { X as CloseIcon } from 'lucide-react';
import { useOverlayDismiss } from '../../hooks/useOverlayDismiss';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface DialogProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode | ((close: () => void) => ReactNode) | undefined;
  onClose?: (() => void) | undefined;
  overlayClass: string;
  panelClass: string;
  headClass: string;
  bodyClass: string;
  bodyRef?: (el: HTMLDivElement | null) => void;
  footClass?: string | undefined;
  closeClass: string;
  closeLabel?: string;
  modalOnPanel?: boolean;
  hideHeader?: boolean;
}

export function Dialog({
  title,
  children,
  footer,
  onClose,
  overlayClass,
  panelClass,
  headClass,
  bodyClass,
  bodyRef,
  footClass,
  closeClass,
  closeLabel = 'Close',
  modalOnPanel = false,
  hideHeader = false,
}: DialogProps) {
  const { closing, requestClose } = useOverlayDismiss(onClose);
  const panelRef = useFocusTrap<HTMLDivElement>(true);

  const modal = {
    role: 'dialog' as const,
    'aria-modal': true as const,
    'aria-label': title,
  };

  return (
    <div
      className={overlayClass}
      data-closing={closing ? 'true' : undefined}
      onClick={requestClose}
      {...(modalOnPanel ? {} : modal)}
    >
      <div
        ref={panelRef}
        className={panelClass}
        data-closing={closing ? 'true' : undefined}
        onClick={(e) => e.stopPropagation()}
        {...(modalOnPanel ? modal : {})}
      >
        {!hideHeader && <div className={headClass}>
          <h2>{title}</h2>
          {onClose && (
            <button
              type="button"
              className={`fo-dialog-close ${closeClass}`}
              onClick={requestClose}
              aria-label={closeLabel}
              title={closeLabel}
            >
              <CloseIcon size={24} aria-hidden="true" />
            </button>
          )}
        </div>}
        {hideHeader && onClose && <button type="button" className={`fo-dialog-close ${closeClass} fo-dialog-floating-close`} onClick={requestClose} aria-label={closeLabel} title={closeLabel}><CloseIcon size={24} aria-hidden="true" /></button>}
        <div className={bodyClass} ref={bodyRef}>
          {children}
        </div>
        {footer && footClass && (
          <div className={footClass}>
            {typeof footer === 'function' ? footer(requestClose) : footer}
          </div>
        )}
      </div>
    </div>
  );
}
