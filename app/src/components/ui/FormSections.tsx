import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface FormSection {
  name: string;
  content: ReactNode;
}

export function FormSections({ sections }: { sections: FormSection[] }) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const toggle = (name: string) =>
    setCollapsed((c) => (c.includes(name) ? c.filter((n) => n !== name) : [...c, name]));

  return (
    <>
      {sections.map((section) => {
        const open = !collapsed.includes(section.name);
        return (
          <section
            key={section.name}
            className="fo-form-accordion"
            data-open={open ? 'true' : 'false'}
          >
            <button
              type="button"
              className="fo-form-accordion-head"
              aria-expanded={open}
              onClick={() => toggle(section.name)}
            >
              <ChevronDown size={20} aria-hidden="true" />
              {section.name}
            </button>
            <div className="fo-form-accordion-collapse">
              <div className="fo-form-accordion-clip">
                <div className="fo-form-accordion-pad">{section.content}</div>
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
