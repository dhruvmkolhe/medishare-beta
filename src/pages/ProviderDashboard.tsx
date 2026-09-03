import { useState, useEffect } from 'react';
import { useApiFetch } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Plus, FileText, AlertCircle, CheckCircle, Clock, ArrowRight, ShieldCheck, Pill, Scan } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { Skeleton, MetricCardSkeleton, TableSkeleton } from '../components/Skeleton';
import type { Prescription, Credential } from '../types';
import PageMeta from '../components/PageMeta';

export default function ProviderDashboard() {
  const apiFetch = useApiFetch();
  const { t } = useTranslation();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, revoked: 0, expired: 0 });
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const fetchData = async () => {
    try {
      // Fetch latest 5 prescriptions for the dashboard overview and credentials for stats
      const [presRes, credRes] = await Promise.all([
        apiFetch('/api/prescriptions?limit=5&page=1'),
        apiFetch('/api/credentials?limit=50&page=1'),
      ]);
      
      const presData = presRes.ok ? await presRes.json() : { data: [], total: 0 };
      const credData = credRes.ok ? await credRes.json() : { data: [], total: 0 };
      
      setPrescriptions(presData.data || (Array.isArray(presData) ? presData.slice(0, 5) : []));
      setCredentials(credData.data || credData);
      setTotalCount(presData.total || (Array.isArray(presData) ? presData.length : 0));
      
      if (credData.total !== undefined) {
        const creds = Array.isArray(credData.data) ? credData.data : [];
        setStats({
          total: credData.total,
          active: creds.filter((c: Credential) => c.status === 'ACTIVE').length,
          revoked: creds.filter((c: Credential) => c.status === 'REVOKED').length,
          expired: creds.filter((c: Credential) => c.status === 'EXPIRED').length,
        });
      } else {
        const creds = Array.isArray(credData) ? credData : credData.data || [];
        setStats({
          total: creds.length,
          active: creds.filter((c: Credential) => c.status === 'ACTIVE').length,
          revoked: creds.filter((c: Credential) => c.status === 'REVOKED').length,
          expired: creds.filter((c: Credential) => c.status === 'EXPIRED').length,
        });
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, []);

  const issueCredential = async (prescriptionId: string) => {
    const res = await apiFetch('/api/credentials', {
      method: 'POST',
      body: JSON.stringify({ prescriptionId }),
    });
    if (res.ok) {
      fetchData();
    }
  };

  if (loading && prescriptions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
        <MetricCardSkeleton count={4} />
        <TableSkeleton rows={5} cols={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageMeta
        title="Provider Dashboard — MediShare"
        description="Clinical overview, cryptographic credential statistics, and quick prescription workflows."
        canonicalPath="/dashboard"
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.provider.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Clinical operations overview, verifiable credential health, and recent activity.
          </p>
        </div>
        <Link 
          to="/prescriptions/new" 
          className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>{t('dashboard.provider.newPrescription')}</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <FileText className="h-4 w-4" />
            <span className="text-xs font-medium">{t('dashboard.provider.totalCredentials')}</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium">{t('dashboard.provider.activeCredentials')}</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{stats.active}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-red-500 mb-1">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs font-medium">{t('common.revoke')}</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.revoked}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">{t('verify.expires')}</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.expired}</p>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          to="/prescriptions"
          className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
              <Pill className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">All Prescriptions</p>
              <p className="text-xs text-slate-500">Search & manage records</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
        </Link>

        <Link
          to="/revocations"
          className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Revocation Registry</p>
              <p className="text-xs text-slate-500">BitMap & revocation audits</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
        </Link>

        <Link
          to="/verify"
          className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
              <Scan className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Scan & Verify</p>
              <p className="text-xs text-slate-500">Test cryptographic signatures</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>

      {/* Recent Prescriptions Preview */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{t('common.recentPrescriptions')}</h2>
          <Link
            to="/prescriptions"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span>View all {totalCount > 0 ? `(${totalCount})` : ''}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('common.patient')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('common.medication')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('common.credential')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {prescriptions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8">
                    <EmptyState
                      icon={FileText}
                      title="No prescriptions yet"
                      description="You haven't issued any prescriptions yet. Create your first prescription to get started."
                      action={{
                        label: "New Prescription",
                        onClick: () => window.location.href = '/prescriptions/new'
                      }}
                    />
                  </td>
                </tr>
              ) : (
                prescriptions.map(p => {
                  const cred = credentials.find(c => c.prescription_id === p.id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 text-sm font-medium text-slate-900">
                        {p.patients?.display_name || p.patient_id}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-700">
                        {p.items && p.items.length > 0 
                          ? `${p.items.length} medication(s)` 
                          : `${p.medication} ${p.strength}`}
                      </td>
                      <td className="px-4 py-3.5">
                        {cred ? <StatusBadge status={cred.status} /> : <span className="text-xs text-slate-400">{t('common.noData')}</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {cred ? (
                          <Link 
                            to={`/credentials/${cred.id}`} 
                            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {t('common.view')}
                          </Link>
                        ) : (
                          <button
                            onClick={() => issueCredential(p.id)}
                            className="inline-flex items-center text-sm text-green-600 hover:text-green-700 font-medium cursor-pointer"
                          >
                            {t('prescription.issueCredential')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
