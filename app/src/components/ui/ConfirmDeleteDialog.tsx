import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { FoDialog } from './FoDialog';
import { errMsg } from '../../lib/errMsg';

interface ConfirmDeleteDialogProps {
  title: string;
  confirmLabel?: string;
  busyLabel?: string;
  confirmDisabled?: boolean;
  confirmTitle?: string | undefined;
  wide?: boolean;
  children: ReactNode;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmDeleteDialog({
  title,
  confirmLabel = 'Delete permanently',
  busyLabel = 'Deleting…',
  confirmDisabled = false,
  confirmTitle,
  wide = false,
  children,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <FoDialog
      title={title}
      onClose={onClose}
      wide={wide}
      footer={(close) => (
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="danger"
            disabled={busy || confirmDisabled}
            title={confirmTitle}
            onClick={() => void run()}
          >
            {busy ? busyLabel : confirmLabel}
          </Button>
        </>
      )}
    >
      {children}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </FoDialog>
  );
}

export function ConfirmDeleteGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="fo-confirm-group">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function ConfirmDeleteList({ children }: { children: ReactNode }) {
  return <ul className="fo-confirm-list">{children}</ul>;
}
