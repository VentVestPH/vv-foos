import type { ReactNode } from 'react';
import { FoDialog } from './FoDialog';

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
    <FoDialog title={title} onClose={onClose} footer={footer}>
      <p className="fo-dialog-hint">{hint}</p>
      {children}
    </FoDialog>
  );
}
