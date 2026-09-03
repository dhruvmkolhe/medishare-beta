import { useState, useEffect } from 'react';
import { useApiFetch } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import AuditLog from '../components/AuditLog';
import SearchFilterBar from '../components/SearchFilterBar';
import Pagination from '../components/Pagination';
import { Skeleton, TableSkeleton } from '../components/Skeleton';
import type { AuditLogEntry } from '../types';
import { FileText } from 'lucide-react';

export default function AuditTrail() {
  const apiFetch = useApiFetch();
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ search: '', status: '', from: '', to: '' });

  useEffect(() => {
    const query = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(filters.search && { search: filters.search }),
      ...(filters.status && { action: filters.status }),
      ...(filters.from && { from: filters.from }),
      ...(filters.to && { to: filters.to }),
    }).toString();

    apiFetch(`/api/audit?${query}`).then(res => res.ok && res.json()).then(data => {
      if (data) {
        setLogs(data.data || data);
        setTotal(data.total || (Array.isArray(data) ? data.length : 0));
      }
      setLoading(false);
    });
  }, [page, limit, filters]);

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
    setPage(1);
  };

  if (loading && logs.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-8 w-44" />
        </div>
        <TableSkeleton rows={8} cols={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-slate-500" />
        <h1 className="text-2xl font-bold text-slate-900">{t('audit.title')}</h1>
      </div>

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <SearchFilterBar 
            config={{
              searchPlaceholder: 'Search audit logs...',
              showDateRange: true,
              statusOptions: [
                { value: 'LOGIN_SUCCESS', label: 'Login Success' },
                { value: 'LOGIN_FAILED', label: 'Login Failed' },
                { value: 'PRESCRIPTION_CREATED', label: 'Prescription Created' },
                { value: 'CREDENTIAL_SIGNED', label: 'Credential Signed' },
                { value: 'CREDENTIAL_REVOKED', label: 'Credential Revoked' },
                { value: 'VERIFICATION_ATTEMPTED', label: 'Verification Attempted' },
                { value: 'CREDENTIAL_DISPENSED', label: 'Credential Dispensed' }
              ]
            }}
            onFilterChange={handleFilterChange}
          />
        </div>
        
        <AuditLog logs={logs} />
        
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
