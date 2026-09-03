import { useState, useEffect } from 'react';
import { useApiFetch } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Plus, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import SearchFilterBar from '../components/SearchFilterBar';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { Skeleton, MetricCardSkeleton, TableSkeleton } from '../components/Skeleton';
import type { Prescription, Credential } from '../types';

export default function ProviderDashboard() {
  const apiFetch = useApiFetch();
  const { t } = useTranslation();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, revoked: 0, expired: 0 });
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ search: '', status: '', from: '', to: '' });

  const fetchData = async () => {
    try {
      // For stats, we might need a separate endpoint or just get total from credRes
      // But for now, we'll fetch credentials with filters and prescriptions for display
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status }),
        ...(filters.from && { from: filters.from }),
        ...(filters.to && { to: filters.to }),
      }).toString();

      const [presRes, credRes] = await Promise.all([
        apiFetch(`/api/prescriptions?${query}`), // assuming API handles it or ignores
        apiFetch(`/api/credentials?${query}`),
      ]);
      
      const presData = presRes.ok ? await presRes.json() : { data: [], total: 0 };
      const credData = credRes.ok ? await credRes.json() : { data: [], total: 0 };
      
      setPrescriptions(presData.data || presData);
      setCredentials(credData.data || credData);
      setTotal(presData.total || (Array.isArray(presData) ? presData.length : 0));
      
      // Update stats based on all credentials (mocked from total for now)
      if (credData.total !== undefined) {
        setStats(prev => ({
          ...prev,
          total: credData.total,
        }));
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
  }, [page, limit, filters]);

  const issueCredential = async (prescriptionId: string) => {
    const res = await apiFetch('/api/credentials', {
      method: 'POST',
      body: JSON.stringify({ prescriptionId }),
    });
    if (res.ok) {
      fetchData();
    }
  };

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
    setPage(1); // reset to first page on filter change
  };

  if (loading && prescriptions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
        <MetricCardSkeleton count={4} />
        <TableSkeleton rows={6} cols={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.provider.title')}</h1>
        <Link to="/prescriptions/new" className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-md text-sm hover:bg-slate-800 transition-colors">
          <Plus className="h-4 w-4" />
          {t('dashboard.provider.newPrescription')}
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <FileText className="h-4 w-4" />
            <span className="text-xs font-medium">{t('dashboard.provider.totalCredentials')}</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium">{t('dashboard.provider.activeCredentials')}</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{stats.active}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 text-red-500 mb-1">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs font-medium">{t('common.revoke')}</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.revoked}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">{t('verify.expires')}</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.expired}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{t('common.recentPrescriptions')}</h2>
        </div>
        
        <div className="p-4 border-b border-slate-200">
          <SearchFilterBar 
            config={{
              searchPlaceholder: t('search.placeholderPatient'),
              statusOptions: [
                { value: 'ACTIVE', label: 'Active' },
                { value: 'REVOKED', label: 'Revoked' },
                { value: 'EXPIRED', label: 'Expired' },
                { value: 'DISPENSED', label: 'Dispensed' }
              ]
            }}
            onFilterChange={handleFilterChange}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">{t('common.patient')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">{t('common.medication')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">{t('common.credential')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {prescriptions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6">
                    <EmptyState
                      icon={FileText}
                      title="No prescriptions found"
                      description={filters.search || filters.status ? "No prescriptions match your active filters." : "No prescriptions have been issued yet."}
                      action={filters.search || filters.status ? {
                        label: "Clear filters",
                        onClick: () => handleFilterChange({ search: '', status: '', from: '', to: '' })
                      } : undefined}
                    />
                  </td>
                </tr>
              ) : (
                prescriptions.map(p => {
                  const cred = credentials.find(c => c.prescription_id === p.id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-900">{p.patients?.display_name || p.patient_id}</td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {p.items && p.items.length > 0 
                          ? `${p.items.length} medication(s)` 
                          : `${p.medication} ${p.strength}`}
                      </td>
                      <td className="px-4 py-3">
                        {cred ? <StatusBadge status={cred.status} /> : <span className="text-xs text-slate-400">{t('common.noData')}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {cred ? (
                          <Link to={`/credentials/${cred.id}`} className="text-sm text-slate-900 hover:underline">{t('common.view')}</Link>
                        ) : (
                          <button
                            onClick={() => issueCredential(p.id)}
                            className="text-sm text-green-600 hover:text-green-700 font-medium"
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
        
        {total > 0 && (
          <div className="p-4 border-t border-slate-200">
            <Pagination 
              page={page} 
              limit={limit} 
              total={total} 
              onPageChange={setPage} 
              onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }} 
            />
          </div>
        )}
      </div>
    </div>
  );
}
