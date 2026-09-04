import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, useApiFetch } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import QrScanner from '../components/QrScanner';
import VerificationResult from '../components/VerificationResult';
import type { VerificationResult as VerificationResultType } from '../types';
import { Scan, Keyboard, ArrowRight, AlertCircle, Copy, Check } from 'lucide-react';
import PageMeta from '../components/PageMeta';
import { trackCTA } from '../lib/analytics';

export default function PharmacistVerify() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const apiFetch = useApiFetch();
  const [mode, setMode] = useState<'scan' | 'input'>('input');
  const [credentialId, setCredentialId] = useState('');
  const [loading, setLoading] = useState(false);
  const [dispensing, setDispensing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<VerificationResultType | null>(null);
  const [error, setError] = useState('');

  const handleVerify = async (id: string) => {
    trackCTA('verify_credential_submit', { credential_id_prefix: id.trim().slice(0, 8) });
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

  const handleDispense = async (credId: string, pickupPin?: string, notes?: string) => {
    setDispensing(true);
    setError('');
    try {
      const res = await apiFetch('/api/dispensations', {
        method: 'POST',
        body: JSON.stringify({
          credentialId: credId,
          pickupPin: pickupPin || '',
          notes: notes || '',
        }),
      });
      if (res.ok) {
        toast('Prescription marked as dispensed', 'success');
        await handleVerify(credId);
      } else {
        const err = await res.json();
        const msg = typeof err.error === 'string' ? err.error : (Array.isArray(err.error) ? err.error.map((e: any) => e.message).join(', ') : 'Failed to record dispensation');
        setError(msg);
        toast(msg, 'error');
      }
    } catch (err: any) {
      setError(err.message);
      toast(err.message, 'error');
    } finally {
      setDispensing(false);
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
      <PageMeta
        title="Verify Prescription Credential"
        description="Instantly verify digital prescription credentials using cryptographic Ed25519 signatures and RFC 8785 canonical verification. Zero login required."
        canonicalPath="/verify"
      />
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold text-slate-900">{t('verify.title')}</h1>
        {!user && (
          <p className="text-xs text-slate-500 mt-0.5">{t('common.noAccountRequired')}</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-5">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('input')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              mode === 'input' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Keyboard className="h-4 w-4" />
            {t('common.enterId')}
          </button>
          <button
            onClick={() => setMode('scan')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
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
                  placeholder="Enter Credential UUID..."
                  className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="shrink-0 flex items-center gap-1.5 sm:gap-2 bg-slate-900 text-white px-3.5 sm:px-4 py-2 rounded-md text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <ArrowRight className="h-4 w-4" />
                  <span>{t('verify.verify')}</span>
                </button>
              </div>
            </form>
            <div className="mt-3 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
              <span className="font-medium text-slate-600 shrink-0">Sample Credential:</span>
              <div className="flex items-center gap-1.5 min-w-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setCredentialId(sampleId);
                    handleVerify(sampleId);
                  }}
                  className="font-mono text-blue-600 hover:text-blue-800 hover:underline bg-blue-50/80 px-2 py-1 rounded border border-blue-200/60 cursor-pointer truncate text-left text-xs flex-1 sm:flex-initial"
                  title="Click to autofill and verify"
                >
                  {sampleId}
                </button>
                <button
                  type="button"
                  onClick={handleCopySample}
                  aria-label="Copy sample ID to clipboard"
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded transition-colors cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
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
          dispensing={dispensing}
        />
      )}
    </div>
  );
}
