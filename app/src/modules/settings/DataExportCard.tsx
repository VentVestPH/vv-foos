import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { downloadCsv } from '../../lib/csv';
import { supabase } from '../../lib/supabase';
import { useLatestOnly } from '../../lib/useLatestOnly';
import { useRole } from '../../auth/SessionProvider';
import { EXPORTABLE_MODULES, EXPORT_PAGE_SIZE, EXPORT_ROW_CAP, type ExportableModule } from './lib';

type Counts = Record<string, number | null>;

export function DataExportCard() {
  const role = useRole();
  const [counts, setCounts] = useState<Counts>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const beginLoad = useLatestOnly();

  const loadCounts = useCallback(async () => {
    const isCurrent = beginLoad();
    const next: Counts = {};
    for (const m of EXPORTABLE_MODULES) {
      const { count, error: err } = await supabase
        .from(m.view)
        .select('*', { count: 'exact', head: true });
      next[m.key] = err ? null : (count ?? 0);
    }
    if (!isCurrent()) return;
    setCounts(next);
  }, [beginLoad]);

  useEffect(() => {
    if (role !== 'admin') return;
    void loadCounts();
  }, [role, loadCounts]);

  const exportModule = useCallback(async (m: ExportableModule) => {
    setBusy(m.key);
    setProgress(0);
    setError(null);
    setDone(null);
    try {
      const total = counts[m.key] ?? 0;
      if (total > EXPORT_ROW_CAP) {
        setError(
          `${m.label} holds ${total.toLocaleString()} rows, more than the ${EXPORT_ROW_CAP.toLocaleString()} an in-browser export can build. Export it from the module's own list with a filter applied.`,
        );
        return;
      }

      const collected: Record<string, unknown>[] = [];
      for (let start = 0; start < EXPORT_ROW_CAP; start += EXPORT_PAGE_SIZE) {
        const { data, error: err } = await supabase
          .from(m.view)
          .select(m.columns.map((c) => c.key).join(', '))
          .order(m.orderBy, { ascending: true })
          .range(start, start + EXPORT_PAGE_SIZE - 1);
        if (err) throw new Error(err.message);
        const batch = (data ?? []) as unknown as Record<string, unknown>[];
        collected.push(...batch);
        setProgress(collected.length);
        if (batch.length < EXPORT_PAGE_SIZE) break;
      }

      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`foos-${m.key}-${stamp}.csv`, collected, m.columns);
      setDone(`${m.label}: ${collected.length.toLocaleString()} row(s) exported.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [counts]);

  if (role !== 'admin') {
    return (
      <p className="text-secondary" data-testid="export-not-admin">
        Exporting data is restricted to administrators.
      </p>
    );
  }

  return (
    <div className="settings-export" data-testid="data-export">
      <p className="text-secondary">
        Every export reads the same database views the list screens use, so it returns exactly the rows
        you are allowed to see and nothing more. Rows are paged from the database rather than assembled
        in the browser, a thousand at a time, so a large module takes a little while: candidates is
        72,917 rows over 73 requests and about 20 seconds.
      </p>

      {error && <p className="form-error">{error}</p>}
      {done && <p className="settings-export-done">{done}</p>}

      <table className="table settings-export-table">
        <thead>
          <tr>
            <th scope="col">Module</th>
            <th scope="col" className="settings-export-count">Rows</th>
            <th scope="col">Export</th>
          </tr>
        </thead>
        <tbody>
          {EXPORTABLE_MODULES.map((m) => {
            const n = counts[m.key];
            return (
              <tr key={m.key}>
                <th scope="row">{m.label}</th>
                <td className="settings-export-count" data-testid={`count-${m.key}`}>
                  {n === undefined ? '…' : n === null ? 'unavailable' : n.toLocaleString()}
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy !== null || n === null || n === 0}
                    onClick={() => void exportModule(m)}
                    data-testid={`export-${m.key}`}
                  >
                    <Download size={13} />
                    {busy === m.key
                      ? `Exporting… ${progress.toLocaleString()} of ${(n ?? 0).toLocaleString()}`
                      : 'Export CSV'}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
