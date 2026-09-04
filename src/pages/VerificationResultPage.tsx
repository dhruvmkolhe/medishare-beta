import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApiFetch } from '../contexts/AuthContext';
import VerificationResult from '../components/VerificationResult';
import type { VerificationResult as VerificationResultType } from '../types';
import { AlertCircle } from 'lucide-react';
import PageMeta from '../components/PageMeta';
import Breadcrumbs from '../components/Breadcrumbs';

export default function VerificationResultPage() {
  const { credentialId } = useParams<{ credentialId: string }>();
  const { t } = useTranslation();
  const apiFetch = useApiFetch();
  const [result, setResult] = useState<VerificationResultType | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispensing, setDispensing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!credentialId) return;
    const verify = async () => {
      try {
        const initRes = await fetch('/api/verify/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credentialId }),
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
          body: JSON.stringify({ credentialId, nonce }),
        });
        if (!exchangeRes.ok) {
          const err = await exchangeRes.json();
          const msg = typeof err.error === 'string' ? err.error : (Array.isArray(err.error) ? err.error.map((e: any) => e.message).join(', ') : 'Exchange failed');
          throw new Error(msg);
        }
        const data = await exchangeRes.json();
        setResult(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [credentialId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-8 p-4 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-sm text-red-700">
        <AlertCircle className="h-4 w-4 flex-shrink-0" />
        {error}
      </div>
    );
  }

  const handleDispense = async (credId: string, pickupPin?: string, notes?: string) => {
    setDispensing(true);
    setError('');
    try {
      const res = await apiFetch('/api/dispensations', {
        method: 'POST',
        body: JSON.stringify({
          credentialId: credId,
          pickupPin: pickupPin || '',
          notes: notes || ''
        }),
      });
      if (res.ok) {
        window.location.reload(); // Simple reload to re-verify
      } else {
        const err = await res.json();
        const msg = typeof err.error === 'string' ? err.error : (Array.isArray(err.error) ? err.error.map((e: any) => e.message).join(', ') : 'Failed to record dispensation');
        setError(msg);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDispensing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-4">
      <PageMeta
        title={`Verification Result ${credentialId ? `#${credentialId.slice(0, 8)}` : ''}`}
        description="Cryptographic audit and verification report for prescription credential with tamper-evident signature checks and refill validation."
        canonicalPath={`/verify/${credentialId}`}
      />
      <Breadcrumbs
        items={[
          { label: 'Verify', path: '/verify' },
          { label: 'Verification Result' },
        ]}
      />
      <h1 className="text-2xl font-bold text-slate-900 text-center mb-6">{t('verify.title')}</h1>
      {result && (
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
