import { Eye, GripVertical, RotateCcw } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useState } from 'react';
import { Button } from './Button';
import { SettingsDialog } from './SettingsDialog';
import type { SectionPrefs } from '../../hooks/useSectionPrefs';
import { useScrollShadow } from '../../hooks/useScrollShadow';
import { moveSection, sameOrder } from '../../lib/sectionOrder';

interface SectionSettingsDialogProps {
  title: string;
  hint: string;
  sections: string[];
  prefs: SectionPrefs;
  defaultOpenFor?: (section: string) => boolean;
  defaultOrder?: string[];
  onClose: () => void;
}

interface SectionRowProps {
  section: string;
  shown: boolean;
  lastShown: boolean;
  fallbackOpen: boolean;
  prefs: SectionPrefs;
  reorderable: boolean;
  onNudge: (delta: -1 | 1) => void;
}

function SectionRow({
  section,
  shown,
  lastShown,
  fallbackOpen,
  prefs,
  reorderable,
  onNudge,
}: SectionRowProps) {
  const drag = useDraggable({ id: section, disabled: !reorderable });
  const drop = useDroppable({ id: section, disabled: !reorderable });

  return (
    <div
      ref={reorderable ? drop.setNodeRef : undefined}
      className="fo-section-row"
      data-hidden={shown ? undefined : 'true'}
      data-over={drop.isOver && !drag.isDragging ? 'true' : undefined}
      data-dragging={drag.isDragging ? 'true' : undefined}
    >
      {reorderable && (
        <button
          type="button"
          ref={drag.setNodeRef}
          className="fo-column-grip"
          aria-label={`Reorder ${section}`}
          title="Drag to reorder, or use the arrow keys"
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              onNudge(-1);
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              onNudge(1);
            }
          }}
          {...drag.attributes}
          {...drag.listeners}
        >
          <GripVertical size={20} aria-hidden="true" />
        </button>
      )}
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
          checked={shown && prefs.opensOnLoad(section, fallbackOpen)}
          disabled={!shown}
          onChange={() => prefs.toggleOpensOnLoad(section, fallbackOpen)}
        />
        <span className="fo-switch-track" aria-hidden="true" />
      </label>
    </div>
  );
}

export function SectionSettingsDialog({
  title,
  hint,
  sections,
  prefs,
  defaultOpenFor,
  defaultOrder,
  onClose,
}: SectionSettingsDialogProps) {
  const listShadow = useScrollShadow<HTMLDivElement>();
  const reorderable = defaultOrder !== undefined;
  const ordered = defaultOrder ? prefs.orderFor(defaultOrder) : sections;
  const orderCustomised = defaultOrder ? !sameOrder(ordered, defaultOrder) : false;
  const [dragged, setDragged] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const hiddenCount = sections.filter((section) => prefs.isHidden(section)).length;
  const shownCount = sections.length - hiddenCount;

  return (
    <SettingsDialog
      title={title}
      hint={hint}
      onClose={onClose}
      footer={(dismiss) => (
        <>
          {reorderable && (
            <Button
              size="sm"
              variant="ghost"
              onClick={prefs.resetOrder}
              disabled={!orderCustomised}
              title={orderCustomised ? undefined : 'The sections are already in the default order'}
            >
              <RotateCcw size={20} aria-hidden="true" />
              Reset order
            </Button>
          )}
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
      <div className="fo-section-table" data-reorder={reorderable ? 'true' : undefined}>
        <div className="fo-section-row fo-section-row-head" aria-hidden="true">
          {reorderable && <span />}
          <span>Section</span>
          <span>Show</span>
          <span>Open on load</span>
        </div>
        <DndContext
          sensors={sensors}
          onDragStart={({ active }: DragStartEvent) => setDragged(String(active.id))}
          onDragEnd={({ active, over }: DragEndEvent) => {
            setDragged(null);
            if (!over || !defaultOrder) return;
            const from = ordered.indexOf(String(active.id));
            const to = ordered.indexOf(String(over.id));
            if (from < 0 || to < 0) return;
            prefs.setOrder(moveSection(ordered, from, to));
          }}
          onDragCancel={() => setDragged(null)}
        >
          <div className="fo-section-list fo-scroll-shade" ref={listShadow}>
            {ordered.map((section, index) => {
              const shown = !prefs.isHidden(section);
              return (
                <SectionRow
                  key={section}
                  section={section}
                  shown={shown}
                  lastShown={shown && shownCount === 1}
                  fallbackOpen={defaultOpenFor?.(section) ?? true}
                  prefs={prefs}
                  reorderable={reorderable}
                  onNudge={(delta) => prefs.setOrder(moveSection(ordered, index, index + delta))}
                />
              );
            })}
          </div>
          <DragOverlay dropAnimation={null}>
            {dragged !== null && (
              <div className="fo-section-row is-dragging">
                <span className="fo-column-grip" aria-hidden="true">
                  <GripVertical size={20} />
                </span>
                <span className="fo-section-name">{dragged}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
      <p className="fo-section-count" role="status">
        {shownCount} of {sections.length} sections showing
      </p>
    </SettingsDialog>
  );
}
