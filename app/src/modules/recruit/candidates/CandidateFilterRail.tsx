import { Button } from '../../../components/ui/Button';
import { FilterFoot, FilterGroup } from '../../../components/ui/FilterGroup';
import { DateField } from '../../../components/ui/DateField';
import { Select } from '../../../components/ui/Select';
import type { Lookups } from '../hooks';
import type { SortState } from '../lib';
import {
  ALL_COLUMN_KEYS,
  COLUMN_DEFS,
  EMPTY_FILTERS,
  type CandFilters,
} from './candidateRows';
import { useScrollShadow } from '../../../hooks/useScrollShadow';

export interface CandidateFilterRailProps {
  lookups: Lookups;
  filters: CandFilters;
  setFilters: (next: CandFilters) => void;
  setSort: (next: SortState | null) => void;
  hiddenCols: string[];
  setHiddenCols: (next: string[]) => void;
  setColumnOrder: (next: string[]) => void;
}

export function CandidateFilterRail({
  lookups,
  filters,
  setFilters,
  setSort,
  hiddenCols,
  setHiddenCols,
  setColumnOrder,
}: CandidateFilterRailProps) {
  const listShadow = useScrollShadow<HTMLDivElement>();
  return (
      <div className="fo-advanced-search-body">
      <FilterGroup label="Filter" defaultOpen>
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
      </FilterGroup>
      <FilterGroup label="Initial date">
      <DateField
        label="From"
        value={filters.dateFrom}
        onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
      />
      <DateField
        label="To"
        value={filters.dateTo}
        onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
      />
      </FilterGroup>
      <FilterGroup
        label={`Columns (${ALL_COLUMN_KEYS.length - hiddenCols.length} of ${ALL_COLUMN_KEYS.length})`}
      >
      <div className="field">
        <div className="checkbox-list fo-scroll-shade" ref={listShadow}>
          {COLUMN_DEFS.map((c) => (
            <label key={c.key} className="checkline">
              <input
                type="checkbox"
                checked={!hiddenCols.includes(c.key)}
                onChange={(e) =>
                  setHiddenCols(
                    e.target.checked
                      ? hiddenCols.filter((k) => k !== c.key)
                      : [...hiddenCols, c.key],
                  )
                }
              />
              {c.header}
            </label>
          ))}
        </div>
      </div>
      </FilterGroup>
      <FilterFoot>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setFilters(EMPTY_FILTERS);
            setSort(null);
            setColumnOrder(ALL_COLUMN_KEYS);
            setHiddenCols([]);
          }}
        >
          Clear filters
        </Button>
      </FilterFoot>
      </div>
  );
}
