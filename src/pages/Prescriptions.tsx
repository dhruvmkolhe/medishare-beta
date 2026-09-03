import { useState, useEffect } from 'react';
import { useApiFetch } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import SearchFilterBar from '../components/SearchFilterBar';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import { Skeleton, TableSkeleton } from '../components/Skeleton';
import type { Prescription, Credential } from '../types';
import PageMeta from '../components/PageMeta';

export default function Prescriptions() {
  const apiFetch = useApiFetch();
  const { t } = useTranslation();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ search: '', status: '', from: '', to: '' });

  const fetchData = async () => {
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status }),
        ...(filters.from && { from: filters.from }),
        ...(filters.to && { to: filters.to }),
      }).toString();

      const [presRes, credRes] = await Promise.all([
        apiFetch(`/api/prescriptions?${query}`),
        apiFetch(`/api/credentials?${query}`),
      ]);
      
      const presData = presRes.ok ? await presRes.json() : { data: [], total: 0 };
      const credData = credRes.ok ? await credRes.json() : { data: [], total: 0 };
      
      setPrescriptions(presData.data || presData);
      setCredentials(credData.data || credData);
      setTotal(presData.total || (Array.isArray(presData) ? presData.length : 0));
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
    setPage(1);
  };

  if (loading && prescriptions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
        <TableSkeleton rows={8} cols={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageMeta
        title="Prescriptions Management — Provider Portal"
        description="Search, filter, and manage patient prescriptions and cryptographic verifiable credentials."
        canonicalPath="/prescriptions"
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('nav.prescriptions')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage patient prescriptions, issue verifiable credentials, and review records.
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
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
        
        {total > 0 && (
          <div className="p-4 border-t border-slate-200 bg-white">
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
