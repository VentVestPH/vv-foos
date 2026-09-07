import type { ReactNode } from 'react';
import { Dialog as UiDialog } from '../../../components/ui/Dialog';

interface DialogProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode | ((close: () => void) => ReactNode);
  onClose: () => void;
}

export function Dialog({ title, children, footer, onClose }: DialogProps) {
  return (
    <UiDialog
      title={title}
      footer={footer}
      onClose={onClose}
      overlayClass="rq-overlay"
      panelClass="rq-dialog"
      headClass="rq-dialog-head"
      bodyClass="rq-dialog-body"
      footClass="rq-dialog-foot"
      closeClass="rq-dialog-x"
      closeLabel="Close dialog"
    >
      {children}
    </UiDialog>
  );
}
