export function TableSkeleton({
  columns,
  rows = 8,
  label = 'Loading rows',
}: {
  columns: string[];
  rows?: number;
  label?: string;
}) {
  return (
    <div className="table-wrap fo-table-skeleton" role="status" aria-label={label}>
      <table className="table zebra" aria-hidden="true">
        <thead>
          <tr>
            {columns.map((column) => <th key={column}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              {columns.map((column, index) => (
                <td key={column}>
                  <span className="skeleton-row fo-skel-cell" data-wide={index === 0 ? 'true' : undefined} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
