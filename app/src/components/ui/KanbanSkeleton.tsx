export function KanbanSkeleton({
  stages,
  label,
  cards = 2,
  className,
}: {
  stages: { key: string; label: string }[];
  label: string;
  cards?: number;
  className?: string;
}) {
  return (
    <div className={['kanban-wrap', 'kanban-skeleton', className].filter(Boolean).join(' ')} role="status" aria-label={label}>
      <div className="kanban" aria-hidden="true">
        {stages.map((stage) => (
          <section className="kanban-col" key={stage.key}>
            <div className="kanban-col-header">
              {stage.label}
              <span className="skeleton-row" />
            </div>
            <div className="kanban-col-body">
              {Array.from({ length: cards }, (_, index) => <span className="skeleton-card" key={index} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
