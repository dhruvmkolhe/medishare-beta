import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApiFetch } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import FieldDiff from '../components/FieldDiff';
import type { FieldDiff as FieldDiffType } from '../types';
import { ArrowLeft, GitCompare, AlertTriangle } from 'lucide-react';

export default function CredentialCompare() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const apiFetch = useApiFetch();
  const { t } = useTranslation();
  const [diffs, setDiffs] = useState<FieldDiffType[]>([]);
  const [tampered, setTampered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [storedHash, setStoredHash] = useState('');
  const [currentHash, setCurrentHash] = useState('');

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/credentials/${id}/compare`).then(res => {
      if (res.ok) return res.json();
      return null;
    }).then(data => {
      if (data) {
        setDiffs(data.diff);
        setTampered(data.tampered);
        setStoredHash(data.contentHash);
        setCurrentHash(data.currentHash);
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </button>

      <div className="flex items-center gap-2 mb-6">
        <GitCompare className="h-5 w-5 text-slate-500" />
        <h1 className="text-2xl font-bold text-slate-900">{t('common.credentialComparison')}</h1>
      </div>

      {tampered && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Data integrity violation detected.</p>
            <p className="mt-1">The stored content hash does not match the recomputed hash from current prescription data.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-6 mb-4">
        <h2 className="text-sm font-medium text-slate-700 mb-3">{t('common.fieldLevelDiff')}</h2>
        <FieldDiff diffs={diffs} />
      </div>

      <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
        <h3 className="text-xs font-medium text-slate-500 mb-2">{t('common.hashComparison')}</h3>
        <div className="space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-slate-500">{t('common.storedHash')}</span>
            <span className="text-slate-900 truncate max-w-[60%]">{storedHash}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t('common.currentHash')}</span>
            <span className={tampered ? 'text-red-600 truncate max-w-[60%]' : 'text-green-600 truncate max-w-[60%]'}>
              {currentHash}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
