import { useMemo } from 'react';

export interface StatusChange {
  id: string;
  subject: string | null;
  body?: string | null;
  occurred_at: string;
}

interface StatusHistoryRow {
  id: string;
  label: string;
  previous: string;
  status: string;
  dateIn: string;
  dateOut: string | null;
  duration: string;
  comments: string;
}

const SUBJECT = /^(.*?):\s*(.*?)\s*->\s*(.*)$/;

function humanise(value: string): string {
  const cleaned = value.replace(/_/g, ' ').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(fromIso: string, toIso: string | null): string {
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((to - from) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function buildRows(changes: StatusChange[]): StatusHistoryRow[] {
  const parsed = changes
    .map((change) => {
      const match = change.subject ? SUBJECT.exec(change.subject) : null;
      if (!match) return null;
      return {
        id: change.id,
        label: match[1].trim(),
        previous: humanise(match[2]),
        status: humanise(match[3]),
        occurredAt: change.occurred_at,
        comments: change.body ?? '',
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  return parsed.map((row, index) => {
    const nextSameLabel = parsed.slice(index + 1).find((later) => later.label === row.label);
    const dateOut = nextSameLabel?.occurredAt ?? null;
    return {
      id: row.id,
      label: row.label,
      previous: row.previous,
      status: row.status,
      dateIn: formatDate(row.occurredAt),
      dateOut: dateOut ? formatDate(dateOut) : null,
      duration: formatDuration(row.occurredAt, dateOut),
      comments: row.comments,
    };
  }).reverse();
}

export function StatusHistory({ changes }: { changes: StatusChange[] }) {
  const rows = useMemo(() => buildRows(changes), [changes]);

  if (rows.length === 0) {
    return <p className="text-secondary">No status changes recorded.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="table zebra">
        <caption className="visually-hidden">Status history</caption>
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Previous status</th>
            <th scope="col">Duration</th>
            <th scope="col">Date in</th>
            <th scope="col">Date out</th>
            <th scope="col">Comments</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.status}</td>
              <td>{row.previous}</td>
              <td>{row.duration}</td>
              <td>{row.dateIn}</td>
              <td>{row.dateOut ?? 'Current'}</td>
              <td>{row.comments}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
