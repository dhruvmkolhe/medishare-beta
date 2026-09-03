import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';
import { getAnalyticsConsent, setAnalyticsConsent } from '../lib/analytics';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getAnalyticsConsent();
    if (!existing) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleAcceptAll = () => {
    setAnalyticsConsent('all');
    setVisible(false);
  };

  const handleEssentialOnly = () => {
    setAnalyticsConsent('essential');
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookie consent banner"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-slate-900 text-slate-200 rounded-xl shadow-2xl p-4 sm:p-5 border border-slate-700/80 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-green-400 font-semibold text-sm">
          <Cookie className="h-4 w-4" />
          <span>Privacy & Cookie Preferences</span>
        </div>
        <button
          onClick={handleEssentialOnly}
          aria-label="Dismiss cookie banner with essential only"
          className="text-slate-400 hover:text-white p-1 rounded transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-300 leading-relaxed">
        MediShare uses essential cookies for secure cryptographic authentication and session management. We also use privacy-preserving analytics to improve prescription verification performance.
      </p>

      <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
        <Link
          to="/privacy"
          className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
        >
          Read Policy
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEssentialOnly}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Essential Only
          </button>
          <button
            onClick={handleAcceptAll}
            className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-green-400 hover:bg-green-300 rounded-lg transition-colors cursor-pointer"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
