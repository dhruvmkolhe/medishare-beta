const fs = require('fs');
const path = require('path');

const newKeys = {
  dispensation: {
    markDispensed: "Mark as Dispensed",
    dispensedAt: "Dispensed at",
    dispensedOn: "Dispensed on",
    alreadyDispensed: "This credential has already been dispensed",
    confirmDispense: "Confirm that you are dispensing this prescription",
    pharmacyName: "Pharmacy name (optional)",
    success: "Prescription marked as dispensed"
  },
  search: {
    placeholder: "Search medications...",
    placeholderPatient: "Search by patient name...",
    allStatuses: "All statuses",
    clear: "Clear filters"
  },
  pagination: {
    showing: "Showing",
    of: "of",
    page: "Page",
    perPage: "per page"
  }
};

const newPrescriptionKeys = {
    addMedication: "Add Medication",
    removeMedication: "Remove",
    timing: "Timing",
    refills: "Refills",
    timingOptions: {
      morning: "Morning",
      afternoon: "Afternoon",
      evening: "Evening",
      bedtime: "Bedtime",
      beforeMeals: "Before meals",
      afterMeals: "After meals",
      withMeals: "With meals"
    },
    medicationNumber: "Medication #{{number}}",
    print: "Print / PDF"
};

const localesDir = path.join(__dirname, 'src', 'locales');
const locales = ['hi', 'gu', 'ar', 'fr'];

locales.forEach(loc => {
  const file = path.join(localesDir, loc, 'translation.json');
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    
    // Add missing top level
    Object.keys(newKeys).forEach(k => {
      if (!data[k]) data[k] = newKeys[k];
    });
    
    // Add missing prescription keys
    if (data.prescription) {
      Object.keys(newPrescriptionKeys).forEach(k => {
        if (!data.prescription[k]) data.prescription[k] = newPrescriptionKeys[k];
      });
    }
    
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    console.log(`Updated ${loc}`);
  }
});
