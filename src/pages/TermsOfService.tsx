import PageMeta from '../components/PageMeta';
import Breadcrumbs from '../components/Breadcrumbs';
import { Scale, AlertCircle, FileCheck, Stethoscope } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto w-full py-2 sm:py-6">
      <PageMeta
        title="Terms of Service"
        description="Terms of Service and legal agreements governing the issuance, custody, and verification of digital prescription credentials on MediShare."
        canonicalPath="/terms"
      />
      <Breadcrumbs items={[{ label: 'Terms of Service' }]} />

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8">
        <div className="border-b border-slate-100 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-700 text-xs font-semibold mb-3">
            <Scale className="h-3.5 w-3.5" />
            <span>Platform Agreement</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Terms of Service</h1>
          <p className="mt-2 text-sm text-slate-500">Effective Date: January 2025</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-slate-700" />
            <span>1. Acceptance of Terms</span>
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            By accessing or using the MediShare platform, you agree to be bound by these Terms of Service. If you are using the platform on behalf of a healthcare institution, clinic, or pharmacy, you represent that you hold authorized legal authority to bind that entity.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-slate-700" />
            <span>2. Healthcare Provider Representations &amp; Cryptographic Intent</span>
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Healthcare providers issuing digital prescriptions on MediShare warrant that they hold valid, active medical licenses within their practicing jurisdiction.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Signing a digital prescription with your private Ed25519 cryptographic key constitutes legally binding electronic prescribing intent equivalent to a physical handwritten signature under applicable electronic transactions and healthcare credentialing statutes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-slate-700" />
            <span>3. Pharmacist Verification &amp; Dispensation</span>
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Pharmacists utilizing the public verification portal must verify the cryptographic signature validity and remaining refill allocations prior to dispensing medications. Any prescription flagged as revoked, expired, or tampered with must be withheld in accordance with pharmacy regulations.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">4. Emergency Medical Disclaimer</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            MediShare is a technical verification and cryptographic credential infrastructure. It does not provide medical advice or emergency medical services. In the event of a medical emergency, immediately contact your local emergency services (e.g., 911 or 112).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">5. Contact and Legal Notices</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            For legal inquiries or notices regarding these terms, please contact:
          </p>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-sm text-slate-700">
            {/* TODO: Replace legal@medishare.example.com with your official legal contact email */}
            <p className="font-semibold text-slate-900">MediShare Legal &amp; Regulatory Affairs</p>
            <p className="mt-1 text-slate-600">Email: <a href="mailto:legal@medishare.example.com" className="text-green-600 hover:underline">legal@medishare.example.com</a></p>
          </div>
        </section>
      </div>
    </div>
  );
}
