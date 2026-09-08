import { Button } from './Button';
import { Dialog } from './Dialog';
import type { SectionPrefs } from '../../hooks/useSectionPrefs';

interface SectionSettingsDialogProps {
  title: string;
  hint: string;
  sections: string[];
  prefs: SectionPrefs;
  onClose: () => void;
}

export function SectionSettingsDialog({
  title,
  hint,
  sections,
  prefs,
  onClose,
}: SectionSettingsDialogProps) {
  const hiddenCount = sections.filter((section) => prefs.isHidden(section)).length;

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
      footer={(dismiss) => (
        <>
          <Button
            size="sm"
            variant="ghost"
            onClick={prefs.showAll}
            disabled={hiddenCount === 0}
          >
            Show all
          </Button>
          <Button size="sm" variant="primary" onClick={dismiss}>
            Done
          </Button>
        </>
      )}
    >
      <p className="fo-dialog-hint">{hint}</p>
      {prefs.error && <p className="form-error">{prefs.error}</p>}
      <div className="checkbox-list">
        {sections.map((section) => (
          <label key={section} className="checkline">
            <input
              type="checkbox"
              checked={!prefs.isHidden(section)}
              onChange={() => prefs.toggle(section)}
            />
            {section}
          </label>
        ))}
      </div>
    </Dialog>
  );
}
