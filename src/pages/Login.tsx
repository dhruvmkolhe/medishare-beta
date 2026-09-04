import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import PageMeta from '../components/PageMeta';
import { trackCTA } from '../lib/analytics';

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setTouched({ email: true, password: true });
    setFieldErrors({});
    setError('');
  };

  const validateField = (name: 'email' | 'password', val: string) => {
    let err = '';
    if (name === 'email') {
      if (!val.trim()) {
        err = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
        err = 'Please enter a valid email address';
      }
    } else if (name === 'password') {
      if (!val) {
        err = 'Password is required';
      } else if (val.length < 8) {
        err = 'Password must be at least 8 characters';
      }
    }
    setFieldErrors(prev => ({ ...prev, [name]: err }));
    return !err;
  };

  const handleBlur = (field: 'email' | 'password') => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, field === 'email' ? email : password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    const isEmailValid = validateField('email', email);
    const isPasswordValid = validateField('password', password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    setError('');
    setLoading(true);
    trackCTA('login_submit_attempt');
    try {
      await login(email, password);
      toast('Welcome back!', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 py-2 sm:py-6">
      <PageMeta
        title="Sign In"
        description="Access your MediShare healthcare portal to manage, issue, or review cryptographically signed digital prescriptions and verifiable credentials."
        canonicalPath="/login"
      />
      <div className="w-full max-w-md">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-slate-900">{t('login.title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Enter your credentials to access your portal</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {error && (
            <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200/90">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                Demo Accounts
              </span>
              <span className="text-[11px] text-slate-400">1-click to fill</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickFill('dr.sharma@medishare.com', 'password123')}
                className="py-1.5 px-2 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-md text-xs font-medium text-slate-700 transition-colors text-center cursor-pointer shadow-xs"
              >
                Doctor
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('pharmacist@medishare.com', 'password123')}
                className="py-1.5 px-2 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-md text-xs font-medium text-slate-700 transition-colors text-center cursor-pointer shadow-xs"
              >
                Pharmacist
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('john.doe@medishare.com', 'password123')}
                className="py-1.5 px-2 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-md text-xs font-medium text-slate-700 transition-colors text-center cursor-pointer shadow-xs"
              >
                Patient
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('admin@medishare.com', 'password123')}
                className="py-1.5 px-2 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-md text-xs font-medium text-slate-700 transition-colors text-center cursor-pointer shadow-xs"
              >
                Admin
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-slate-700 mb-1">{t('login.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (touched.email) validateField('email', e.target.value);
                  }}
                  onBlur={() => handleBlur('email')}
                  aria-invalid={!!(fieldErrors.email && touched.email)}
                  aria-describedby={fieldErrors.email && touched.email ? "login-email-error" : undefined}
                  className={`w-full pl-9 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm transition-colors ${
                    fieldErrors.email && touched.email
                      ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                      : 'border-slate-300 focus:ring-slate-500'
                  }`}
                  placeholder="provider@example.com"
                  required
                />
              </div>
              {fieldErrors.email && touched.email && (
                <p id="login-email-error" role="alert" className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  <span>{fieldErrors.email}</span>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-medium text-slate-700 mb-1">{t('login.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (touched.password) validateField('password', e.target.value);
                  }}
                  onBlur={() => handleBlur('password')}
                  aria-invalid={!!(fieldErrors.password && touched.password)}
                  aria-describedby={fieldErrors.password && touched.password ? "login-password-error" : undefined}
                  className={`w-full pl-9 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm transition-colors ${
                    fieldErrors.password && touched.password
                      ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                      : 'border-slate-300 focus:ring-slate-500'
                  }`}
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 rounded p-0.5"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              {fieldErrors.password && touched.password && (
                <p id="login-password-error" role="alert" className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  <span>{fieldErrors.password}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs mt-1"
            >
              {loading ? t('common.processing') : t('login.submit')}
            </button>
          </form>

          <div className="mt-4 text-center text-xs text-slate-500">
            {t('login.registerPrompt')}{' '}
            <Link to="/register" className="text-slate-900 font-semibold hover:underline">
              {t('login.registerLink')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
