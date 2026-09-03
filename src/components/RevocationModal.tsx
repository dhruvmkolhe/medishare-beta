import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  credentialId: string;
}

export default function RevocationModal({ isOpen, onClose, onConfirm, credentialId }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    await onConfirm(reason);
    setLoading(false);
    setReason('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{t('revocation.title')}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-md mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">{t('revocation.warning')}</p>
        </div>

        <p className="text-sm text-slate-500 mb-4">{t('revocation.credentialId')}: {credentialId}</p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t('revocation.reason')} *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
            rows={3}
            placeholder={t('revocation.reasonPlaceholder')}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-md text-sm text-slate-700 hover:bg-slate-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim() || loading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('common.processing') : t('revocation.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
