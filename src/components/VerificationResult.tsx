import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, AlertTriangle, Info } from 'lucide-react';
import DrugWarningBanner from './DrugWarningBanner';
import { checkDrugWarnings } from '../lib/drugWarnings';
import type { VerificationResult as VerificationResultType } from '../types';

interface Props {
  result: VerificationResultType | null;
  onDispense?: (credentialId: string) => Promise<void>;
  credentialId?: string;
}

export default function VerificationResult({ result, onDispense, credentialId }: Props) {
  const { t } = useTranslation();

  const drugWarnings = useMemo(() => {
    if (!result?.credential) return [];
    const medItems = result.credential.items && result.credential.items.length > 0
      ? result.credential.items.map(i => ({ medication: i.medication, strength: i.strength }))
      : [{ medication: result.credential.medication, strength: result.credential.strength }];
    return checkDrugWarnings(medItems);
  }, [result]);

  if (!result) return null;

  const isPass = result.result === 'PASS';
  const hasItems = result.credential?.items && result.credential.items.length > 0;
  const isDispensed = result.credential?.status === 'DISPENSED' || result.credential?.dispensation;

  return (
    <div className="max-w-md mx-auto">
      <div className={`border-2 rounded-lg p-6 ${isPass ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <div className="text-center mb-6">
          {isPass ? (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
          )}
          <h2 className={`text-2xl font-bold ${isPass ? 'text-green-800' : 'text-red-800'}`}>
            {isPass ? t('verify.verified') : t('verify.failed')}
          </h2>
          <p className="text-sm mt-1 text-slate-600">{t('verify.prescriptionCredential')}</p>
        </div>

        {result.credential && (
          <div className="bg-white rounded-md border border-slate-200 p-4 mb-4 space-y-4 text-sm">
            {hasItems ? (
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-700">Medications</h3>
                <div className="space-y-2">
                  {result.credential.items!.map((item, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded border border-slate-100">
                      <div className="font-medium text-slate-900">{item.medication} {item.strength}</div>
                      <div className="text-slate-600 mt-1">{item.dosage} for {item.duration}</div>
                      {(item.timing || item.refills > 0) && (
                        <div className="text-xs text-slate-500 mt-1 flex gap-3">
                          {item.timing && <span>Timing: {item.timing}</span>}
                          {item.refills > 0 && <span>Refills: {item.refills}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('verify.medication')}</span>
                  <span className="font-medium text-slate-900">{result.credential.medication}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('verify.strength')}</span>
                  <span className="font-medium text-slate-900">{result.credential.strength}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('verify.dosage')}</span>
                  <span className="font-medium text-slate-900">{result.credential.dosage}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('verify.duration')}</span>
                  <span className="font-medium text-slate-900">{result.credential.duration}</span>
                </div>
              </div>
            )}
            
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('verify.issued')}</span>
                <span className="font-medium text-slate-900">{new Date(result.credential.issued_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('verify.expires')}</span>
                <span className="font-medium text-slate-900">{new Date(result.credential.expires_at).toLocaleDateString()}</span>
              </div>
              {result.credential.provider_name && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('verify.provider')}</span>
                  <span className="font-medium text-slate-900">{result.credential.provider_name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <DrugWarningBanner warnings={drugWarnings} />

        {isDispensed && result.credential?.dispensation && (
          <div className="mt-4 mb-4 p-3 bg-purple-100 rounded-md text-sm text-purple-800 flex items-start gap-2">
            <Info className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">{t('dispensation.alreadyDispensed')}</p>
              <p className="mt-0.5 text-xs text-purple-600">
                {t('dispensation.dispensedAt')} {result.credential.dispensation.pharmacy_name} {t('dispensation.dispensedOn')} {new Date(result.credential.dispensation.dispensed_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}

        {result.credential?.max_dispensations && result.credential.max_dispensations > 1 && (
          <div className="mt-4 mb-4 p-3 bg-blue-50 rounded-md text-sm text-blue-800 border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                <span className="font-medium">Refill Status</span>
              </div>
              <span className="text-xs bg-blue-100 px-2 py-0.5 rounded-full">
                {result.credential.dispensation_count || 0} of {result.credential.max_dispensations} fills used
              </span>
            </div>
            {(result.credential.refills_remaining || 0) > 0 && (
              <p className="text-xs mt-1.5 text-blue-600">
                {result.credential.refills_remaining} fill{result.credential.refills_remaining !== 1 ? 's' : ''} remaining
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          {result.checks && Object.entries(result.checks).map(([key, check]) => (
            <div key={key} className={`flex items-center gap-2 p-2 rounded-md text-sm ${
              check.passed ? 'bg-green-100/50 text-green-700' : 'bg-red-100/50 text-red-700'
            }`}>
              {check.passed ? <Check className="h-4 w-4 flex-shrink-0" /> : <X className="h-4 w-4 flex-shrink-0" />}
              <span>{check.label}</span>
            </div>
          ))}
        </div>

        {!isPass && result.failureReason && (
          <div className="mt-4 p-3 bg-red-100 rounded-md text-sm text-red-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">{result.failureReason}</p>
                <p className="mt-1 text-xs">{t('verify.contactProvider')}</p>
              </div>
            </div>
          </div>
        )}

        {result.credential?.status === 'ACTIVE' && onDispense && credentialId && (
          <div className="mt-6">
            <button
              onClick={() => onDispense(credentialId)}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Check className="h-5 w-5" />
              {t('dispensation.markDispensed')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
