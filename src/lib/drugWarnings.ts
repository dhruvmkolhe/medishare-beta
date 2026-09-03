export interface DrugWarning {
  type: 'interaction' | 'dosage' | 'allergy';
  severity: 'high' | 'medium' | 'low';
  message: string;
}

interface DrugInteraction {
  drugA: string;
  drugB: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

const INTERACTIONS: DrugInteraction[] = [
  // High severity
  { drugA: 'warfarin', drugB: 'aspirin', severity: 'high', message: 'Warfarin + Aspirin: Significantly increased bleeding risk' },
  { drugA: 'warfarin', drugB: 'ibuprofen', severity: 'high', message: 'Warfarin + Ibuprofen: Increased risk of GI bleeding' },
  { drugA: 'warfarin', drugB: 'naproxen', severity: 'high', message: 'Warfarin + Naproxen: Increased bleeding risk' },
  { drugA: 'methotrexate', drugB: 'trimethoprim', severity: 'high', message: 'Methotrexate + Trimethoprim: Risk of bone marrow suppression' },
  { drugA: 'lithium', drugB: 'ibuprofen', severity: 'high', message: 'Lithium + Ibuprofen: Increased lithium toxicity risk' },
  { drugA: 'lithium', drugB: 'naproxen', severity: 'high', message: 'Lithium + Naproxen: Increased lithium toxicity risk' },
  { drugA: 'maoi', drugB: 'ssri', severity: 'high', message: 'MAOI + SSRI: Risk of serotonin syndrome (potentially fatal)' },
  { drugA: 'fluoxetine', drugB: 'phenelzine', severity: 'high', message: 'Fluoxetine + Phenelzine: Serotonin syndrome risk' },
  { drugA: 'sertraline', drugB: 'phenelzine', severity: 'high', message: 'Sertraline + Phenelzine: Serotonin syndrome risk' },
  { drugA: 'digoxin', drugB: 'amiodarone', severity: 'high', message: 'Digoxin + Amiodarone: Risk of digoxin toxicity' },
  { drugA: 'simvastatin', drugB: 'clarithromycin', severity: 'high', message: 'Simvastatin + Clarithromycin: Risk of rhabdomyolysis' },
  { drugA: 'sildenafil', drugB: 'nitroglycerin', severity: 'high', message: 'Sildenafil + Nitrates: Severe hypotension risk' },
  // Medium severity
  { drugA: 'metformin', drugB: 'alcohol', severity: 'medium', message: 'Metformin + Alcohol: Increased risk of lactic acidosis' },
  { drugA: 'ace inhibitor', drugB: 'potassium', severity: 'medium', message: 'ACE Inhibitor + Potassium: Risk of hyperkalemia' },
  { drugA: 'lisinopril', drugB: 'potassium', severity: 'medium', message: 'Lisinopril + Potassium: Risk of hyperkalemia' },
  { drugA: 'enalapril', drugB: 'potassium', severity: 'medium', message: 'Enalapril + Potassium: Risk of hyperkalemia' },
  { drugA: 'ciprofloxacin', drugB: 'antacid', severity: 'medium', message: 'Ciprofloxacin + Antacids: Reduced antibiotic absorption' },
  { drugA: 'tetracycline', drugB: 'calcium', severity: 'medium', message: 'Tetracycline + Calcium: Reduced antibiotic absorption' },
  { drugA: 'metronidazole', drugB: 'alcohol', severity: 'medium', message: 'Metronidazole + Alcohol: Severe nausea and vomiting (disulfiram reaction)' },
  { drugA: 'clopidogrel', drugB: 'omeprazole', severity: 'medium', message: 'Clopidogrel + Omeprazole: Reduced antiplatelet effect' },
  { drugA: 'theophylline', drugB: 'ciprofloxacin', severity: 'medium', message: 'Theophylline + Ciprofloxacin: Increased theophylline levels' },
  { drugA: 'carbamazepine', drugB: 'erythromycin', severity: 'medium', message: 'Carbamazepine + Erythromycin: Increased carbamazepine levels' },
  // Low severity
  { drugA: 'aspirin', drugB: 'ibuprofen', severity: 'low', message: 'Aspirin + Ibuprofen: May reduce aspirin\'s cardioprotective effect' },
  { drugA: 'amoxicillin', drugB: 'methotrexate', severity: 'low', message: 'Amoxicillin + Methotrexate: May increase methotrexate levels' },
  { drugA: 'prednisone', drugB: 'nsaid', severity: 'low', message: 'Prednisone + NSAIDs: Increased GI ulcer risk' },
  { drugA: 'levothyroxine', drugB: 'calcium', severity: 'low', message: 'Levothyroxine + Calcium: Reduced thyroid hormone absorption (take 4h apart)' },
  { drugA: 'levothyroxine', drugB: 'iron', severity: 'low', message: 'Levothyroxine + Iron: Reduced absorption (take 4h apart)' },
];

const NSAIDS = ['ibuprofen', 'naproxen', 'diclofenac', 'celecoxib', 'aspirin', 'indomethacin'];
const SSRIS = ['fluoxetine', 'sertraline', 'paroxetine', 'citalopram', 'escitalopram', 'fluvoxamine'];
const MAOIS = ['phenelzine', 'tranylcypromine', 'isocarboxazid', 'selegiline'];
const ACE_INHIBITORS = ['lisinopril', 'enalapril', 'ramipril', 'captopril', 'benazepril', 'fosinopril'];

function normalize(name: string): string[] {
  const lower = name.toLowerCase().trim();
  const terms = [lower];
  if (NSAIDS.includes(lower)) terms.push('nsaid');
  if (SSRIS.includes(lower)) terms.push('ssri');
  if (MAOIS.includes(lower)) terms.push('maoi');
  if (ACE_INHIBITORS.includes(lower)) terms.push('ace inhibitor');
  return terms;
}

function checkInteractions(medications: string[]): DrugWarning[] {
  const warnings: DrugWarning[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < medications.length; i++) {
    const termsA = normalize(medications[i]);
    for (let j = i + 1; j < medications.length; j++) {
      const termsB = normalize(medications[j]);
      for (const interaction of INTERACTIONS) {
        const matchAB = termsA.some(a => a.includes(interaction.drugA)) && termsB.some(b => b.includes(interaction.drugB));
        const matchBA = termsA.some(a => a.includes(interaction.drugB)) && termsB.some(b => b.includes(interaction.drugA));
        if (matchAB || matchBA) {
          const key = `${interaction.drugA}-${interaction.drugB}`;
          if (!seen.has(key)) {
            seen.add(key);
            warnings.push({ type: 'interaction', severity: interaction.severity, message: interaction.message });
          }
        }
      }
    }
  }
  return warnings;
}

function checkDosage(items: { medication: string; strength: string }[]): DrugWarning[] {
  const warnings: DrugWarning[] = [];
  for (const item of items) {
    const match = item.strength.match(/(\d+(?:\.\d+)?)\s*(mg|g|mcg|ml)/i);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      if (unit === 'g' && value > 2) {
        warnings.push({ type: 'dosage', severity: 'medium', message: `${item.medication}: Strength of ${item.strength} is unusually high. Please verify.` });
      }
      if (unit === 'mg' && value > 2000) {
        warnings.push({ type: 'dosage', severity: 'medium', message: `${item.medication}: Strength of ${item.strength} exceeds 2000mg. Please verify.` });
      }
    }
  }
  return warnings;
}

function checkNotes(notes: string): DrugWarning[] {
  const warnings: DrugWarning[] = [];
  const lower = notes.toLowerCase();
  const allergyKeywords = ['allergy', 'allergic', 'anaphylaxis', 'hypersensitivity'];
  const contraindicationKeywords = ['contraindicated', 'avoid', 'do not use', 'caution'];

  for (const kw of allergyKeywords) {
    if (lower.includes(kw)) {
      warnings.push({ type: 'allergy', severity: 'high', message: `Notes mention "${kw}" — verify patient allergy information before dispensing.` });
      break;
    }
  }
  for (const kw of contraindicationKeywords) {
    if (lower.includes(kw)) {
      warnings.push({ type: 'allergy', severity: 'medium', message: `Notes mention "${kw}" — review notes carefully before dispensing.` });
      break;
    }
  }
  return warnings;
}

export function checkDrugWarnings(
  items: { medication: string; strength: string }[],
  notes: string = ''
): DrugWarning[] {
  const medications = items.map(i => i.medication).filter(Boolean);
  return [
    ...checkInteractions(medications),
    ...checkDosage(items),
    ...checkNotes(notes),
  ].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
}
