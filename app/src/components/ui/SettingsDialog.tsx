import type { ReactNode } from 'react';
import { Dialog } from './Dialog';

interface SettingsDialogProps {
  title: string;
  hint: string;
  children: ReactNode;
  footer: (close: () => void) => ReactNode;
  onClose: () => void;
}

export function SettingsDialog({
  title,
  hint,
  children,
  footer,
  onClose,
}: SettingsDialogProps) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      overlayClass="fo-dialog-overlay"
      panelClass="fo-dialog-panel"
      headClass="fo-dialog-head"
      bodyClass="fo-dialog-body"
      footClass="fo-dialog-foot"
      closeClass="fo-dialog-x"
      closeLabel="Close dialog"
      footer={footer}
    >
      <p className="fo-dialog-hint">{hint}</p>
      {children}
    </Dialog>
  );
}
