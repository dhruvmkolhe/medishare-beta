import { useState, useEffect } from 'react';
import { useApiFetch } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import RevocationModal from '../components/RevocationModal';
import SearchFilterBar from '../components/SearchFilterBar';
import Pagination from '../components/Pagination';
import type { Credential } from '../types';
import { Shield } from 'lucide-react';
import PageMeta from '../components/PageMeta';

export default function RevocationDashboard() {
  const apiFetch = useApiFetch();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeModal, setRevokeModal] = useState<{ id: string; credentialId: string } | null>(null);

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

      const res = await apiFetch(`/api/credentials?${query}`);
      const data = res.ok ? await res.json() : { data: [], total: 0 };
      
      setCredentials(data.data || data);
      setTotal(data.total || (Array.isArray(data) ? data.length : 0));
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, limit, filters]);

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleRevoke = async (reason: string) => {
    if (!revokeModal) return;
    const res = await apiFetch(`/api/credentials/${revokeModal.id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      toast('Credential revoked successfully', 'warning');
      setRevokeModal(null);
      fetchData();
    }
  };

  if (loading && credentials.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageMeta
        title="Revocation Dashboard"
        description="Manage and inspect revoked prescription credentials and cryptographic revocation status lists in real time."
        canonicalPath="/revocations"
      />
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-slate-500" />
        <h1 className="text-2xl font-bold text-slate-900">{t('revocation.list')}</h1>
      </div>

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <SearchFilterBar 
            config={{
              searchPlaceholder: 'Search credentials...',
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
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Credential ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">{t('common.medication')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">{t('common.patient')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {credentials.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">{t('common.noCredentials')}</td></tr>
              ) : (
                credentials.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono text-slate-900">{c.credential_id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {c.prescriptions?.items && c.prescriptions.items.length > 0 
                        ? `${c.prescriptions.items.length} medication(s)` 
                        : `${c.prescriptions?.medication} ${c.prescriptions?.strength}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{c.prescriptions?.patients?.display_name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link to={`/credentials/${c.id}`} className="text-sm text-slate-900 hover:underline">{t('common.view')}</Link>
                        <Link to={`/credentials/${c.id}/compare`} className="text-sm text-slate-500 hover:underline">{t('common.compare')}</Link>
                        {c.status === 'ACTIVE' && (
                          <button
                            onClick={() => setRevokeModal({ id: c.id, credentialId: c.credential_id })}
                            className="text-sm text-red-600 hover:text-red-700 font-medium"
                          >
                            {t('common.revoke')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
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

      <RevocationModal
        isOpen={!!revokeModal}
        onClose={() => setRevokeModal(null)}
        onConfirm={handleRevoke}
        credentialId={revokeModal?.credentialId || ''}
      />
    </div>
  );
}
