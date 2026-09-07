import type { ReactNode } from 'react';
import { Dialog as UiDialog } from '../../../components/ui/Dialog';

export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <UiDialog
      title={title}
      onClose={onClose}
      overlayClass="intake-drawer-overlay"
      panelClass="intake-drawer fo-record-overlay"
      headClass="intake-drawer-head"
      bodyClass="intake-drawer-body"
      closeClass="intake-drawer-x"
      modalOnPanel
    >
      {children}
    </UiDialog>
  );
}
