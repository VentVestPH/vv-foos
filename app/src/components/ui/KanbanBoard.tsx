import type { ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';

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

function Card({ card }: { card: KanbanCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: card.id });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'kanban-card dragging' : 'kanban-card'}
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
}: {
  stage: KanbanStage;
  cards: KanbanCard[];
  extras?: ReactNode;
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
          <Card key={c.id} card={c} />
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const card = cards.find((c) => c.id === String(active.id));
    const toStage = String(over.id);
    if (card && card.stage !== toStage) {
      onMove(card.id, toStage);
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
          />
        ))}
      </div>
    </DndContext>
  );
}
