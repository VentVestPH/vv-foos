import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import type { DateRange, DateRangePreset } from '../lib';
import { rangeForPreset } from '../lib';

const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'quarter', label: 'This quarter (90d)' },
  { value: 'custom', label: 'Custom' },
];

export function DateRangeFilter({
  range,
  onChange,
}: {
  range: DateRange;
  onChange: (range: DateRange) => void;
}) {
  return (
    <div className="dash-daterange">
      <Select
        options={PRESETS}
        value={range.preset}
        onChange={(e) =>
          onChange(rangeForPreset(e.target.value as DateRangePreset, range.from, range.to))
        }
      />
      {range.preset === 'custom' && (
        <>
          <Input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => onChange({ ...range, from: e.target.value })}
          />
          <span>to</span>
          <Input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => onChange({ ...range, to: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
