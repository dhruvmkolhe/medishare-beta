import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Shield, LogOut, Menu, X, User, Stethoscope, Pill, ScanLine } from 'lucide-react';
import { useState } from 'react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const isActive = (path: string) => location.pathname === path;

  const navLinks = user?.role === 'ADMIN' ? [
    { path: '/dashboard', label: t('nav.dashboard'), icon: Shield },
    { path: '/admin', label: t('nav.admin'), icon: User },
    { path: '/audit', label: t('nav.audit'), icon: ScanLine },
    { path: '/verify', label: t('nav.verify'), icon: ScanLine },
  ] : user?.role === 'PROVIDER' ? [
    { path: '/dashboard', label: t('nav.dashboard'), icon: Stethoscope },
    { path: '/prescriptions', label: t('nav.prescriptions'), icon: Pill },
    { path: '/revocations', label: t('nav.revocations'), icon: Shield },
    { path: '/verify', label: t('nav.verify'), icon: ScanLine },
  ] : user?.role === 'PATIENT' ? [
    { path: '/dashboard', label: t('nav.dashboard'), icon: User },
    { path: '/verify', label: t('nav.verify'), icon: ScanLine },
  ] : [
    { path: '/verify', label: t('nav.verify'), icon: ScanLine },
  ];

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'gu', label: 'ગુજરાતી' },
    { code: 'ar', label: 'العربية' },
    { code: 'fr', label: 'Français' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <nav className="bg-slate-900 text-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link to="/" className="flex items-center gap-2.5 text-xl font-semibold tracking-tight hover:opacity-90 transition-opacity">
                <div className="p-1.5 rounded-lg bg-green-500/10 text-green-400">
                  <Shield className="h-6 w-6" />
                </div>
                <span>MediShare</span>
              </Link>
            </div>

            <div className="hidden md:flex items-center gap-4">
              {navLinks.map(link => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.path) ? 'bg-slate-800 text-green-400' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              ))}

              <div className="h-5 w-px bg-slate-700/60 mx-1" />

              <div className="relative">
                <select
                  value={i18n.language}
                  onChange={(e) => changeLanguage(e.target.value)}
                  aria-label="Select language"
                  className="bg-slate-800 text-sm text-slate-200 rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-green-400 cursor-pointer"
                  dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
                >
                  {languages.map(l => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>

              {user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden lg:flex flex-col items-end text-right">
                    <span className="text-xs font-medium text-slate-200 truncate max-w-[170px]" title={user.email}>{user.email}</span>
                    <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">{user.role}</span>
                  </div>
                  <button
                    onClick={logout}
                    aria-label="Logout of account"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{t('nav.logout')}</span>
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30 transition-colors"
                >
                  {t('nav.login')}
                </Link>
              )}
            </div>

            <button
              className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle navigation menu"
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden px-4 pt-2 pb-4 space-y-1.5 border-t border-slate-800 bg-slate-900/95 backdrop-blur">
            {user && (
              <div className="px-3 py-2 border-b border-slate-800/80 mb-2">
                <p className="text-[11px] text-slate-400">Signed in as</p>
                <p className="text-sm font-medium text-slate-200 truncate">{user.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-green-500/10 text-green-400 rounded-full border border-green-500/20 uppercase">{user.role}</span>
              </div>
            )}
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive(link.path) ? 'bg-slate-800 text-green-400' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
                onClick={() => setMenuOpen(false)}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}

            <div className="pt-2 pb-1">
              <select
                value={i18n.language}
                onChange={(e) => changeLanguage(e.target.value)}
                aria-label="Select language"
                className="w-full bg-slate-800 text-sm text-slate-200 rounded-lg px-3 py-2 border border-slate-700"
                dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
              >
                {languages.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>

            {user ? (
              <button
                onClick={() => { logout(); setMenuOpen(false); }}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-red-400 hover:bg-slate-800/60 rounded-lg w-full"
              >
                <LogOut className="h-4 w-4" />
                {t('nav.logout')}
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30 rounded-lg w-full"
                onClick={() => setMenuOpen(false)}
              >
                {t('nav.login')}
              </Link>
            )}
          </div>
        )}
      </nav>

      <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      <footer className="bg-slate-900 text-slate-400 py-6 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <Shield className="h-4 w-4 text-green-400" />
            <span>MediShare Credentials</span>
          </div>
          <p className="text-center sm:text-right text-slate-500 max-w-md">
            {t('footer.disclaimer')}
          </p>
        </div>
      </footer>
    </div>
  );
}
