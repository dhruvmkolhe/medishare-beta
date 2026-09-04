import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PageMeta from '../components/PageMeta';
import {
  Shield,
  ScanLine,
  Pill,
  Stethoscope,
  KeyRound,
  CheckCircle2,
  Lock,
  ArrowRight,
  FileCheck2,
  Sparkles
} from 'lucide-react';

export default function Home() {
  const { user } = useAuth();

  const sampleId = 'c9c52004-6fb3-4654-8fbd-2bd360802816';

  return (
    <div className="space-y-16 pb-12">
      <PageMeta
        title="MediShare — Decentralized, Tamper-Proof Digital Prescriptions"
        description="Replace insecure paper prescriptions with Ed25519 digitally signed medical credentials. Prevent double-dispensing, dosage tampering, and unauthorized claims."
        canonicalPath="/"
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white px-6 py-16 sm:px-12 sm:py-24 shadow-xl border border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-green-500/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="max-w-3xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Cryptographic Healthcare Infrastructure</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Tamper-Proof Digital Prescriptions. Zero Fraud. Instant Verification.
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Replace vulnerable paper slips with <strong>Ed25519 digitally signed</strong> medical credentials. Prevent double-dispensing, dosage tampering, and unauthorized claims with cryptographic certainty.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Link
              to="/verify"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-green-500 hover:bg-green-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-green-500/20 hover:scale-[1.02]"
            >
              <ScanLine className="h-4 w-4" />
              <span>Verify a Prescription</span>
            </Link>

            {user ? (
              <Link
                to={user.role === 'PROVIDER' ? '/provider' : user.role === 'PATIENT' ? '/patient' : user.role === 'ADMIN' ? '/admin' : '/verify'}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 transition-colors"
              >
                <span>Go to Your Portal ({user.role})</span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 transition-colors"
              >
                <Lock className="h-4 w-4 text-slate-400" />
                <span>Sign In to Portal</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Quick Verifier Card */}
      <section className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base sm:text-lg">
              <FileCheck2 className="h-5 w-5 text-green-600" />
              <span>Test Public Prescription Verification</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Anyone can verify digital signatures and tamper detection. Dispensation is strictly gated to licensed pharmacists.
            </p>
          </div>
          <Link
            to="/verify"
            className="shrink-0 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg border border-green-200 transition-colors"
          >
            Open Full Scanner &rarr;
          </Link>
        </div>

        <div className="mt-5 bg-slate-50 rounded-xl p-4 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Benchmark Credential UUID:
            </span>
            <span className="font-mono text-xs sm:text-sm text-slate-800 font-medium block truncate">
              {sampleId}
            </span>
          </div>
          <Link
            to={`/verify/${sampleId}`}
            className="inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors shrink-0 shadow-xs"
          >
            <span>Verify Benchmark</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* 3 User Personas */}
      <section className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Designed for Every Stakeholder in Healthcare
          </h2>
          <p className="text-sm text-slate-500 max-w-xl mx-auto">
            A seamless bridge between doctors, patients, and pharmacies with zero shared database passwords or phone verifications.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 pt-4">
          {/* Patient Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Pill className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">For Patients</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Carry your verifiable digital prescriptions in your phone. Show your offline QR code or printable PDF at any participating pharmacy.
              </p>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Personal wallet with all active prescriptions</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Protected with a secret <strong>Patient Pickup PIN</strong></span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Exportable vector PDF for paper pickup</span>
                </li>
              </ul>
            </div>
            <div className="pt-6">
              <Link
                to="/patient"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs transition-colors"
              >
                <span>Open Patient Wallet</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Provider Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Stethoscope className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">For Healthcare Providers</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Issue RFC 8785 canonical prescriptions signed with your Ed25519 cryptographic key. Integrated safety checks prevent medication errors.
              </p>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Live drug-drug interaction & dosage alerts</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Hardware-level cryptographic tamper detection</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Instant credential revocation dashboard</span>
                </li>
              </ul>
            </div>
            <div className="pt-6">
              <Link
                to="/prescriptions/new"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs transition-colors"
              >
                <span>Provider Issuance Portal</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Pharmacist Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <ScanLine className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">For Licensed Pharmacists</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Scan patient QR codes in milliseconds. Verify cryptographic doctor signatures, track authorized refills, and prevent double-dispense fraud.
              </p>
              <ul className="space-y-2 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Direct browser QR scanning or UUID input</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Authenticated dispensing with Patient PIN 2FA</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Automated refill deduction & audit trail</span>
                </li>
              </ul>
            </div>
            <div className="pt-6">
              <Link
                to="/verify"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-xs transition-colors"
              >
                <span>Verify & Dispense Portal</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Security Architecture & Anti-Theft Pillars */}
      <section className="max-w-6xl mx-auto bg-slate-900 text-white rounded-3xl p-8 sm:p-12 border border-slate-800 shadow-xl space-y-8">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-wider text-green-400">Zero-Trust Security Model</span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            How MediShare Stops Credential Theft & Fake Dispensing
          </h2>
          <p className="text-sm text-slate-300 mt-2">
            In insecure systems, if someone snaps a photo of a prescription ID, they can claim the medicine. MediShare eliminates this vulnerability through defense-in-depth:
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
          <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-3">
            <div className="p-2.5 rounded-lg bg-green-500/10 text-green-400 w-fit">
              <Shield className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-sm text-white">1. Ed25519 Cryptography</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every dosage, duration, and refill is signed with the doctor's private key. Altering even 1 character causes mathematical signature verification failure.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 w-fit">
              <Lock className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-sm text-white">2. Gated Dispensation</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Anyone can verify signatures publicly, but only authenticated, licensed pharmacists can execute dispensations. Anonymous visitors cannot redeem or burn refills.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 w-fit">
              <KeyRound className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-sm text-white">3. Patient Pickup PIN (2FA)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              A secret PIN is visible only inside the patient's authenticated wallet. Even if a thief steals or photocopies the QR code, the pharmacist cannot dispense without the patient's PIN.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 w-fit">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-sm text-white">4. Immutable Audit Trail</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every dispensation records the licensed pharmacist's ID, timestamp, and pharmacy name into an append-only audit log, creating absolute legal accountability.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
