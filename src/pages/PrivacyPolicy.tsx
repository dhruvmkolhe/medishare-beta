import PageMeta from '../components/PageMeta';
import Breadcrumbs from '../components/Breadcrumbs';
import { Shield, Lock, Eye, FileText, Mail } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto w-full py-2 sm:py-6">
      <PageMeta
        title="Privacy Policy"
        description="Learn how MediShare protects sensitive healthcare data with cryptographic signatures, selective disclosure, and zero-knowledge principles."
        canonicalPath="/privacy"
      />
      <Breadcrumbs items={[{ label: 'Privacy Policy' }]} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8">
        <div className="border-b border-slate-100 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-700 text-xs font-semibold mb-3">
            <Shield className="h-3.5 w-3.5" />
            <span>Healthcare Data Protection</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate-500">Last updated: January 2025</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Lock className="h-5 w-5 text-slate-700" />
            <span>1. Our Cryptographic Privacy Guarantee</span>
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            MediShare is architected under the principle of <strong>data minimization and cryptographic verification</strong>. Rather than storing sensitive medical prescriptions in centralized plaintext databases accessible to third parties, MediShare uses Ed25519 digital signatures and RFC 8785 canonical hashing.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Prescriptions exist as tamper-evident credentials held directly in the patient&#39;s custody. Healthcare providers sign prescriptions with their private keys, allowing pharmacists to verify authenticity mathematically without sharing health records across unauthorized networks.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Eye className="h-5 w-5 text-slate-700" />
            <span>2. Information We Collect</span>
          </h2>
          <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1.5 leading-relaxed">
            <li><strong>Account Credentials:</strong> Full name, professional license numbers (for healthcare providers), and email addresses required for role-based authentication.</li>
            <li><strong>Prescription Metadata:</strong> Medication codes (RxNorm/HL7 FHIR format), dosages, refill allocations, and cryptographic public key signatures.</li>
            <li><strong>Audit Logs:</strong> Immutable timestamps of credential issuance, cryptographic verification attempts, and pharmacy dispensation events for regulatory compliance.</li>
            <li><strong>Essential Session Cookies:</strong> Encrypted HTTP-only JSON Web Tokens (JWT) necessary to maintain secure sessions.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-700" />
            <span>3. How We Use and Protect Your Data</span>
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            All data processed by MediShare serves the exclusive purpose of authenticating medical prescriptions, preventing dangerous drug-drug interactions, and mitigating duplicate dispensation fraud. Private signing keys are secured using industry-standard AES-256-GCM envelope encryption.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            MediShare does not monetize, sell, or rent patient or provider health information to advertisers or non-clinical commercial entities under any circumstances.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-700" />
            <span>4. Contact and Privacy Inquiries</span>
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            If you have questions regarding this Privacy Policy, your medical data rights, or our cryptographic architecture, please contact our data privacy team:
          </p>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-sm text-slate-700">
            {/* TODO: Replace privacy@medishare.example.com with your official contact email */}
            <p className="font-semibold text-slate-900">MediShare Privacy &amp; Compliance Office</p>
            <p className="mt-1 text-slate-600">Email: <a href="mailto:privacy@medishare.example.com" className="text-green-600 hover:underline">privacy@medishare.example.com</a></p>
          </div>
        </section>
      </div>
    </div>
  );
}
