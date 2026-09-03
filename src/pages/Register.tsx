import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, AlertCircle, Hash, Eye, EyeOff } from 'lucide-react';
import PageMeta from '../components/PageMeta';
import { trackCTA } from '../lib/analytics';

export default function Register() {
  const { register } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('PATIENT');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<{ name?: boolean; email?: boolean; password?: boolean; licenseNumber?: boolean }>({});
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string; licenseNumber?: string }>({});

  const validateField = (field: 'name' | 'email' | 'password' | 'licenseNumber', val: string, currentRole = role) => {
    let err = '';
    if (field === 'name') {
      if (!val.trim()) {
        err = 'Full name is required';
      } else if (val.trim().length < 2) {
        err = 'Name must be at least 2 characters';
      }
    } else if (field === 'email') {
      if (!val.trim()) {
        err = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
        err = 'Please enter a valid email address';
      }
    } else if (field === 'password') {
      if (!val) {
        err = 'Password is required';
      } else if (val.length < 8) {
        err = 'Password must be at least 8 characters';
      }
    } else if (field === 'licenseNumber') {
      if (currentRole === 'PROVIDER' && !val.trim()) {
        err = 'Medical license number is required for healthcare providers';
      }
    }
    setFieldErrors(prev => ({ ...prev, [field]: err }));
    return !err;
  };

  const handleBlur = (field: 'name' | 'email' | 'password' | 'licenseNumber') => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const val = field === 'name' ? name : field === 'email' ? email : field === 'password' ? password : licenseNumber;
    validateField(field, val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, licenseNumber: true });
    const isNameValid = validateField('name', name);
    const isEmailValid = validateField('email', email);
    const isPasswordValid = validateField('password', password);
    const isLicenseValid = role === 'PROVIDER' ? validateField('licenseNumber', licenseNumber) : true;

    if (!isNameValid || !isEmailValid || !isPasswordValid || !isLicenseValid) {
      return;
    }

    setError('');
    setLoading(true);
    trackCTA('register_submit_attempt', { role });
    try {
      await register({ email, password, role, name, licenseNumber: role === 'PROVIDER' ? licenseNumber : undefined });
      navigate('/login');
    } catch (err: any) {
      setError(err.message || t('register.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 py-2 sm:py-6">
      <PageMeta
        title="Create Account"
        description="Register a patient, healthcare provider, or pharmacist account on MediShare to begin issuing and managing digital prescription credentials."
        canonicalPath="/register"
      />
      <div className="w-full max-w-md">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-slate-900">{t('register.title')}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Create your MediShare identity</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {error && (
            <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-slate-700 mb-1">{t('register.name')}</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  id="reg-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (touched.name) validateField('name', e.target.value);
                  }}
                  onBlur={() => handleBlur('name')}
                  aria-invalid={!!(fieldErrors.name && touched.name)}
                  aria-describedby={fieldErrors.name && touched.name ? "reg-name-error" : undefined}
                  className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-sm transition-colors ${
                    fieldErrors.name && touched.name
                      ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                      : 'border-slate-300 focus:ring-slate-500'
                  }`}
                  placeholder="Dr. Sarah Johnson"
                  required
                />
              </div>
              {fieldErrors.name && touched.name && (
                <p id="reg-name-error" role="alert" className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  <span>{fieldErrors.name}</span>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700 mb-1">{t('register.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  id="reg-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (touched.email) validateField('email', e.target.value);
                  }}
                  onBlur={() => handleBlur('email')}
                  aria-invalid={!!(fieldErrors.email && touched.email)}
                  aria-describedby={fieldErrors.email && touched.email ? "reg-email-error" : undefined}
                  className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-sm transition-colors ${
                    fieldErrors.email && touched.email
                      ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                      : 'border-slate-300 focus:ring-slate-500'
                  }`}
                  placeholder="user@example.com"
                  required
                />
              </div>
              {fieldErrors.email && touched.email && (
                <p id="reg-email-error" role="alert" className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  <span>{fieldErrors.email}</span>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-slate-700 mb-1">{t('register.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (touched.password) validateField('password', e.target.value);
                  }}
                  onBlur={() => handleBlur('password')}
                  aria-invalid={!!(fieldErrors.password && touched.password)}
                  aria-describedby={fieldErrors.password && touched.password ? "reg-password-error" : undefined}
                  className={`w-full pl-10 pr-10 py-2 border rounded-md focus:outline-none focus:ring-2 text-sm transition-colors ${
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
                <p id="reg-password-error" role="alert" className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  <span>{fieldErrors.password}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('register.role')}</label>
              <select
                value={role}
                onChange={(e) => {
                  const newRole = e.target.value;
                  setRole(newRole);
                  if (touched.licenseNumber) validateField('licenseNumber', licenseNumber, newRole);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
              >
                <option value="PATIENT">{t('register.rolePatient')}</option>
                <option value="PROVIDER">{t('register.roleProvider')}</option>
                <option value="PHARMACIST">{t('register.rolePharmacist')}</option>
                <option value="ADMIN">{t('register.roleAdmin')}</option>
              </select>
            </div>

            {role === 'PROVIDER' && (
              <div>
                <label htmlFor="reg-license" className="block text-sm font-medium text-slate-700 mb-1">{t('register.licenseNumber')}</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    id="reg-license"
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => {
                      setLicenseNumber(e.target.value);
                      if (touched.licenseNumber) validateField('licenseNumber', e.target.value);
                    }}
                    onBlur={() => handleBlur('licenseNumber')}
                    aria-invalid={!!(fieldErrors.licenseNumber && touched.licenseNumber)}
                    aria-describedby={fieldErrors.licenseNumber && touched.licenseNumber ? "reg-license-error" : undefined}
                    className={`w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-sm transition-colors ${
                      fieldErrors.licenseNumber && touched.licenseNumber
                        ? 'border-red-400 focus:ring-red-400 bg-red-50/20'
                        : 'border-slate-300 focus:ring-slate-500'
                    }`}
                    placeholder="MD-12345678"
                    required
                  />
                </div>
                {fieldErrors.licenseNumber && touched.licenseNumber && (
                  <p id="reg-license-error" role="alert" className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    <span>{fieldErrors.licenseNumber}</span>
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-2.5 rounded-md text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('common.processing') : t('register.submit')}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-slate-500">
            {t('register.loginPrompt')}{' '}
            <Link to="/login" className="text-slate-900 font-medium hover:underline">
              {t('register.loginLink')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
