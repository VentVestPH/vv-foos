import { Eye } from 'lucide-react';
import { Button } from './Button';
import { SettingsDialog } from './SettingsDialog';
import type { SectionPrefs } from '../../hooks/useSectionPrefs';
import { useScrollShadow } from '../../hooks/useScrollShadow';

interface SectionSettingsDialogProps {
  title: string;
  hint: string;
  sections: string[];
  prefs: SectionPrefs;
  defaultOpenFor?: (section: string) => boolean;
  onClose: () => void;
}

export function SectionSettingsDialog({
  title,
  hint,
  sections,
  prefs,
  defaultOpenFor,
  onClose,
}: SectionSettingsDialogProps) {
  const listShadow = useScrollShadow<HTMLDivElement>();
  const hiddenCount = sections.filter((section) => prefs.isHidden(section)).length;
  const shownCount = sections.length - hiddenCount;

  return (
    <SettingsDialog
      title={title}
      hint={hint}
      onClose={onClose}
      footer={(dismiss) => (
        <>
          <Button
            size="sm"
            variant="secondary"
            onClick={prefs.showAll}
            disabled={hiddenCount === 0}
            title={hiddenCount === 0 ? 'Every section is already showing' : undefined}
          >
            <Eye size={20} aria-hidden="true" />
            Show all
          </Button>
          <Button size="sm" variant="primary" onClick={dismiss}>
            Done
          </Button>
        </>
      )}
    >
      {prefs.error && <p className="form-error">{prefs.error}</p>}
      <div className="fo-section-table">
        <div className="fo-section-row fo-section-row-head" aria-hidden="true">
          <span>Section</span>
          <span>Show</span>
          <span>Open on load</span>
        </div>
        <div className="fo-section-list fo-scroll-shade" ref={listShadow}>
          {sections.map((section) => {
            const shown = !prefs.isHidden(section);
            const fallback = defaultOpenFor?.(section) ?? true;
            const lastShown = shown && shownCount === 1;
            return (
              <div key={section} className="fo-section-row" data-hidden={shown ? undefined : 'true'}>
                <span className="fo-section-name">{section}</span>
                <label className="fo-switch">
                  <input
                    type="checkbox"
                    aria-label={section}
                    title={lastShown ? 'This is the last section showing. Show another one first.' : undefined}
                    checked={shown}
                    disabled={lastShown}
                    onChange={() => prefs.toggle(section)}
                  />
                  <span className="fo-switch-track" aria-hidden="true" />
                </label>
                <label className="fo-switch fo-section-row-open">
                  <input
                    type="checkbox"
                    aria-label={`Open ${section} on page load`}
                    title={shown ? undefined : 'Show the section first'}
                    checked={shown && prefs.opensOnLoad(section, fallback)}
                    disabled={!shown}
                    onChange={() => prefs.toggleOpensOnLoad(section, fallback)}
                  />
                  <span className="fo-switch-track" aria-hidden="true" />
                </label>
              </div>
            );
          })}
        </div>
      </div>
      <p className="fo-section-count" role="status">
        {shownCount} of {sections.length} sections showing
      </p>
    </SettingsDialog>
  );
}
