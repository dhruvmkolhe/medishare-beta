import { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import type { DrugWarning } from '../lib/drugWarnings';

interface Props {
  warnings: DrugWarning[];
}

const severityConfig = {
  high: { icon: AlertTriangle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', iconColor: 'text-red-500', label: 'High Risk' },
  medium: { icon: AlertCircle, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', iconColor: 'text-amber-500', label: 'Moderate' },
  low: { icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', iconColor: 'text-blue-500', label: 'Advisory' },
};

export default function DrugWarningBanner({ warnings }: Props) {
  const [expanded, setExpanded] = useState(true);

  if (warnings.length === 0) return null;

  const highCount = warnings.filter(w => w.severity === 'high').length;
  const hasHigh = highCount > 0;

  return (
    <div className={`rounded-lg border-2 overflow-hidden mb-4 ${hasHigh ? 'border-red-300' : 'border-amber-300'}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between p-3 text-sm font-semibold ${hasHigh ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <span>⚠️ {warnings.length} Drug Warning{warnings.length !== 1 ? 's' : ''} Detected</span>
          {highCount > 0 && (
            <span className="text-xs bg-red-200 text-red-900 px-2 py-0.5 rounded-full">{highCount} high risk</span>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expanded && (
        <div className="p-3 space-y-2 bg-white">
          {warnings.map((w, i) => {
            const config = severityConfig[w.severity];
            const Icon = config.icon;
            return (
              <div key={i} className={`flex items-start gap-2 p-2.5 rounded-md border ${config.bg} ${config.border}`}>
                <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
                <div className="flex-1">
                  <span className={`text-xs font-semibold ${config.text}`}>{config.label}</span>
                  <p className={`text-sm ${config.text}`}>{w.message}</p>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-slate-400 italic mt-2">These are advisory alerts based on common drug interactions. Always consult clinical references.</p>
        </div>
      )}
    </div>
  );
}
