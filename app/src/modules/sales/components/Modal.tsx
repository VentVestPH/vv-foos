import type { ReactNode } from 'react';
import { Dialog as UiDialog } from '../../../components/ui/Dialog';

interface ModalProps {
  title: string;
  children: ReactNode;

  onClose?: () => void;
}

export function Modal({ title, children, onClose }: ModalProps) {
  return (
    <UiDialog
      title={title}
      onClose={onClose}
      overlayClass="sales-modal-overlay"
      panelClass="sales-modal"
      headClass="sales-modal-head"
      bodyClass="sales-modal-body"
      closeClass="sales-modal-x"
    >
      {children}
    </UiDialog>
  );
}
