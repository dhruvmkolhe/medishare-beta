import { useState, useEffect } from 'react';
import { useAuth, useApiFetch } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Users, FileCheck, Shield, Activity } from 'lucide-react';
import PageMeta from '../components/PageMeta';

export default function AdminDashboard() {
  const { user } = useAuth();
  const apiFetch = useApiFetch();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [pendingProviders, setPendingProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, pendingRes] = await Promise.all([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/providers/pending'),
      ]);
      const statsData = statsRes.ok ? await statsRes.json() : null;
      const pendingData = pendingRes.ok ? await pendingRes.json() : [];
      setStats(statsData);
      setPendingProviders(pendingData);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const approveProvider = async (id: string) => {
    const res = await apiFetch(`/api/providers/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ approvedBy: user?.id }),
    });
    if (res.ok) {
      toast('Provider approved successfully', 'success');
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageMeta
        title="Admin Dashboard"
        description="System administration, provider verification approvals, platform metrics, and credential issuance monitoring."
        canonicalPath="/admin"
      />
      <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.admin.title')}</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium">{t('dashboard.admin.users')}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{stats.totalUsers}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Shield className="h-4 w-4" />
              <span className="text-xs font-medium">{t('dashboard.admin.providers')}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{stats.approvedProviders} / {stats.totalProviders}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <FileCheck className="h-4 w-4" />
              <span className="text-xs font-medium">{t('dashboard.admin.credentials')}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{stats.totalCredentials}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-xs font-medium">{t('dashboard.admin.verifications')}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">{stats.totalVerifications}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{t('dashboard.provider.pendingApprovals')} ({pendingProviders.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">{t('common.name')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">{t('common.license')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">{t('common.email')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pendingProviders.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">{t('common.noData')}</td></tr>
              ) : (
                pendingProviders.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{p.license_number}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{p.users?.email}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => approveProvider(p.id)}
                        className="text-sm text-green-600 hover:text-green-700 font-medium"
                      >
                        {t('common.approve')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-4">
        <Link to="/audit" className="flex-1 bg-white p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
          <h3 className="font-medium text-slate-900">{t('common.auditTrail')}</h3>
          <p className="text-sm text-slate-500 mt-1">{t('common.viewAllActivity')}</p>
        </Link>
      </div>
    </div>
  );
}
