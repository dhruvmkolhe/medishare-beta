import { useState } from 'react';
import { FileJson, Download } from 'lucide-react';
import { useApiFetch } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface Props {
  credentialId: string;
}

export default function ExportButtons({ credentialId }: Props) {
  const apiFetch = useApiFetch();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const handleExport = async (format: 'vc' | 'fhir') => {
    setLoading(format);
    try {
      const res = await apiFetch(`/api/credentials/${credentialId}/export/${format}`);
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `credential-${credentialId}-${format}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast(`Exported as ${format === 'vc' ? 'W3C Verifiable Credential' : 'FHIR R4 Bundle'}`, 'success');
    } catch {
      toast('Export failed', 'error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleExport('vc')}
        disabled={loading !== null}
        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-50"
      >
        <FileJson className="h-4 w-4" />
        {loading === 'vc' ? 'Exporting...' : 'W3C VC'}
      </button>
      <button
        onClick={() => handleExport('fhir')}
        disabled={loading !== null}
        className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-100 border border-teal-200 transition-colors disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        {loading === 'fhir' ? 'Exporting...' : 'FHIR R4'}
      </button>
    </div>
  );
}
