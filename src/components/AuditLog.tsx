import { useTranslation } from 'react-i18next';
import { ShieldAlert } from 'lucide-react';
import { getActionLabel, formatDateTime } from '../lib/utils';
import EmptyState from './EmptyState';
import type { AuditLogEntry } from '../types';

interface Props {
  logs: AuditLogEntry[];
}

export default function AuditLog({ logs }: Props) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">{t('audit.timestamp')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">{t('audit.action')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">{t('audit.target')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">{t('audit.actor')}</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {logs.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-6">
                <EmptyState
                  icon={ShieldAlert}
                  title="No audit events recorded"
                  description="No system audit logs match the current search or date filter."
                />
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                  {formatDateTime(log.created_at)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">
                    {getActionLabel(log.action)}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                  {log.target_type} #{log.target_id}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 font-mono">
                  {log.actor_id?.slice(0, 8) || 'System'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
