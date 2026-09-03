import { useState, useEffect } from 'react';
import { useApiFetch } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { QrCode, X, Search, FileText } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import QrDisplay from '../components/QrDisplay';
import EmptyState from '../components/EmptyState';
import { Skeleton, PatientCardsSkeleton } from '../components/Skeleton';
import type { Credential } from '../types';

export default function PatientDashboard() {
  const apiFetch = useApiFetch();
  const { t } = useTranslation();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQr, setSelectedQr] = useState<{ url: string; id: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      const res = await apiFetch('/api/credentials');
      const data = res.ok ? await res.json() : [];
      setCredentials(Array.isArray(data) ? data : (data.data || []));
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const showQr = async (id: string) => {
    const res = await apiFetch(`/api/credentials/${id}/qr`);
    if (res.ok) {
      const data = await res.json();
      const properUrl = `${window.location.origin}/verify/${data.credentialId}`;
      setSelectedQr({ url: properUrl, id: data.credentialId });
    }
  };

  const revoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this credential?')) return;
    const res = await apiFetch(`/api/credentials/${id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Patient requested revocation' }),
    });
    if (res.ok) fetchData();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 max-w-sm w-full rounded-lg" />
        </div>
        <PatientCardsSkeleton count={6} />
      </div>
    );
  }

  const filteredCredentials = credentials.filter(cred => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    
    // Check main medication
    if (cred.prescriptions?.medication?.toLowerCase().includes(q)) return true;
    
    // Check items if any
    if (cred.prescriptions?.items && cred.prescriptions.items.some(item => 
      item.medication.toLowerCase().includes(q)
    )) return true;
    
    return false;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.patient.title')}</h1>
        
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>
      </div>

      {credentials.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No prescription credentials issued"
          description="Your healthcare provider has not issued any digital verifiable prescriptions to your account yet."
        />
      ) : filteredCredentials.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching prescriptions"
          description={`No prescriptions found matching "${searchQuery}". Try searching by a different medication name.`}
          action={{
            label: "Clear search query",
            onClick: () => setSearchQuery('')
          }}
        />
      ) : (
        <div className="grid gap-4">
          {filteredCredentials.map(cred => (
            <div key={cred.id} className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  {cred.prescriptions?.items && cred.prescriptions.items.length > 0 ? (
                    <div>
                      <h3 className="font-medium text-slate-900">
                        {cred.prescriptions.items.length} Medication(s)
                      </h3>
                      <div className="text-sm text-slate-500">
                        {cred.prescriptions.items.map(i => i.medication).join(', ')}
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-medium text-slate-900">{cred.prescriptions?.medication} {cred.prescriptions?.strength}</h3>
                      <p className="text-sm text-slate-500">{cred.prescriptions?.dosage} — {cred.prescriptions?.duration}</p>
                    </>
                  )}
                </div>
                <StatusBadge status={cred.status} />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => showQr(cred.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-md text-sm text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <QrCode className="h-4 w-4" />
                  {t('dashboard.patient.viewQr')}
                </button>
                {cred.status === 'ACTIVE' && (
                  <button
                    onClick={() => revoke(cred.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-md text-sm text-red-600 hover:bg-red-100 transition-colors"
                  >
                    <X className="h-4 w-4" />
                    {t('dashboard.patient.revoke')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedQr && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{t('common.verificationQr')}</h3>
              <button onClick={() => setSelectedQr(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <QrDisplay url={selectedQr.url} credentialId={selectedQr.id} size={200} />
          </div>
        </div>
      )}
    </div>
  );
}
