import { useState, useEffect, useMemo } from 'react';
import { useApiFetch } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import CanonicalPreview from '../components/CanonicalPreview';
import DrugWarningBanner from '../components/DrugWarningBanner';
import { checkDrugWarnings } from '../lib/drugWarnings';
import type { Patient } from '../types';
import { ArrowLeft, Pill, Save, Plus, Trash2 } from 'lucide-react';
import PageMeta from '../components/PageMeta';
import Breadcrumbs from '../components/Breadcrumbs';
import { trackCTA } from '../lib/analytics';

interface MedItem {
  medication: string;
  strength: string;
  dosage: string;
  duration: string;
  timing: string;
  refills: number;
}

export default function PrescriptionCreate() {
  const apiFetch = useApiFetch();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState('');
  
  const [items, setItems] = useState<MedItem[]>([
    { medication: 'Amoxicillin', strength: '500 mg', dosage: '3× daily', duration: '7 days', timing: '', refills: 0 }
  ]);
  
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdPrescription, setCreatedPrescription] = useState<any>(null);

  useEffect(() => {
    apiFetch('/api/patients').then(res => res.ok && res.json()).then(data => {
      if (data) setPatients(Array.isArray(data) ? data : (data.data || []));
    });
  }, []);

  const handleItemChange = (index: number, field: keyof MedItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { medication: '', strength: '', dosage: '', duration: '', timing: '', refills: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch('/api/prescriptions', {
        method: 'POST',
        body: JSON.stringify({
          patientId: patientId,
          items,
          notes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedPrescription(data);
        setSuccess(true);
        toast('Prescription created successfully', 'success');
        trackCTA('create_prescription_success', { medicationCount: items.length });
      }
    } catch (err) {
      console.error('Create error:', err);
    } finally {
      setLoading(false);
    }
  };

  const issueCredential = async () => {
    if (!createdPrescription) return;
    trackCTA('issue_credential_attempt', { prescriptionId: createdPrescription.id });
    const res = await apiFetch('/api/credentials', {
      method: 'POST',
      body: JSON.stringify({ prescriptionId: createdPrescription.id }),
    });
    if (res.ok) {
      toast('Credential issued and signed', 'success');
      trackCTA('issue_credential_success');
      navigate('/provider');
    }
  };

  const previewData = { items, notes };

  const drugWarnings = useMemo(() => checkDrugWarnings(items, notes), [items, notes]);

  const timingOptions = [
    { value: '', label: 'None specified' },
    { value: 'Morning', label: t('prescription.timingOptions.morning', 'Morning') },
    { value: 'Afternoon', label: t('prescription.timingOptions.afternoon', 'Afternoon') },
    { value: 'Evening', label: t('prescription.timingOptions.evening', 'Evening') },
    { value: 'Bedtime', label: t('prescription.timingOptions.bedtime', 'Bedtime') },
    { value: 'Before meals', label: t('prescription.timingOptions.beforeMeals', 'Before meals') },
    { value: 'After meals', label: t('prescription.timingOptions.afterMeals', 'After meals') },
    { value: 'With meals', label: t('prescription.timingOptions.withMeals', 'With meals') },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <PageMeta
        title="New Prescription"
        description="Author, evaluate drug interactions, and cryptographically sign verifiable prescription credentials for patients."
        canonicalPath="/prescriptions/new"
      />
      <Breadcrumbs
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Prescriptions', path: '/prescriptions' },
          { label: 'New Prescription' },
        ]}
      />
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </button>

      <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('prescription.title')}</h1>

      {success ? (
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <div className="p-4 bg-green-50 rounded-md text-sm text-green-700">
            {t('prescription.success')}
          </div>
          <CanonicalPreview data={previewData} />
          <button
            onClick={issueCredential}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 rounded-md text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            <Pill className="h-4 w-4" />
            {t('prescription.issueCredential')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('prescription.patient')}</label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
              required
            >
              <option value="">{t('common.selectPatient')}</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.display_name} ({p.patient_reference})</option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="bg-white rounded-lg border border-slate-200 p-6 relative">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-slate-800">
                    {t('prescription.medicationNumber', { number: index + 1 })}
                  </h3>
                  {items.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removeItem(index)}
                      className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('prescription.removeMedication')}
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('prescription.medication')}</label>
                    <input
                      type="text"
                      value={item.medication}
                      onChange={(e) => handleItemChange(index, 'medication', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('prescription.strength')}</label>
                    <input
                      type="text"
                      value={item.strength}
                      onChange={(e) => handleItemChange(index, 'strength', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('prescription.dosage')}</label>
                    <input
                      type="text"
                      value={item.dosage}
                      onChange={(e) => handleItemChange(index, 'dosage', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('prescription.duration')}</label>
                    <input
                      type="text"
                      value={item.duration}
                      onChange={(e) => handleItemChange(index, 'duration', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('prescription.timing', 'Timing')}</label>
                    <select
                      value={item.timing}
                      onChange={(e) => handleItemChange(index, 'timing', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
                    >
                      {timingOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('prescription.refills', 'Refills')}</label>
                    <input
                      type="number"
                      min="0"
                      value={item.refills}
                      onChange={(e) => handleItemChange(index, 'refills', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <button
              type="button"
              onClick={addItem}
              className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-600 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900 transition-all font-medium text-sm"
            >
              <Plus className="h-4 w-4" />
              {t('prescription.addMedication')}
            </button>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('prescription.notes')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"
            />
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="mb-4">
              <CanonicalPreview data={previewData} />
            </div>

            <DrugWarningBanner warnings={drugWarnings} />

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 rounded-md text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {loading ? t('common.processing') : t('prescription.submit')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
