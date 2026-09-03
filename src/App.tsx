import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProviderDashboard = lazy(() => import('./pages/ProviderDashboard'));
const PatientDashboard = lazy(() => import('./pages/PatientDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const PharmacistVerify = lazy(() => import('./pages/PharmacistVerify'));
const CredentialView = lazy(() => import('./pages/CredentialView'));
const VerificationResultPage = lazy(() => import('./pages/VerificationResultPage'));
const PrescriptionCreate = lazy(() => import('./pages/PrescriptionCreate'));
const CredentialCompare = lazy(() => import('./pages/CredentialCompare'));
const RevocationDashboard = lazy(() => import('./pages/RevocationDashboard'));
const AuditTrail = lazy(() => import('./pages/AuditTrail'));
const NotFound = lazy(() => import('./pages/NotFound'));

import ErrorBoundary from './components/ErrorBoundary';

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-medium tracking-wide">Loading page...</span>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <ToastProvider>
            <Layout>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/verify" element={<PharmacistVerify />} />
                <Route path="/verify/:credentialId" element={<VerificationResultPage />} />

            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/provider" element={
              <ProtectedRoute roles={['PROVIDER', 'ADMIN']}>
                <ProviderDashboard />
              </ProtectedRoute>
            } />
            <Route path="/patient" element={
              <ProtectedRoute roles={['PATIENT', 'ADMIN']}>
                <PatientDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute roles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/prescriptions/new" element={
              <ProtectedRoute roles={['PROVIDER', 'ADMIN']}>
                <PrescriptionCreate />
              </ProtectedRoute>
            } />
            <Route path="/credentials/:id" element={
              <ProtectedRoute>
                <CredentialView />
              </ProtectedRoute>
            } />
            <Route path="/credentials/:id/compare" element={
              <ProtectedRoute roles={['PROVIDER', 'ADMIN']}>
                <CredentialCompare />
              </ProtectedRoute>
            } />
            <Route path="/revocations" element={
              <ProtectedRoute roles={['PROVIDER', 'ADMIN']}>
                <RevocationDashboard />
              </ProtectedRoute>
            } />
            <Route path="/audit" element={
              <ProtectedRoute roles={['ADMIN', 'PROVIDER']}>
                <AuditTrail />
              </ProtectedRoute>
            } />
            <Route path="/prescriptions" element={
              <ProtectedRoute roles={['PROVIDER', 'ADMIN']}>
                <ProviderDashboard />
              </ProtectedRoute>
            } />
            <Route path="/" element={<PharmacistVerify />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
          </ToastProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
