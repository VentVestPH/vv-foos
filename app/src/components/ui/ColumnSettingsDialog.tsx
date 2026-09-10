import { GripVertical } from 'lucide-react';
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
import { useScrollShadow } from '../../hooks/useScrollShadow';

interface ColumnSetting {
  key: string;
  header: string;
}

interface ColumnSettingsDialogProps {
  title: string;
  hint: string;
  columns: ColumnSetting[];
  order: string[];
  hidden: string[];
  onOrderChange: (next: string[]) => void;
  onToggle: (key: string) => void;
  onReset: () => void;
  onClose: () => void;
}

function move(order: string[], from: number, to: number): string[] {
  if (to < 0 || to >= order.length || from === to) return order;
  const next = [...order];
  const [key] = next.splice(from, 1);
  if (key === undefined) return order;
  next.splice(to, 0, key);
  return next;
}

function Row({
  columnKey,
  label,
  checked,
  onToggle,
  onNudge,
}: {
  columnKey: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
  onNudge: (delta: -1 | 1) => void;
}) {
  const drag = useDraggable({ id: columnKey });
  const drop = useDroppable({ id: columnKey });

  return (
    <div
      ref={drop.setNodeRef}
      className="fo-column-row"
      data-over={drop.isOver && !drag.isDragging ? 'true' : undefined}
      data-dragging={drag.isDragging ? 'true' : undefined}
    >
      <button
        type="button"
        ref={drag.setNodeRef}
        className="fo-column-grip"
        aria-label={`Reorder ${label}`}
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
      <label className="checkline">
        <input type="checkbox" checked={checked} onChange={onToggle} />
        {label}
      </label>
    </div>
  );
}

export function ColumnSettingsDialog({
  title,
  hint,
  columns,
  order,
  hidden,
  onOrderChange,
  onToggle,
  onReset,
  onClose,
}: ColumnSettingsDialogProps) {
  const listShadow = useScrollShadow<HTMLDivElement>();
  const [dragged, setDragged] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const headerFor = new Map(columns.map((c) => [c.key, c.header]));
  const hiddenSet = new Set(hidden);

  const handleDragStart = ({ active }: DragStartEvent) => setDragged(String(active.id));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDragged(null);
    if (!over) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onOrderChange(move(order, from, to));
  };

  return (
    <SettingsDialog
      title={title}
      hint={hint}
      onClose={onClose}
      footer={(dismiss) => (
        <>
          <Button size="sm" variant="ghost" onClick={onReset}>
            Reset
          </Button>
          <Button size="sm" variant="primary" onClick={dismiss}>
            Done
          </Button>
        </>
      )}
    >
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragged(null)}
      >
        <div className="checkbox-list fo-scroll-shade" ref={listShadow}>
          {order.map((key, index) => (
            <Row
              key={key}
              columnKey={key}
              label={headerFor.get(key) ?? key}
              checked={!hiddenSet.has(key)}
              onToggle={() => onToggle(key)}
              onNudge={(delta) => onOrderChange(move(order, index, index + delta))}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragged !== null && (
            <div className="fo-column-row is-dragging">
              <span className="fo-column-grip" aria-hidden="true">
                <GripVertical size={20} />
              </span>
              <span className="checkline">{headerFor.get(dragged) ?? dragged}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </SettingsDialog>
  );
}
