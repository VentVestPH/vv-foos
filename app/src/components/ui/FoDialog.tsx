import type { ReactNode } from 'react';
import { Dialog } from './Dialog';
import { useScrollShadow } from '../../hooks/useScrollShadow';

interface FoDialogProps {
  title: string;
  className?: string;
  wide?: boolean;
  footer?: ReactNode | ((close: () => void) => ReactNode);
  onClose: () => void;
  children: ReactNode;
  hideHeader?: boolean;
}

export function FoDialog({
  title,
  className,
  wide = false,
  footer,
  onClose,
  children,
  hideHeader = false,
}: FoDialogProps) {
  const bodyShade = useScrollShadow<HTMLDivElement>();
  const panel = ['fo-dialog-panel', wide ? 'fo-dialog-panel-wide' : null, className]
    .filter(Boolean)
    .join(' ');

  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={footer}
      overlayClass="fo-dialog-overlay"
      panelClass={panel}
      headClass="fo-dialog-head"
      bodyClass="fo-dialog-body fo-scroll-shade"
      bodyRef={bodyShade}
      footClass="fo-dialog-foot"
      closeClass="fo-dialog-x"
      closeLabel="Close dialog"
      hideHeader={hideHeader}
    >
      {children}
    </Dialog>
  );
}
