import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../auth/SessionProvider';
import type { Json } from '../../lib/database.types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Dialog } from './components/Dialog';
import { supabase } from '../../lib/supabase';
import type { SavedView, SortState } from './lib';

export interface ViewState {
  filters: Record<string, string>;
  columns: string[];
  sort: SortState | null;
}

function parseViewState(view: SavedView): ViewState {
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
      .or(`staff_id.eq.${staff.id},is_shared.is.true`)
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
    async (name: string, state: ViewState, shared = false) => {
      if (!staff) return;
      const { error: err } = await supabase.from('ats_saved_views').insert({
        staff_id: staff.id,
        entity,
        name,
        is_shared: shared,
        filters: (state.filters ?? {}) as unknown as Json,
        columns: (state.columns ?? []) as unknown as Json,
        sort: (state.sort ?? []) as unknown as Json,
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

  currentState: () => ViewState;
  onApply: (state: ViewState) => void;
  onSave: (name: string, state: ViewState, shared: boolean) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  ownStaffId?: string | undefined;
}

export function SavedViewsControl({
  views,
  currentState,
  onApply,
  onSave,
  onDelete,
  ownStaffId,
}: SavedViewsControlProps) {
  const [selectedId, setSelectedId] = useState('');
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);

  const selected = views.find((v) => v.id === selectedId);
  const canDelete = Boolean(selected) && (!ownStaffId || selected?.staff_id === ownStaffId);

  return (
    <div className="saved-views">
      <Select
        aria-label="Saved views"
        options={views.map((v) => ({
          value: v.id,
          label: v.is_shared ? `${v.name} (shared)` : v.name,
        }))}
        placeholder="Saved views…"
        placeholderSelectable={false}
        emptyLabel="No saved views yet. Use Save view to add one."
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
          disabled={!canDelete}
          title={canDelete ? undefined : 'Only the person who shared this view can delete it'}
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
          footer={(close) => (
            <>
              <Button onClick={close}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!name.trim()}
                onClick={() => {
                  void onSave(name.trim(), currentState(), shared);
                  setNaming(false);
                  setName('');
                  setShared(false);
                }}
              >
                Save
              </Button>
            </>
          )}
        >
          <Input
            label="View name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <label className="checkline">
            <input
              type="checkbox"
              checked={shared}
              onChange={(e) => setShared(e.target.checked)}
            />
            Share with the team
          </label>
          <p className="text-secondary">
            A shared view is visible to everyone who can open this list. Only you can rename or
            delete it.
          </p>
        </Dialog>
      )}
    </div>
  );
}
