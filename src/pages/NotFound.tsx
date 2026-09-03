import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react';
import PageMeta from '../components/PageMeta';
import { track404, trackCTA } from '../lib/analytics';

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    track404(location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <PageMeta
        title="Page Not Found (404)"
        description="The requested page could not be found. Return to MediShare to verify a prescription or sign in to your portal."
      />
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-slate-200">
          <ShieldAlert className="h-8 w-8 text-amber-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">404</h1>
          <h2 className="text-lg font-semibold text-slate-800">Page Not Found</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            The page you are looking for might have been removed, had its address changed, or is temporarily unavailable.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/dashboard"
            onClick={() => trackCTA('404_click_dashboard')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Link>

          <Link
            to="/verify"
            onClick={() => trackCTA('404_click_verify')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-300 shadow-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Verify Credential
          </Link>
        </div>
      </div>
    </div>
  );
}
