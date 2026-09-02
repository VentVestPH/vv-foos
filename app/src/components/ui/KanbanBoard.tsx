import { useEffect, useState, type ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';

const SETTLE_MS = 200;

export interface KanbanStage {
  key: string;
  label: string;
}

export interface KanbanCard {
  id: string;
  stage: string;
  content: ReactNode;
}

interface KanbanBoardProps {
  stages: KanbanStage[];
  cards: KanbanCard[];

  onMove: (cardId: string, toStage: string) => void;

  columnExtras?: (stageKey: string) => ReactNode;
}

function Card({ card, settling }: { card: KanbanCard; settling: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: card.id });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;
  const className = ['kanban-card'];
  if (isDragging) className.push('dragging');
  if (settling) className.push('settling');
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={className.join(' ')}
      {...listeners}
      {...attributes}
    >
      {card.content}
    </div>
  );
}

function Column({
  stage,
  cards,
  extras,
  settlingId,
}: {
  stage: KanbanStage;
  cards: KanbanCard[];
  extras?: ReactNode;
  settlingId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });
  return (
    <div
      ref={setNodeRef}
      className={isOver ? 'kanban-col drop-over' : 'kanban-col'}
    >
      <div className="kanban-col-header">
        {stage.label}
        {extras}
        <span className="kanban-col-count">{cards.length}</span>
      </div>
      <div className="kanban-col-body">
        {cards.map((c) => (
          <Card key={c.id} card={c} settling={c.id === settlingId} />
        ))}
      </div>
    </div>
  );
}

export function KanbanBoard({
  stages,
  cards,
  onMove,
  columnExtras,
}: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const [settlingId, setSettlingId] = useState<string | null>(null);

  useEffect(() => {
    if (!settlingId) return;
    const timer = setTimeout(() => setSettlingId(null), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [settlingId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const card = cards.find((c) => c.id === String(active.id));
    const toStage = String(over.id);
    if (card && card.stage !== toStage) {
      onMove(card.id, toStage);
      setSettlingId(card.id);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="kanban">
        {stages.map((stage) => (
          <Column
            key={stage.key}
            stage={stage}
            cards={cards.filter((c) => c.stage === stage.key)}
            extras={columnExtras?.(stage.key)}
            settlingId={settlingId}
          />
        ))}
      </div>
    </DndContext>
  );
}
