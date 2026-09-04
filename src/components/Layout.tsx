import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Shield, LogOut, Menu, X, Stethoscope, Pill, ScanLine, Activity, ShieldCheck, ChevronDown, User } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import CookieConsent from './CookieConsent';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const isActive = (path: string) => {
    if (location.pathname === path) return true;
    if (path === '/dashboard' && (location.pathname === '/dashboard' || location.pathname === '/provider')) return true;
    if (path === '/patient' && (location.pathname === '/patient' || location.pathname.startsWith('/credentials'))) return true;
    if (path === '/admin' && (location.pathname === '/admin' || location.pathname === '/dashboard')) return true;
    if (path === '/prescriptions' && location.pathname.startsWith('/prescriptions')) return true;
    if (path === '/revocations' && location.pathname.startsWith('/revocations')) return true;
    if (path === '/verify' && location.pathname.startsWith('/verify')) return true;
    if (path === '/audit' && location.pathname.startsWith('/audit')) return true;
    return false;
  };

  const navLinks = user?.role === 'ADMIN' ? [
    { path: '/admin', label: t('nav.adminPortal', { defaultValue: 'Admin Portal' }), icon: Shield },
    { path: '/audit', label: t('nav.audit', { defaultValue: 'Audit Trail' }), icon: Activity },
    { path: '/verify', label: t('nav.verify', { defaultValue: 'Verify' }), icon: ScanLine },
  ] : user?.role === 'PROVIDER' ? [
    { path: '/dashboard', label: t('nav.dashboard', { defaultValue: 'Dashboard' }), icon: Stethoscope },
    { path: '/prescriptions', label: t('nav.prescriptions', { defaultValue: 'Prescriptions' }), icon: Pill },
    { path: '/revocations', label: t('nav.revocations', { defaultValue: 'Revocations' }), icon: ShieldCheck },
    { path: '/verify', label: t('nav.verify', { defaultValue: 'Verify' }), icon: ScanLine },
  ] : user?.role === 'PHARMACIST' ? [
    { path: '/verify', label: t('nav.verifyDispense', { defaultValue: 'Verify & Dispense' }), icon: ScanLine },
  ] : user?.role === 'PATIENT' ? [
    { path: '/patient', label: t('nav.myPrescriptions', { defaultValue: 'My Prescriptions' }), icon: Pill },
    { path: '/verify', label: t('nav.verify', { defaultValue: 'Verify' }), icon: ScanLine },
  ] : [
    { path: '/verify', label: t('nav.verify', { defaultValue: 'Verify' }), icon: ScanLine },
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
      <nav className="bg-slate-900 text-white shadow-sm sticky top-0 z-50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Left: Brand + Navigation Links */}
            <div className="flex items-center gap-5 lg:gap-6 min-w-0">
              <Link
                to={user ? "/dashboard" : "/"}
                className="flex items-center gap-2.5 text-lg sm:text-xl font-bold tracking-tight text-white hover:opacity-95 transition-opacity shrink-0"
              >
                <div className="p-1.5 rounded-xl bg-green-500/15 text-green-400 border border-green-500/20 shadow-sm">
                  <Shield className="h-5 w-5" />
                </div>
                <span>MediShare</span>
              </Link>

              <div className="hidden md:block h-5 w-px bg-slate-800 shrink-0" />

              {/* Desktop Nav Links */}
              <div className="hidden md:flex items-center gap-1.5">
                {navLinks.map(link => {
                  const active = isActive(link.path);
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        active
                          ? 'bg-slate-800 text-green-400 border border-slate-700/80 shadow-xs'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <link.icon className={`h-4 w-4 ${active ? 'text-green-400' : 'text-slate-400'}`} />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right: Language + User Profile + Controls */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <div className="relative">
                <select
                  value={i18n.language}
                  onChange={(e) => changeLanguage(e.target.value)}
                  aria-label="Select language"
                  className="bg-slate-800 hover:bg-slate-750 text-xs font-medium text-slate-200 rounded-lg px-2.5 py-1.5 border border-slate-700/80 focus:outline-none focus:ring-1 focus:ring-green-400/50 cursor-pointer transition-colors"
                  dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
                >
                  {languages.map(l => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>

              <div className="h-5 w-px bg-slate-800 mx-0.5" />

              {user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    aria-expanded={userMenuOpen}
                    aria-haspopup="true"
                    aria-label="User account menu"
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
                      userMenuOpen
                        ? 'bg-slate-800 border-slate-600 text-white'
                        : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-200 hover:text-white'
                    }`}
                  >
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${
                      user.role === 'ADMIN' ? 'bg-amber-600' :
                      user.role === 'PROVIDER' ? 'bg-emerald-600' :
                      user.role === 'PHARMACIST' ? 'bg-purple-600' :
                      'bg-sky-600'
                    }`}>
                      {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span className="text-xs font-medium truncate max-w-[150px]" title={user.email}>
                      {user.email}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                      user.role === 'ADMIN' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
                      user.role === 'PROVIDER' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                      user.role === 'PHARMACIST' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' :
                      'bg-sky-500/15 text-sky-300 border-sky-500/30'
                    }`}>
                      {user.role}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180 text-white' : ''}`} />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl p-2 z-50 text-slate-200 animate-in fade-in slide-in-from-top-2 duration-150">
                      {/* User Info Header Card */}
                      <div className="p-3 bg-slate-900/70 rounded-xl mb-1.5 border border-slate-700/60 flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-sm ${
                          user.role === 'ADMIN' ? 'bg-amber-600' :
                          user.role === 'PROVIDER' ? 'bg-emerald-600' :
                          user.role === 'PHARMACIST' ? 'bg-purple-600' :
                          'bg-sky-600'
                        }`}>
                          {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate" title={user.email}>
                            {user.email}
                          </p>
                          <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border mt-1 ${
                            user.role === 'ADMIN' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
                            user.role === 'PROVIDER' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                            user.role === 'PHARMACIST' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' :
                            'bg-sky-500/15 text-sky-300 border-sky-500/30'
                          }`}>
                            {user.role} Account
                          </span>
                        </div>
                      </div>

                      {/* Navigation Links */}
                      <div className="space-y-0.5">
                        <Link
                          to={user.role === 'PROVIDER' ? '/dashboard' : user.role === 'PATIENT' ? '/patient' : user.role === 'ADMIN' ? '/admin' : '/verify'}
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-700/80 hover:text-white transition-colors"
                        >
                          <User className="h-4 w-4 text-slate-400" />
                          <span>My Portal</span>
                        </Link>

                        {user.role === 'PATIENT' && (
                          <Link
                            to="/patient"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-700/80 hover:text-white transition-colors"
                          >
                            <Pill className="h-4 w-4 text-slate-400" />
                            <span>My Prescriptions</span>
                          </Link>
                        )}

                        {user.role === 'PROVIDER' && (
                          <Link
                            to="/prescriptions/new"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-700/80 hover:text-white transition-colors"
                          >
                            <Stethoscope className="h-4 w-4 text-slate-400" />
                            <span>Issue Prescription</span>
                          </Link>
                        )}

                        <Link
                          to="/verify"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-700/80 hover:text-white transition-colors"
                        >
                          <ScanLine className="h-4 w-4 text-slate-400" />
                          <span>Verify Prescription</span>
                        </Link>
                      </div>

                      {/* Logout Action */}
                      <div className="mt-1.5 pt-1.5 border-t border-slate-700/70">
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 transition-colors text-left cursor-pointer"
                        >
                          <LogOut className="h-4 w-4 text-rose-400" />
                          <span>{t('nav.logout')}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30 transition-colors"
                  >
                    {t('nav.login')}
                  </Link>
                  <Link
                    to="/register"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-750 border border-slate-700 transition-colors"
                  >
                    {t('nav.register')}
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Controls */}
            <div className="flex items-center gap-2 md:hidden">
              {!user && (
                <Link
                  to="/login"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30 transition-colors"
                >
                  {t('nav.login')}
                </Link>
              )}
              <button
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle navigation menu"
              >
                {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden px-4 pt-2 pb-4 space-y-2 border-t border-slate-800 bg-slate-900/98 shadow-xl">
            {user && (
              <div className="px-3 py-2.5 border-b border-slate-800/80 mb-2 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0 ${
                  user.role === 'ADMIN' ? 'bg-amber-600' :
                  user.role === 'PROVIDER' ? 'bg-emerald-600' :
                  user.role === 'PHARMACIST' ? 'bg-purple-600' :
                  'bg-sky-600'
                }`}>
                  {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-200 truncate">{user.email}</p>
                  <span className={`inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                    user.role === 'ADMIN' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
                    user.role === 'PROVIDER' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                    user.role === 'PHARMACIST' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' :
                    'bg-sky-500/15 text-sky-300 border-sky-500/30'
                  }`}>
                    {user.role}
                  </span>
                </div>
              </div>
            )}
            {navLinks.map(link => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active ? 'bg-slate-800 text-green-400 font-semibold' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  <link.icon className={`h-4 w-4 ${active ? 'text-green-400' : 'text-slate-400'}`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-3 px-1">
              <span className="text-xs text-slate-400">Language:</span>
              <select
                value={i18n.language}
                onChange={(e) => changeLanguage(e.target.value)}
                aria-label="Select language"
                className="bg-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 border border-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-green-400"
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
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-400 hover:bg-slate-800/60 rounded-lg w-full cursor-pointer mt-1"
              >
                <LogOut className="h-4 w-4" />
                <span>{t('nav.logout')}</span>
              </button>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30 rounded-lg w-full"
                  onClick={() => setMenuOpen(false)}
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-slate-800 text-slate-200 hover:text-white border border-slate-700 rounded-lg w-full"
                  onClick={() => setMenuOpen(false)}
                >
                  {t('nav.register')}
                </Link>
              </div>
            )}
          </div>
        )}
      </nav>

      <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      <footer className="bg-slate-900 text-slate-200 py-8 border-t border-slate-850 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2.5 text-white font-semibold">
              <div className="p-1 rounded-lg bg-green-500/15 border border-green-500/20 text-green-400">
                <Shield className="h-4 w-4" />
              </div>
              <span className="text-white font-medium">MediShare Verifiable Credentials</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs">
              <Link to="/privacy" className="text-slate-200 hover:text-white transition-colors underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-slate-200 hover:text-white transition-colors underline-offset-4 hover:underline">
                Terms of Service
              </Link>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-300">
            <p className="text-center sm:text-left leading-relaxed max-w-2xl text-slate-300 font-normal">
              {t('footer.disclaimer')}
            </p>
            <div className="text-center sm:text-right font-medium text-slate-200 bg-slate-800 px-3 py-1 rounded-md border border-slate-700 shrink-0">
              W3C VC 2.0 &bull; HL7 FHIR &bull; RFC 8785
            </div>
          </div>
        </div>
      </footer>

      <CookieConsent />
    </div>
  );
}
