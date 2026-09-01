// Saved views over ats_saved_views (Gate 2 migration). RLS scopes rows to
// staff_id = auth.uid(); the .eq('staff_id', …) here is belt and braces.

import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../auth/SessionProvider';
import type { Json } from '../../../lib/database.types';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Dialog } from '../components/Dialog';
import { supabase } from './data';
import type { SavedView, SortState } from './data';

export interface ViewState {
  filters: Record<string, string>;
  columns: string[];
  sort: SortState | null;
}

export function parseViewState(view: SavedView): ViewState {
  const filters =
    view.filters && typeof view.filters === 'object' && !Array.isArray(view.filters)
      ? (view.filters as Record<string, string>)
      : {};
  const columns = Array.isArray(view.columns)
    ? (view.columns as string[])
    : [];
  const sort =
    view.sort && typeof view.sort === 'object' && !Array.isArray(view.sort)
      ? (view.sort as unknown as SortState)
      : null;
  return { filters, columns, sort };
}

export function useSavedViews(entity: 'requisition' | 'candidate') {
  const { staff } = useSession();
  const [views, setViews] = useState<SavedView[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!staff) return;
    const { data, error: err } = await supabase
      .from('ats_saved_views')
      .select('*')
      .eq('entity', entity)
      .eq('staff_id', staff.id)
      .order('created_at');
    if (err) {
      setError(err.message);
    } else {
      setViews(data ?? []);
    }
  }, [entity, staff]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (name: string, state: ViewState) => {
      if (!staff) return;
      const { error: err } = await supabase.from('ats_saved_views').insert({
        staff_id: staff.id,
        entity,
        name,
        filters: state.filters as unknown as Json,
        columns: state.columns as unknown as Json,
        sort: state.sort as unknown as Json,
      });
      if (err) {
        setError(err.message);
      } else {
        await refresh();
      }
    },
    [entity, staff, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: err } = await supabase
        .from('ats_saved_views')
        .delete()
        .eq('id', id);
      if (err) {
        setError(err.message);
      } else {
        await refresh();
      }
    },
    [refresh],
  );

  return { views, save, remove, error };
}

interface SavedViewsControlProps {
  views: SavedView[];
  /** Snapshot of the current filters + visible columns + sort. */
  currentState: () => ViewState;
  onApply: (state: ViewState) => void;
  onSave: (name: string, state: ViewState) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}

/** Dropdown of saved views plus save/delete, for the ListPage saved-views slot. */
export function SavedViewsControl({
  views,
  currentState,
  onApply,
  onSave,
  onDelete,
}: SavedViewsControlProps) {
  const [selectedId, setSelectedId] = useState('');
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  return (
    <div className="saved-views">
      <Select
        aria-label="Saved views"
        options={views.map((v) => ({ value: v.id, label: v.name }))}
        placeholder="Saved views…"
        value={selectedId}
        onChange={(e) => {
          const id = e.target.value;
          setSelectedId(id);
          const view = views.find((v) => v.id === id);
          if (view) onApply(parseViewState(view));
        }}
      />
      <Button size="sm" onClick={() => setNaming(true)}>
        Save view
      </Button>
      {selectedId && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void onDelete(selectedId);
            setSelectedId('');
          }}
        >
          Delete view
        </Button>
      )}
      {naming && (
        <Dialog
          title="Save view"
          onClose={() => setNaming(false)}
          footer={
            <>
              <Button onClick={() => setNaming(false)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!name.trim()}
                onClick={() => {
                  void onSave(name.trim(), currentState());
                  setNaming(false);
                  setName('');
                }}
              >
                Save
              </Button>
            </>
          }
        >
          <Input
            label="View name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </Dialog>
      )}
    </div>
  );
}
