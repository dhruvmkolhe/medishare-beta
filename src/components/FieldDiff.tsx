import { Check, X } from 'lucide-react';
import type { FieldDiff as FieldDiffType } from '../types';

interface Props {
  diffs: FieldDiffType[];
}

export default function FieldDiff({ diffs }: Props) {
  return (
    <div className="space-y-2">
      {diffs.map((diff) => (
        <div
          key={diff.field}
          className={`flex items-center justify-between p-3 rounded-md border ${
            diff.changed ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {diff.changed ? (
              <X className="h-4 w-4 text-red-500 flex-shrink-0" />
            ) : (
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
            )}
            <span className="text-sm font-medium capitalize text-slate-700">
              {diff.field.replace(/_/g, ' ')}:
            </span>
          </div>
          <div className="text-sm text-right">
            <span className={diff.changed ? 'line-through text-slate-400 mr-2' : 'text-slate-900'}>
              {diff.original}
            </span>
            {diff.changed && (
              <span className="text-red-600 font-medium">
                {diff.current} ({'MODIFIED'})
              </span>
            )}
            {!diff.changed && (
              <span className="text-green-600 text-xs ml-2">{'Unchanged'}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
