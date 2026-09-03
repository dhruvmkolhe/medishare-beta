import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
}

export default function Pagination({ page, limit, total, onPageChange, onLimitChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg mt-4">
      <div className="text-sm text-slate-500">
        Showing {total > 0 ? from : 0}–{to} of {total}
      </div>
      <div className="flex items-center gap-2">
        {onLimitChange && (
          <select
            value={limit}
            onChange={(e) => onLimitChange(parseInt(e.target.value))}
            className="px-2 py-1 border border-slate-300 rounded text-sm text-slate-700"
          >
            {[10, 25, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
        )}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm text-slate-700 px-2">Page {page} of {totalPages}</span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
