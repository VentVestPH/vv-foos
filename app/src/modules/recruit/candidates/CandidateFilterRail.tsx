import { Button } from '../../../components/ui/Button';
import { RecordSection } from '../../../components/ui/RecordPage';
import { DateField } from '../../../components/ui/DateField';
import { Select } from '../../../components/ui/Select';
import type { Lookups } from '../hooks';
import type { SortState } from '../lib';
import {
  ALL_COLUMN_KEYS,
  COLUMN_DEFS,
  EMPTY_FILTERS,
  type CandFilters,
  type CandRow,
} from './candidateRows';

export interface CandidateFilterRailProps {
  lookups: Lookups;
  filters: CandFilters;
  setFilters: (next: CandFilters) => void;
  sort: SortState | null;
  setSort: (next: SortState | null) => void;
  visibleCols: (keyof CandRow & string)[];
  setVisibleCols: (next: (keyof CandRow & string)[]) => void;
}

export function CandidateFilterRail({
  lookups,
  filters,
  setFilters,
  sort,
  setSort,
  visibleCols,
  setVisibleCols,
}: CandidateFilterRailProps) {
  return (
    <RecordSection title="Advanced Search">
      <div className="fo-advanced-search-body">
      <Select
        label="Status"
        placeholder="All statuses"
        options={lookups.statuses
          .filter((s) => s.is_active)
          .map((s) => ({ value: s.id, label: s.label }))}
        value={filters.statusId}
        onChange={(e) => setFilters({ ...filters, statusId: e.target.value })}
      />
      <Select
        label="Grade"
        placeholder="Any grade"
        options={[
          { value: '1', label: '1 star' },
          { value: '2', label: '2 stars' },
          { value: '3', label: '3 stars' },
        ]}
        value={filters.starGrade}
        onChange={(e) => setFilters({ ...filters, starGrade: e.target.value })}
      />
      <Select
        label="Source"
        placeholder="All sources"
        options={lookups.sources.map((s) => ({ value: s.id, label: s.name }))}
        value={filters.sourceId}
        onChange={(e) => setFilters({ ...filters, sourceId: e.target.value })}
      />
      <Select
        label="Sourcer"
        placeholder="All sourcers"
        options={lookups.staff.map((s) => ({ value: s.id, label: s.full_name }))}
        value={filters.sourcerId}
        onChange={(e) => setFilters({ ...filters, sourcerId: e.target.value })}
      />
      <DateField
        label="Initial date from"
        value={filters.dateFrom}
        onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
      />
      <DateField
        label="Initial date to"
        value={filters.dateTo}
        onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
      />
      <Select
        label="Sort by"
        placeholder="Default order"
        options={COLUMN_DEFS.map((c) => ({ value: c.key, label: c.header }))}
        value={sort?.key ?? ''}
        onChange={(e) =>
          setSort(
            e.target.value
              ? { key: e.target.value, dir: sort?.dir ?? 'asc' }
              : null,
          )
        }
      />
      {sort && (
        <Select
          label="Direction"
          options={[
            { value: 'asc', label: 'Ascending' },
            { value: 'desc', label: 'Descending' },
          ]}
          value={sort.dir}
          onChange={(e) => setSort({ ...sort, dir: e.target.value as 'asc' | 'desc' })}
        />
      )}
      <div className="field">
        <span className="field-label">Columns</span>
        <div className="checkbox-list">
          {COLUMN_DEFS.map((c) => (
            <label key={c.key} className="checkline">
              <input
                type="checkbox"
                checked={visibleCols.includes(c.key)}
                onChange={(e) =>
                  setVisibleCols(
                    e.target.checked
                      ? [...visibleCols, c.key]
                      : visibleCols.filter((k) => k !== c.key),
                  )
                }
              />
              {c.header}
            </label>
          ))}
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setFilters(EMPTY_FILTERS);
          setSort(null);
          setVisibleCols(ALL_COLUMN_KEYS);
        }}
      >
        Clear filters
      </Button>
      </div>
    </RecordSection>
  );
}
