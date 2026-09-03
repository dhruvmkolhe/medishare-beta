import { describe, it, expect } from 'vitest';
import { checkDrugWarnings } from '../src/lib/drugWarnings';

describe('Drug Warnings & Interaction Engine', () => {
  describe('Drug-Drug Interactions', () => {
    it('detects high-severity interaction between Warfarin and Aspirin', () => {
      const items = [
        { medication: 'Warfarin Sodium', strength: '5 mg' },
        { medication: 'Aspirin', strength: '81 mg' },
      ];
      const warnings = checkDrugWarnings(items);
      expect(warnings.length).toBeGreaterThanOrEqual(1);
      const highWarn = warnings.find(w => w.type === 'interaction' && w.severity === 'high');
      expect(highWarn).toBeDefined();
      expect(highWarn?.message).toContain('Warfarin + Aspirin');
    });

    it('detects interaction between Lithium and NSAID (Ibuprofen)', () => {
      const items = [
        { medication: 'Lithium Carbonate', strength: '300 mg' },
        { medication: 'Ibuprofen', strength: '400 mg' },
      ];
      const warnings = checkDrugWarnings(items);
      const warn = warnings.find(w => w.message.includes('Lithium + Ibuprofen'));
      expect(warn).toBeDefined();
      expect(warn?.severity).toBe('high');
    });

    it('detects medium-severity interaction between Lisinopril and Potassium', () => {
      const items = [
        { medication: 'Lisinopril', strength: '10 mg' },
        { medication: 'Potassium Chloride', strength: '20 mEq' },
      ];
      const warnings = checkDrugWarnings(items);
      const warn = warnings.find(w => w.message.includes('Lisinopril + Potassium'));
      expect(warn).toBeDefined();
      expect(warn?.severity).toBe('medium');
    });

    it('returns empty warnings for safe standard combinations', () => {
      const items = [
        { medication: 'Atorvastatin', strength: '20 mg' },
        { medication: 'Metformin', strength: '500 mg' },
      ];
      const warnings = checkDrugWarnings(items, 'Take with food.');
      expect(warnings).toHaveLength(0);
    });
  });

  describe('Dosage Threshold Warnings', () => {
    it('warns when dosage exceeds 2000mg', () => {
      const items = [
        { medication: 'Metformin HCl', strength: '2500 mg' },
      ];
      const warnings = checkDrugWarnings(items);
      const dosageWarn = warnings.find(w => w.type === 'dosage');
      expect(dosageWarn).toBeDefined();
      expect(dosageWarn?.message).toContain('exceeds 2000mg');
    });

    it('warns when dosage in grams exceeds 2g', () => {
      const items = [
        { medication: 'Sucralfate', strength: '3 g' },
      ];
      const warnings = checkDrugWarnings(items);
      const dosageWarn = warnings.find(w => w.type === 'dosage');
      expect(dosageWarn).toBeDefined();
      expect(dosageWarn?.message).toContain('unusually high');
    });

    it('does not warn for normal therapeutic dosages', () => {
      const items = [
        { medication: 'Amoxicillin', strength: '500 mg' },
        { medication: 'Ibuprofen', strength: '400 mg' },
      ];
      const warnings = checkDrugWarnings(items);
      const dosageWarns = warnings.filter(w => w.type === 'dosage');
      expect(dosageWarns).toHaveLength(0);
    });
  });

  describe('Clinical Notes Allergy & Contraindication Scanner', () => {
    it('flags allergy warnings mentioned in clinical notes', () => {
      const items = [{ medication: 'Cephalexin', strength: '500 mg' }];
      const warnings = checkDrugWarnings(items, 'Patient has reported allergy to penicillin.');
      const allergyWarn = warnings.find(w => w.type === 'allergy' && w.severity === 'high');
      expect(allergyWarn).toBeDefined();
      expect(allergyWarn?.message).toContain('allergy');
    });

    it('flags contraindication warnings in clinical notes', () => {
      const items = [{ medication: 'Ketorolac', strength: '10 mg' }];
      const warnings = checkDrugWarnings(items, 'Caution: Patient has history of peptic ulcer disease.');
      const contraWarn = warnings.find(w => w.type === 'allergy' && w.severity === 'medium');
      expect(contraWarn).toBeDefined();
      expect(contraWarn?.message).toContain('caution');
    });

    it('sorts warnings with highest severity first (high -> medium -> low)', () => {
      const items = [
        { medication: 'Warfarin', strength: '5 mg' },
        { medication: 'Aspirin', strength: '81 mg' },
        { medication: 'Metformin', strength: '2500 mg' },
      ];
      const warnings = checkDrugWarnings(items, 'Caution advised.');
      expect(warnings.length).toBeGreaterThanOrEqual(3);
      expect(warnings[0].severity).toBe('high');
      expect(warnings[warnings.length - 1].severity).not.toBe('high');
    });
  });
});
