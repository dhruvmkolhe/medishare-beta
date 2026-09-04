import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApiFetch } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import QrDisplay from '../components/QrDisplay';
import StatusBadge from '../components/StatusBadge';
import PrescriptionPdf from '../components/PrescriptionPdf';
import ExportButtons from '../components/ExportButtons';
import type { Credential } from '../types';
import { ArrowLeft, QrCode, AlertTriangle } from 'lucide-react';
import PageMeta from '../components/PageMeta';
import Breadcrumbs from '../components/Breadcrumbs';

export default function CredentialView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const apiFetch = useApiFetch();
  const { t } = useTranslation();
  const [credential, setCredential] = useState<Credential | null>(null);
  const [qrData, setQrData] = useState<{ url: string; id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCredential = async () => {
    if (!id) return;
    try {
      const res = await apiFetch(`/api/credentials/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCredential(data);
        if (data.status === 'ACTIVE' || data.status === 'DISPENSED') {
          const qrRes = await apiFetch(`/api/credentials/${id}/qr`);
          if (qrRes.ok) {
            const qr = await qrRes.json();
            const properUrl = `${window.location.origin}/verify/${qr.credentialId}`;
            setQrData({ url: properUrl, id: qr.credentialId });
          }
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCredential(); }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  if (!credential) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">{t('common.noData')}</p>
      </div>
    );
  }

  const hasItems = credential.prescriptions?.items && credential.prescriptions.items.length > 0;
  const items = credential.prescriptions?.items || [];
  const providerName = credential.prescriptions?.providers?.name || 'Unknown Provider';
  const patientName = credential.prescriptions?.patients?.display_name || 'Unknown Patient';

  return (
    <div className="max-w-2xl mx-auto">
      <PageMeta
        title={`Credential Details ${credential ? `#${credential.credential_id.slice(0, 8)}` : ''}`}
        description="View verifiable medical credential details, cryptographic public key hashes, dispensation history, and print vector PDF."
        canonicalPath={`/credentials/${id}`}
      />
      <Breadcrumbs
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Credential Details' },
        ]}
      />
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </button>
        
        {qrData && (
          <div className="flex gap-2">
            <ExportButtons credentialId={credential.id} />
            <PrescriptionPdf 
              credential={credential}
              items={items}
              providerName={providerName}
              patientName={patientName}
              qrUrl={qrData.url}
            />
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-900">{t('common.credentialDetails')}</h1>
          <StatusBadge status={credential.status} />
        </div>

        <div className="space-y-4 text-sm">
          <div className="flex justify-between pb-3 border-b border-slate-100">
            <span className="text-slate-500">Credential ID</span>
            <span className="font-mono text-slate-900">{credential.credential_id}</span>
          </div>

          {credential.pickup_pin && (
            <div className="flex justify-between items-center pb-3 border-b border-purple-100 bg-purple-50/50 p-3 rounded-lg">
              <div>
                <span className="font-semibold text-purple-900 text-xs uppercase tracking-wider block">Patient Pickup PIN (2FA)</span>
                <span className="text-[11px] text-purple-600">Provide this secret PIN to the pharmacist to authorize dispensing</span>
              </div>
              <span className="font-mono text-sm font-bold bg-white text-purple-700 px-2.5 py-1 rounded border border-purple-200 tracking-wider">
                {credential.pickup_pin}
              </span>
            </div>
          )}
          
          {hasItems ? (
            <div className="space-y-3 pb-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700">Medications</h3>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded border border-slate-100">
                    <div className="font-medium text-slate-900">{item.medication} {item.strength}</div>
                    <div className="text-slate-600 mt-1">{item.dosage} for {item.duration}</div>
                    {(item.timing || item.refills > 0) && (
                      <div className="text-xs text-slate-500 mt-1 flex gap-3">
                        {item.timing && <span>Timing: {item.timing}</span>}
                        {item.refills > 0 && <span>Refills: {item.refills}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('prescription.medication')}</span>
                <span className="text-slate-900">{credential.prescriptions?.medication}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('prescription.strength')}</span>
                <span className="text-slate-900">{credential.prescriptions?.strength}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('prescription.dosage')}</span>
                <span className="text-slate-900">{credential.prescriptions?.dosage}</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-500">{t('prescription.duration')}</span>
                <span className="text-slate-900">{credential.prescriptions?.duration}</span>
              </div>
            </>
          )}

          <div className="flex justify-between">
            <span className="text-slate-500">{t('verify.issued')}</span>
            <span className="text-slate-900">{new Date(credential.issued_at).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t('verify.expires')}</span>
            <span className="text-slate-900">{new Date(credential.expires_at).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Content Hash</span>
            <span className="font-mono text-xs text-slate-900 max-w-[200px] truncate">{credential.content_hash}</span>
          </div>
        </div>

        {credential.status === 'REVOKED' && (
          <div className="mt-4 p-3 bg-red-50 rounded-md flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {t('common.revokedMessage')}
          </div>
        )}
      </div>

      {qrData && (credential.status === 'ACTIVE' || credential.status === 'DISPENSED') && (
        <div className="mt-6 bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">{t('common.verificationQr')}</h2>
          </div>
          <QrDisplay url={qrData.url} credentialId={qrData.id} pickupPin={credential.pickup_pin} size={200} />
        </div>
      )}
    </div>
  );
}
