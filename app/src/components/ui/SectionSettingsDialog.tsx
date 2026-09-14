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
      {prefs.error && <p className="form-error">{prefs.error}</p>}
      <div className="fo-section-row fo-section-row-head" aria-hidden="true">
        <span>Section</span>
        <span>Open on load</span>
      </div>
      <div className="checkbox-list fo-scroll-shade" ref={listShadow}>
        {sections.map((section) => {
          const shown = !prefs.isHidden(section);
          const fallback = defaultOpenFor?.(section) ?? true;
          return (
            <div key={section} className="fo-section-row">
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={shown}
                  disabled={shown && shownCount === 1}
                  title={
                    shown && shownCount === 1
                      ? 'This is the last section showing. Tick another one first.'
                      : undefined
                  }
                  onChange={() => prefs.toggle(section)}
                />
                {section}
              </label>
              <label className="checkline fo-section-row-open">
                <input
                  type="checkbox"
                  checked={shown && prefs.opensOnLoad(section, fallback)}
                  disabled={!shown}
                  title={shown ? undefined : 'Show the section first'}
                  onChange={() => prefs.toggleOpensOnLoad(section, fallback)}
                />
                <span className="visually-hidden">{`Open ${section} on page load`}</span>
              </label>
            </div>
          );
        })}
      </div>
    </SettingsDialog>
  );
}
