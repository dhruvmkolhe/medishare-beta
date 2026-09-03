import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../contexts/ToastContext';
import QrScanner from '../components/QrScanner';
import VerificationResult from '../components/VerificationResult';
import type { VerificationResult as VerificationResultType } from '../types';
import { Scan, Keyboard, ArrowRight, AlertCircle, Copy, Check } from 'lucide-react';

export default function PharmacistVerify() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [mode, setMode] = useState<'scan' | 'input'>('input');
  const [credentialId, setCredentialId] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<VerificationResultType | null>(null);
  const [error, setError] = useState('');

  const handleVerify = async (id: string) => {
    setLoading(true);
    setError('');
    setResult(null);

    const trimmed = id.trim();
    if (trimmed.includes('@')) {
      setError("It looks like you entered an email address. If you are trying to log in to your account, please go to the Login page (/login).");
      setLoading(false);
      return;
    }

    try {
      const initRes = await fetch('/api/verify/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId: trimmed }),
      });
      if (!initRes.ok) {
        const err = await initRes.json();
        const msg = typeof err.error === 'string' ? err.error : (Array.isArray(err.error) ? err.error.map((e: any) => e.message).join(', ') : 'Init failed');
        throw new Error(msg);
      }
      const { nonce } = await initRes.json();

      const exchangeRes = await fetch('/api/verify/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId: trimmed, nonce }),
      });
      if (!exchangeRes.ok) {
        const err = await exchangeRes.json();
        const msg = typeof err.error === 'string' ? err.error : (Array.isArray(err.error) ? err.error.map((e: any) => e.message).join(', ') : 'Exchange failed');
        throw new Error(msg);
      }
      const data = await exchangeRes.json();
      setResult(data);
    } catch (err: any) {
      toast('Verification failed', 'error');
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDispense = async (credId: string) => {
    try {
      const res = await fetch('/api/dispensations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId: credId }),
      });
      if (res.ok) {
        toast('Prescription marked as dispensed', 'success');
        handleVerify(credId);
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to record dispensation');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleScan = (id: string) => {
    setCredentialId(id);
    handleVerify(id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialId.trim()) return;
    handleVerify(credentialId.trim());
  };

  const sampleId = 'c9c52004-6fb3-4654-8fbd-2bd360802816';

  const handleCopySample = () => {
    navigator.clipboard.writeText(sampleId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto w-full">
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold text-slate-900">{t('verify.title')}</h1>
        <p className="text-xs text-slate-500 mt-0.5">{t('common.noAccountRequired')}</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('input')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'input' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Keyboard className="h-4 w-4" />
            {t('common.enterId')}
          </button>
          <button
            onClick={() => setMode('scan')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'scan' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Scan className="h-4 w-4" />
            {t('common.scanQr')}
          </button>
        </div>

        {mode === 'input' ? (
          <div>
            <form onSubmit={handleSubmit}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={credentialId}
                  onChange={(e) => setCredentialId(e.target.value)}
                  placeholder="Enter Credential UUID (e.g. c9c52004-6fb3...)"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-md text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <ArrowRight className="h-4 w-4" />
                  {t('verify.verify')}
                </button>
              </div>
            </form>
            <div className="mt-3 text-xs text-slate-500 flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-600">Sample Credential:</span>
              <button
                type="button"
                onClick={() => {
                  setCredentialId(sampleId);
                  handleVerify(sampleId);
                }}
                className="font-mono text-blue-600 hover:text-blue-800 hover:underline bg-blue-50/80 px-2 py-0.5 rounded border border-blue-200/60 cursor-pointer"
                title="Click to autofill and verify"
              >
                {sampleId}
              </button>
              <button
                type="button"
                onClick={handleCopySample}
                aria-label="Copy sample ID to clipboard"
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-colors cursor-pointer"
              >
                {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        ) : (
          <QrScanner onScan={handleScan} />
        )}
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 animate-pulse">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="space-y-2">
              <div className="h-5 w-40 bg-slate-200 rounded" />
              <div className="h-3.5 w-60 bg-slate-100 rounded" />
            </div>
            <div className="h-7 w-20 bg-slate-200 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="h-16 bg-slate-50 rounded-lg p-3 space-y-2">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="h-4 w-32 bg-slate-200 rounded" />
            </div>
            <div className="h-16 bg-slate-50 rounded-lg p-3 space-y-2">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="h-4 w-32 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {result && !loading && (
        <VerificationResult 
          result={result} 
          credentialId={credentialId}
          onDispense={handleDispense} 
        />
      )}
    </div>
  );
}
