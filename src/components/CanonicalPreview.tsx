import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { canonicalizeToString } from '../lib/crypto';
import { Hash, Eye, EyeOff } from 'lucide-react';

interface Props {
  data: Record<string, unknown>;
}

export default function CanonicalPreview({ data }: Props) {
  const { t } = useTranslation();
  const [showPreview, setShowPreview] = useState(true);
  const canonical = canonicalizeToString(data);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-medium text-slate-700">{t('canonical.title')}</h3>
        </div>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="text-slate-400 hover:text-slate-600"
        >
          {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showPreview && (
        <div className="font-mono text-xs text-slate-600 bg-white border border-slate-200 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
          {canonical}
        </div>
      )}
    </div>
  );
}
