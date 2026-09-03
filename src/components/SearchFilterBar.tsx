import { useState } from 'react';
import { Search, X } from 'lucide-react';

interface FilterConfig {
  searchPlaceholder?: string;
  statusOptions?: { value: string; label: string }[];
  showDateRange?: boolean;
}

interface FilterState {
  search: string;
  status: string;
  from: string;
  to: string;
}

interface Props {
  config: FilterConfig;
  onFilterChange: (filters: FilterState) => void;
}

export default function SearchFilterBar({ config, onFilterChange }: Props) {
  const [filters, setFilters] = useState<FilterState>({ search: '', status: '', from: '', to: '' });

  const update = (key: keyof FilterState, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    onFilterChange(next);
  };

  const clear = () => {
    const empty = { search: '', status: '', from: '', to: '' };
    setFilters(empty);
    onFilterChange(empty);
  };

  const hasFilters = filters.search || filters.status || filters.from || filters.to;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => update('search', e.target.value)}
              placeholder={config.searchPlaceholder || 'Search...'}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
        </div>
        {config.statusOptions && (
          <div className="min-w-[150px]">
            <select
              value={filters.status}
              onChange={(e) => update('status', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="">All Statuses</option>
              {config.statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}
        {config.showDateRange && (
          <>
            <div>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => update('from', e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => update('to', e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </>
        )}
        {hasFilters && (
          <button onClick={clear} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50">
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
