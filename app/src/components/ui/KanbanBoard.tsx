import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

const SETTLE_MS = 200;

interface KanbanStage {
  key: string;
  label: string;
}

interface KanbanCard {
  id: string;
  stage: string;
  content: ReactNode;
}

interface KanbanBoardProps {
  stages: KanbanStage[];
  cards: KanbanCard[];

  onMove: (cardId: string, toStage: string) => void;

  columnExtras?: (stageKey: string) => ReactNode;
  stageCounts?: Record<string, number>;
  disabled?: boolean;
}

function Card({
  card,
  settling,
  stageLabel,
  position,
  count,
  grabbed,
  disabled,
  onKeyDown,
}: {
  card: KanbanCard;
  settling: boolean;
  stageLabel: string;
  position: number;
  count: number;
  grabbed: boolean;
  disabled: boolean;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, cardId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, disabled });
  const style = undefined;
  const className = ['kanban-card'];
  if (isDragging) className.push('is-placeholder');
  if (settling) className.push('settling');
  if (grabbed) className.push('grabbed');
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={className.join(' ')}
      {...listeners}
      {...attributes}
      role="group"
      aria-label={`${stageLabel}, ${position} of ${count}${grabbed ? ', grabbed' : ''}`}
      aria-describedby="kanban-keyboard-help"
      onKeyDown={(e) => onKeyDown(e, card.id)}
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
  grabbedId,
  onCardKeyDown,
  count,
  disabled,
}: {
  stage: KanbanStage;
  cards: KanbanCard[];
  extras?: ReactNode;
  settlingId: string | null;
  grabbedId: string | null;
  onCardKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, cardId: string) => void;
  count: number;
  disabled: boolean;
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
        <span className="kanban-col-count">{count}</span>
      </div>
      <div className="kanban-col-body">
        {cards.map((c, i) => (
          <Card
            key={c.id}
            card={c}
            settling={c.id === settlingId}
            stageLabel={stage.label}
            position={i + 1}
            count={cards.length}
            grabbed={c.id === grabbedId}
            disabled={disabled}
            onKeyDown={onCardKeyDown}
          />
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
  stageCounts = {},
  disabled = false,
}: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [grabbedId, setGrabbedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState({ start: false, end: false });

  const syncScroll = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanScroll({ start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 });
  }, []);

  const scrollBoard = (direction: -1 | 1) => {
    const el = boardRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(240, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  useEffect(() => {
    syncScroll();
    const el = boardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(syncScroll);
    observer.observe(el);
    return () => observer.disconnect();
  }, [syncScroll, stages.length, cards.length]);

  const [announcement, setAnnouncement] = useState('');

  const stageOf = (cardId: string) => cards.find((c) => c.id === cardId)?.stage ?? null;
  const labelOf = (stageKey: string) =>
    stages.find((s) => s.key === stageKey)?.label ?? stageKey;

  const move = (cardId: string, direction: -1 | 1) => {
    const from = stageOf(cardId);
    if (!from) return;
    const index = stages.findIndex((s) => s.key === from);
    const next = stages[index + direction];
    if (!next) {
      setAnnouncement(`Already in the ${direction === -1 ? 'first' : 'last'} column.`);
      return;
    }
    onMove(cardId, next.key);
    setSettlingId(cardId);
    setAnnouncement(`Moved to ${next.label}.`);
  };

  const onCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, cardId: string) => {
    if (e.target !== e.currentTarget) return;
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (grabbedId === cardId) {
        setGrabbedId(null);
        setAnnouncement(`Dropped in ${labelOf(stageOf(cardId) ?? '')}.`);
      } else {
        setGrabbedId(cardId);
        setAnnouncement(
          `Grabbed. Use the left and right arrow keys to change column, then press space to drop, or escape to cancel.`,
        );
      }
      return;
    }
    if (e.key === 'Escape' && grabbedId === cardId) {
      e.preventDefault();
      setGrabbedId(null);
      setAnnouncement('Cancelled.');
      return;
    }
    if (grabbedId !== cardId) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      move(cardId, -1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      move(cardId, 1);
    }
  };

  useEffect(() => {
    if (!settlingId) return;
    const timer = setTimeout(() => setSettlingId(null), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [settlingId]);

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingId(null);
    if (!over) return;
    const card = cards.find((c) => c.id === String(active.id));
    const toStage = String(over.id);
    if (card && card.stage !== toStage) {
      onMove(card.id, toStage);
      setSettlingId(card.id);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <p id="kanban-keyboard-help" className="visually-hidden">
        Press space or enter to grab a card, then the left and right arrow keys to move it
        between columns, space to drop it, or escape to cancel.
      </p>
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
      <div className="kanban-wrap">
        <button
          type="button"
          className="fo-kanban-scroll"
          data-side="start"
          onClick={() => scrollBoard(-1)}
          disabled={!canScroll.start}
          aria-label="Scroll the board left"
          title={canScroll.start ? 'Scroll the board left' : 'The board is at its first stage'}
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="fo-kanban-scroll"
          data-side="end"
          onClick={() => scrollBoard(1)}
          disabled={!canScroll.end}
          aria-label="Scroll the board right"
          title={canScroll.end ? 'Scroll the board right' : 'The board is at its last stage'}
        >
          <ChevronRight size={24} aria-hidden="true" />
        </button>
        <div
          className="kanban"
          role="group"
          aria-label="Stage board, scrollable"
          tabIndex={0}
          ref={boardRef}
          onScroll={syncScroll}
        >
          {stages.map((stage) => (
            <Column
              key={stage.key}
              stage={stage}
              cards={cards.filter((c) => c.stage === stage.key)}
              extras={columnExtras?.(stage.key)}
              settlingId={settlingId}
              grabbedId={grabbedId}
              onCardKeyDown={onCardKeyDown}
              count={stageCounts[stage.key] ?? cards.filter((c) => c.stage === stage.key).length}
              disabled={disabled}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {draggingId !== null && (
          <div className="kanban-card is-dragging">
            {cards.find((c) => c.id === draggingId)?.content}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
