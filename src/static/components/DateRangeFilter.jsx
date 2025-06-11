import React from 'react';
import { useState, useEffect } from 'react';

const PRESETS = [
  { value: 'all', label: 'All Time' },
  { value: 'current_year', label: 'Current Year' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' }
];

const DateRangeFilter = ({
  value = { preset: 'all', from: '', to: '' },
  onChange
}) => {
  const [preset, setPreset] = useState(value.preset || 'all');
  const [from, setFrom] = useState(value.from || '');
  const [to, setTo] = useState(value.to || '');

  useEffect(() => {
    if (preset !== 'custom') {
      onChange({ preset, from: '', to: '' });
    } else {
      onChange({ preset, from, to });
    }
    // eslint-disable-next-line
  }, [preset, from, to]);

  return (
    <div className="date-range-filter">
      <select
        className="form-control"
        value={preset}
        onChange={e => setPreset(e.target.value)}
      >
        {PRESETS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {preset === 'custom' && (
        <div className="custom-range-fields" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            type="date"
            className="form-control"
            value={from}
            onChange={e => setFrom(e.target.value)}
            max={to || undefined}
            placeholder="From"
          />
          <span style={{ alignSelf: 'center' }}>to</span>
          <input
            type="date"
            className="form-control"
            value={to}
            onChange={e => setTo(e.target.value)}
            min={from || undefined}
            placeholder="To"
          />
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;