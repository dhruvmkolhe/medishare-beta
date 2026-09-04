import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

try {
  const dotenv = await import('dotenv');
  (dotenv.default || dotenv).config?.();
} catch {
  // Gracefully fallback to process.env if dotenv is unavailable
}

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB_NAME || 'medishare';
const KEK = process.env.KEY_ENCRYPTION_KEY || 'medishare-kek-32-chars-long!!';

function canonicalize(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  const sortedKeys = Object.keys(obj).sort();
  const result = {};
  for (const key of sortedKeys) {
    const value = obj[key];
    if (value === undefined) continue;
    if (typeof value === 'string') {
      result[key] = value.trim();
    } else if (typeof value === 'object' && value !== null) {
      result[key] = canonicalize(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function canonicalizeToString(obj) {
  const canonical = canonicalize(obj);
  return JSON.stringify(canonical, (key, value) => {
    if (value === undefined) return null;
    return value;
  });
}

function hashCanonical(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

function encryptPrivateKey(privateKeyPem) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(KEK.padEnd(32, '0').slice(0, 32)), iv);
  let encrypted = cipher.update(privateKeyPem, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');
  return { encrypted_private_key: encrypted, iv: iv.toString('base64'), auth_tag: authTag };
}

function signCredential(hash, privateKeyPem) {
  return crypto.sign(null, Buffer.from(hash, 'utf8'), privateKeyPem).toString('base64');
}

async function seed() {
  console.log(`Connecting to MongoDB at ${uri} (db: ${dbName})...`);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  console.log('Connected successfully.');

  console.log('Clearing existing demo collections...');
  const collections = [
    'users',
    'providers',
    'patients',
    'issuer_keys',
    'prescriptions',
    'prescription_items',
    'credentials',
    'revocations',
    'verification_events',
    'audit_logs'
  ];

  for (const col of collections) {
    await db.collection(col).deleteMany({});
  }

  console.log('Seeding 1+ Year (August 2025 - September 2026) Medical & Cryptographic Demo Data...');

  const passwordHash = await bcrypt.hash('password123', 10);
  const NOW = new Date('2026-09-03T10:00:00.000Z');
  const MS_DAY = 24 * 60 * 60 * 1000;

  function getDateDaysAgo(daysAgo) {
    return new Date(NOW.getTime() - daysAgo * MS_DAY);
  }

  // ==========================================
  // 1. USERS
  // ==========================================
  const userDocs = [
    // Admins
    { email: 'admin@medishare.com', role: 'ADMIN', name: 'System Administrator', daysAgo: 400 },
    { email: 'compliance@medishare.com', role: 'ADMIN', name: 'Chief Compliance Officer', daysAgo: 380 },
    // Providers
    { email: 'dr.sharma@medishare.com', role: 'PROVIDER', name: 'Dr. Rajesh Sharma, MD', license: 'MED-98241', daysAgo: 390 },
    { email: 'dr.chen@medishare.com', role: 'PROVIDER', name: 'Dr. Linda Chen, MD', license: 'MED-77103', daysAgo: 385 },
    { email: 'dr.patel@medishare.com', role: 'PROVIDER', name: 'Dr. Anita Patel, MD', license: 'MED-44219', daysAgo: 370 },
    { email: 'dr.williams@medishare.com', role: 'PROVIDER', name: 'Dr. James Williams, MD', license: 'MED-Pending-12', daysAgo: 5, pending: true },
    // Pharmacists
    { email: 'pharmacist@medishare.com', role: 'PHARMACIST', name: 'Alex Turner, RPh', pharmacy: 'Metro Central Pharmacy', daysAgo: 390 },
    { email: 'sarah.rx@citycare.com', role: 'PHARMACIST', name: 'Sarah Jenkins, PharmD', pharmacy: 'CityCare Chemist', daysAgo: 350 },
    // Patients
    { email: 'john.doe@medishare.com', role: 'PATIENT', name: 'John Doe', daysAgo: 390 },
    { email: 'emily.davis@medishare.com', role: 'PATIENT', name: 'Emily Davis', daysAgo: 380 },
    { email: 'priya.patel@medishare.com', role: 'PATIENT', name: 'Priya Patel', daysAgo: 360 },
    { email: 'michael.brown@medishare.com', role: 'PATIENT', name: 'Michael Brown', daysAgo: 340 },
    { email: 'sophia.rodriguez@medishare.com', role: 'PATIENT', name: 'Sophia Rodriguez', daysAgo: 300 },
    { email: 'david.kim@medishare.com', role: 'PATIENT', name: 'David Kim', daysAgo: 250 },
    { email: 'sarah.wilson@medishare.com', role: 'PATIENT', name: 'Sarah Wilson', daysAgo: 180 },
    { email: 'robert.taylor@medishare.com', role: 'PATIENT', name: 'Robert Taylor', daysAgo: 90 },
  ];

  const userMap = {};
  const auditLogs = [];

  for (const u of userDocs) {
    const createdAt = getDateDaysAgo(u.daysAgo).toISOString();
    const res = await db.collection('users').insertOne({
      email: u.email,
      password_hash: passwordHash,
      role: u.role,
      created_at: createdAt
    });
    const userId = res.insertedId.toString();
    userMap[u.email] = { id: userId, _id: res.insertedId, ...u };

    auditLogs.push({
      actor_id: userId,
      action: 'USER_REGISTERED',
      target_type: 'user',
      target_id: userId,
      metadata: { role: u.role, email: u.email },
      created_at: createdAt
    });
  }

  const adminUserId = userMap['admin@medishare.com'].id;

  // ==========================================
  // 2. PROVIDERS & KEYS
  // ==========================================
  const providerMap = {};
  const keyMap = {};

  for (const u of userDocs.filter(x => x.role === 'PROVIDER')) {
    const isPending = !!u.pending;
    const createdAt = getDateDaysAgo(u.daysAgo).toISOString();
    const approvedAt = isPending ? null : getDateDaysAgo(u.daysAgo - 1).toISOString();

    const provRes = await db.collection('providers').insertOne({
      user_id: userMap[u.email].id,
      name: u.name,
      license_number: u.license,
      approved_at: approvedAt,
      approved_by: isPending ? null : adminUserId,
      created_at: createdAt
    });

    const provId = provRes.insertedId.toString();
    providerMap[u.email] = { id: provId, _id: provRes.insertedId, ...u };

    if (!isPending) {
      const { privateKey, publicKey } = generateKeyPair();
      const encrypted = encryptPrivateKey(privateKey);

      const keyRes = await db.collection('issuer_keys').insertOne({
        provider_id: provId,
        public_key: publicKey,
        encrypted_private_key: encrypted.encrypted_private_key,
        iv: encrypted.iv,
        auth_tag: encrypted.auth_tag,
        is_active: true,
        created_at: approvedAt
      });

      keyMap[provId] = {
        id: keyRes.insertedId.toString(),
        _id: keyRes.insertedId,
        publicKey,
        privateKeyPem: privateKey
      };

      auditLogs.push({
        actor_id: adminUserId,
        action: 'PROVIDER_APPROVED',
        target_type: 'provider',
        target_id: provId,
        metadata: { license: u.license, provider_name: u.name },
        created_at: approvedAt
      });
    }
  }

  // ==========================================
  // 3. PATIENTS
  // ==========================================
  const patientMap = {};
  let patIdx = 1001;

  for (const u of userDocs.filter(x => x.role === 'PATIENT')) {
    const createdAt = getDateDaysAgo(u.daysAgo).toISOString();
    const patRef = `PAT-${patIdx++}`;
    const patRes = await db.collection('patients').insertOne({
      user_id: userMap[u.email].id,
      patient_reference: patRef,
      display_name: u.name,
      created_at: createdAt
    });

    patientMap[u.email] = {
      id: patRes.insertedId.toString(),
      _id: patRes.insertedId,
      patient_reference: patRef,
      display_name: u.name,
      ...u
    };
  }

  // ==========================================
  // 4. PRESCRIPTIONS & CREDENTIALS ACROSS 1 YEAR
  // ==========================================
  const prescriptionData = [
    // Month 1 (380 days ago - Aug 2025)
    {
      daysAgo: 380,
      providerEmail: 'dr.sharma@medishare.com',
      patientEmail: 'john.doe@medishare.com',
      notes: 'Initial evaluation for essential hypertension. Low sodium diet advised.',
      status: 'EXPIRED',
      validDays: 30,
      items: [
        { medication: 'Amlodipine Besylate', strength: '5 mg', dosage: '1 tablet daily in the morning', duration: '30 days', timing: 'Morning', refills: 0 }
      ]
    },
    {
      daysAgo: 375,
      providerEmail: 'dr.chen@medishare.com',
      patientEmail: 'emily.davis@medishare.com',
      notes: 'Acute bacterial pharyngitis. Take full course.',
      status: 'DISPENSED',
      validDays: 14,
      items: [
        { medication: 'Amoxicillin', strength: '500 mg', dosage: '1 capsule 3 times daily with meals', duration: '10 days', timing: '3x daily', refills: 0 }
      ],
      dispensedDaysAfter: 1,
      pharmacy: 'Metro Central Pharmacy'
    },

    // Month 2 (350 days ago - Sep 2025)
    {
      daysAgo: 350,
      providerEmail: 'dr.patel@medishare.com',
      patientEmail: 'michael.brown@medishare.com',
      notes: 'Type 2 diabetes management. Routine HbA1c check in 3 months.',
      status: 'DISPENSED',
      validDays: 90,
      items: [
        { medication: 'Metformin HCl', strength: '500 mg', dosage: '1 tablet twice daily with breakfast and dinner', duration: '90 days', timing: 'Twice daily', refills: 1 }
      ],
      dispensedDaysAfter: 2,
      pharmacy: 'CityCare Chemist'
    },
    {
      daysAgo: 345,
      providerEmail: 'dr.sharma@medishare.com',
      patientEmail: 'priya.patel@medishare.com',
      notes: 'Mild dyslipidemia. Repeat fasting lipid panel in 6 months.',
      status: 'EXPIRED',
      validDays: 60,
      items: [
        { medication: 'Atorvastatin', strength: '10 mg', dosage: '1 tablet nightly at bedtime', duration: '60 days', timing: 'Bedtime', refills: 0 }
      ]
    },

    // Month 3 (320 days ago - Oct 2025)
    {
      daysAgo: 320,
      providerEmail: 'dr.chen@medishare.com',
      patientEmail: 'sophia.rodriguez@medishare.com',
      notes: 'Seasonal allergic rhinitis with nasal congestion.',
      status: 'DISPENSED',
      validDays: 30,
      items: [
        { medication: 'Cetirizine HCl', strength: '10 mg', dosage: '1 tablet once daily in the evening', duration: '30 days', timing: 'Evening', refills: 2 },
        { medication: 'Fluticasone Propionate', strength: '50 mcg/spray', dosage: '2 sprays in each nostril once daily', duration: '30 days', timing: 'Morning', refills: 1 }
      ],
      dispensedDaysAfter: 1,
      pharmacy: 'Metro Central Pharmacy'
    },
    {
      daysAgo: 315,
      providerEmail: 'dr.sharma@medishare.com',
      patientEmail: 'john.doe@medishare.com',
      notes: 'Controlled analgesic order. Cancelled following suspected mild reaction.',
      status: 'REVOKED',
      revocationReason: 'Patient reported dizziness and mild hives. Discontinued immediately.',
      validDays: 14,
      items: [
        { medication: 'Codeine Sulfate', strength: '30 mg', dosage: '1 tablet every 6 hours as needed for severe pain', duration: '5 days', timing: 'As needed', refills: 0 }
      ]
    },

    // Month 4 (290 days ago - Nov 2025)
    {
      daysAgo: 290,
      providerEmail: 'dr.patel@medishare.com',
      patientEmail: 'david.kim@medishare.com',
      notes: 'Hypothyroidism maintenance therapy.',
      status: 'DISPENSED',
      validDays: 90,
      items: [
        { medication: 'Levothyroxine Sodium', strength: '75 mcg', dosage: '1 tablet daily 30 minutes before breakfast with full glass of water', duration: '90 days', timing: 'Morning empty stomach', refills: 2 }
      ],
      dispensedDaysAfter: 3,
      pharmacy: 'CityCare Chemist'
    },
    {
      daysAgo: 280,
      providerEmail: 'dr.chen@medishare.com',
      patientEmail: 'michael.brown@medishare.com',
      notes: 'Acute bronchitis. Hydration and rest emphasized.',
      status: 'EXPIRED',
      validDays: 14,
      items: [
        { medication: 'Azithromycin', strength: '250 mg', dosage: '500 mg Day 1, then 250 mg daily Days 2-5', duration: '5 days', timing: 'Daily', refills: 0 }
      ]
    },

    // Month 5 (255 days ago - Dec 2025)
    {
      daysAgo: 255,
      providerEmail: 'dr.sharma@medishare.com',
      patientEmail: 'emily.davis@medishare.com',
      notes: 'Post-viral bronchial hypersensitivity.',
      status: 'DISPENSED',
      validDays: 60,
      items: [
        { medication: 'Albuterol Sulfate Inhaler', strength: '90 mcg/actuation', dosage: '2 puffs every 4-6 hours as needed for wheezing', duration: '30 days', timing: 'PRN', refills: 1 }
      ],
      dispensedDaysAfter: 1,
      pharmacy: 'Metro Central Pharmacy'
    },

    // Month 6 (225 days ago - Jan 2026)
    {
      daysAgo: 225,
      providerEmail: 'dr.patel@medishare.com',
      patientEmail: 'priya.patel@medishare.com',
      notes: 'Gastroesophageal reflux disease (GERD) with frequent heartburn.',
      status: 'DISPENSED',
      validDays: 60,
      items: [
        { medication: 'Pantoprazole Sodium', strength: '40 mg', dosage: '1 tablet daily 30 minutes before breakfast', duration: '60 days', timing: 'Morning', refills: 1 }
      ],
      dispensedDaysAfter: 2,
      pharmacy: 'CityCare Chemist'
    },
    {
      daysAgo: 220,
      providerEmail: 'dr.chen@medishare.com',
      patientEmail: 'john.doe@medishare.com',
      notes: 'Duplicate EMR entry issued during clinic software upgrade.',
      status: 'REVOKED',
      revocationReason: 'Duplicate entry detected and revoked by physician.',
      validDays: 30,
      items: [
        { medication: 'Lisinopril', strength: '20 mg', dosage: '1 tablet daily in morning', duration: '30 days', timing: 'Morning', refills: 0 }
      ]
    },

    // Month 7 (195 days ago - Feb 2026)
    {
      daysAgo: 195,
      providerEmail: 'dr.sharma@medishare.com',
      patientEmail: 'sophia.rodriguez@medishare.com',
      notes: 'Persistent tension headaches. Non-pharmacological relaxation advised.',
      status: 'EXPIRED',
      validDays: 30,
      items: [
        { medication: 'Acetaminophen / Caffeine', strength: '500/65 mg', dosage: '1 tablet every 6 hours as needed', duration: '7 days', timing: 'As needed', refills: 0 }
      ]
    },

    // Month 8 (165 days ago - Mar 2026)
    {
      daysAgo: 165,
      providerEmail: 'dr.patel@medishare.com',
      patientEmail: 'michael.brown@medishare.com',
      notes: 'Combined dual-therapy for Glycemic & Cardiovascular control.',
      status: 'DISPENSED',
      validDays: 90,
      items: [
        { medication: 'Metformin HCl ER', strength: '1000 mg', dosage: '1 tablet once daily with evening meal', duration: '90 days', timing: 'Evening', refills: 2 },
        { medication: 'Empagliflozin', strength: '10 mg', dosage: '1 tablet once daily in the morning', duration: '90 days', timing: 'Morning', refills: 2 }
      ],
      dispensedDaysAfter: 1,
      pharmacy: 'Metro Central Pharmacy'
    },

    // Month 9 (135 days ago - Apr 2026)
    {
      daysAgo: 135,
      providerEmail: 'dr.chen@medishare.com',
      patientEmail: 'david.kim@medishare.com',
      notes: 'Joint pain and acute lumbar strain following gardening.',
      status: 'DISPENSED',
      validDays: 30,
      items: [
        { medication: 'Meloxicam', strength: '15 mg', dosage: '1 tablet once daily with food', duration: '14 days', timing: 'Once daily', refills: 0 }
      ],
      dispensedDaysAfter: 1,
      pharmacy: 'CityCare Chemist'
    },

    // Month 10 (105 days ago - May 2026)
    {
      daysAgo: 105,
      providerEmail: 'dr.sharma@medishare.com',
      patientEmail: 'sarah.wilson@medishare.com',
      notes: 'Stage 1 Hypertension & Tachycardia.',
      status: 'DISPENSED',
      validDays: 90,
      items: [
        { medication: 'Metoprolol Succinate ER', strength: '50 mg', dosage: '1 tablet once daily in the morning', duration: '90 days', timing: 'Morning', refills: 1 },
        { medication: 'Lisinopril', strength: '10 mg', dosage: '1 tablet once daily in the morning', duration: '90 days', timing: 'Morning', refills: 1 }
      ],
      dispensedDaysAfter: 2,
      pharmacy: 'Metro Central Pharmacy'
    },

    // Month 11 (75 days ago - Jun 2026)
    {
      daysAgo: 75,
      providerEmail: 'dr.patel@medishare.com',
      patientEmail: 'emily.davis@medishare.com',
      notes: 'Iron deficiency anemia maintenance.',
      status: 'ACTIVE',
      validDays: 90,
      items: [
        { medication: 'Ferrous Sulfate', strength: '325 mg', dosage: '1 tablet daily with vitamin C on empty stomach', duration: '60 days', timing: 'Morning', refills: 2 }
      ],
      dispensations: [
        { daysAfter: 2, pharmacy: 'CityCare Chemist', notes: 'First fill 60-day bottle supplied' }
      ]
    },
    {
      daysAgo: 70,
      providerEmail: 'dr.chen@medishare.com',
      patientEmail: 'robert.taylor@medishare.com',
      notes: 'Acute uncomplicated bacterial sinusitis.',
      status: 'EXPIRED',
      validDays: 14,
      items: [
        { medication: 'Augmentin (Amoxicillin/Clavulanate)', strength: '875/125 mg', dosage: '1 tablet every 12 hours with meal', duration: '10 days', timing: 'Twice daily', refills: 0 }
      ]
    },

    // Month 12 (45 days ago - Jul 2026)
    {
      daysAgo: 45,
      providerEmail: 'dr.sharma@medishare.com',
      patientEmail: 'john.doe@medishare.com',
      notes: 'Long-term cardiovascular prophylaxis and cholesterol control.',
      status: 'ACTIVE',
      validDays: 90,
      items: [
        { medication: 'Rosuvastatin Calcium', strength: '20 mg', dosage: '1 tablet once daily in the evening', duration: '90 days', timing: 'Evening', refills: 3 },
        { medication: 'Aspirin (Enteric Coated)', strength: '81 mg', dosage: '1 tablet once daily in the morning', duration: '90 days', timing: 'Morning', refills: 3 }
      ],
      dispensations: [
        { daysAfter: 3, pharmacy: 'Metro Central Pharmacy', notes: 'Initial 90-day fill dispensed' }
      ]
    },
    {
      daysAgo: 40,
      providerEmail: 'dr.patel@medishare.com',
      patientEmail: 'priya.patel@medishare.com',
      notes: 'Patient changed primary provider; replaced by specialist care plan.',
      status: 'REVOKED',
      revocationReason: 'Superseded by specialist endocrinology care plan.',
      validDays: 60,
      items: [
        { medication: 'Glimepiride', strength: '2 mg', dosage: '1 tablet daily with breakfast', duration: '30 days', timing: 'Morning', refills: 1 }
      ]
    },

    // Month 13 (20 days ago - Aug 2026)
    {
      daysAgo: 20,
      providerEmail: 'dr.chen@medishare.com',
      patientEmail: 'sophia.rodriguez@medishare.com',
      notes: 'Migraine prophylaxis and acute attack management.',
      status: 'ACTIVE',
      validDays: 60,
      items: [
        { medication: 'Sumatriptan Succinate', strength: '50 mg', dosage: '1 tablet at onset of migraine headache; may repeat after 2 hours if needed (max 200mg/24h)', duration: '30 days', timing: 'PRN', refills: 2 }
      ],
      dispensations: [
        { daysAfter: 1, pharmacy: 'CityCare Chemist', notes: 'Fill 1 dispensed (9 tablets pack)' }
      ]
    },
    {
      daysAgo: 15,
      providerEmail: 'dr.sharma@medishare.com',
      patientEmail: 'michael.brown@medishare.com',
      notes: 'Atrial fibrillation anti-coagulation therapy. Monitor INR closely.',
      status: 'ACTIVE',
      validDays: 45,
      items: [
        { medication: 'Warfarin Sodium', strength: '5 mg', dosage: '1 tablet daily in the evening as per INR titration table', duration: '30 days', timing: 'Evening', refills: 1 }
      ]
    },

    // Month 14 (Current Period - Late Aug / Sep 2026)
    // 1. Benchmark Credential with Preserved UUID: c9c52004-6fb3-4654-8fbd-2bd360802816
    {
      daysAgo: 4,
      customUUID: 'c9c52004-6fb3-4654-8fbd-2bd360802816',
      providerEmail: 'dr.sharma@medishare.com',
      patientEmail: 'john.doe@medishare.com',
      notes: 'Benchmark test sample. Cardiovascular triple-therapy regimen.',
      status: 'ACTIVE',
      validDays: 60,
      items: [
        { medication: 'Atorvastatin Calcium', strength: '40 mg', dosage: '1 tablet once daily at bedtime', duration: '60 days', timing: 'Bedtime', refills: 2 },
        { medication: 'Lisinopril', strength: '20 mg', dosage: '1 tablet once daily in the morning', duration: '60 days', timing: 'Morning', refills: 2 },
        { medication: 'Amlodipine', strength: '10 mg', dosage: '1 tablet once daily in the morning', duration: '60 days', timing: 'Morning', refills: 2 }
      ]
    },
    // 2. Multi-Med Fresh Prescription
    {
      daysAgo: 2,
      providerEmail: 'dr.chen@medishare.com',
      patientEmail: 'emily.davis@medishare.com',
      notes: 'Upper respiratory infection with acute bronchial spasm. Hydration advised.',
      status: 'ACTIVE',
      validDays: 30,
      items: [
        { medication: 'Azithromycin', strength: '250 mg', dosage: '2 tablets on Day 1, then 1 tablet daily on Days 2-5', duration: '5 days', timing: 'Morning with food', refills: 0 },
        { medication: 'Albuterol Sulfate HFA Inhaler', strength: '90 mcg/actuation', dosage: '1 to 2 inhalations every 4 to 6 hours as needed for wheezing', duration: '30 days', timing: 'PRN', refills: 1 },
        { medication: 'Benzonatate', strength: '100 mg', dosage: '1 capsule 3 times daily as needed for persistent dry cough', duration: '7 days', timing: 'After meals', refills: 0 }
      ]
    },
    // 3. Potential Interaction Demo (Warfarin + Aspirin)
    {
      daysAgo: 1,
      providerEmail: 'dr.sharma@medishare.com',
      patientEmail: 'david.kim@medishare.com',
      notes: 'High-risk cardiovascular patient. Caution: Patient on anticoagulant.',
      status: 'ACTIVE',
      validDays: 30,
      items: [
        { medication: 'Warfarin', strength: '2.5 mg', dosage: '1 tablet daily at 6 PM', duration: '30 days', timing: 'Evening', refills: 1 },
        { medication: 'Aspirin', strength: '81 mg', dosage: '1 tablet daily with food', duration: '30 days', timing: 'Morning', refills: 0 }
      ]
    },
    // 4. Fresh Acute Care
    {
      daysAgo: 0,
      providerEmail: 'dr.patel@medishare.com',
      patientEmail: 'priya.patel@medishare.com',
      notes: 'Acute odontogenic infection post-extraction.',
      status: 'ACTIVE',
      validDays: 14,
      items: [
        { medication: 'Amoxicillin / Clavulanate', strength: '875/125 mg', dosage: '1 tablet twice daily with meals', duration: '7 days', timing: 'Twice daily', refills: 0 },
        { medication: 'Ibuprofen', strength: '600 mg', dosage: '1 tablet every 6-8 hours with food as needed for pain', duration: '5 days', timing: 'PRN with food', refills: 0 }
      ]
    },
    // 5. Pediatric / Allergy Fresh
    {
      daysAgo: 0,
      providerEmail: 'dr.chen@medishare.com',
      patientEmail: 'robert.taylor@medishare.com',
      notes: 'Seasonal flare-up of chronic eczema & allergic conjunctivitis.',
      status: 'ACTIVE',
      validDays: 45,
      items: [
        { medication: 'Levocetirizine Dihydrochloride', strength: '5 mg', dosage: '1 tablet once daily in the evening', duration: '30 days', timing: 'Evening', refills: 1 },
        { medication: 'Hydrocortisone Cream', strength: '2.5%', dosage: 'Apply thin layer to affected skin twice daily', duration: '14 days', timing: 'Morning and night', refills: 1 }
      ]
    }
  ];

  console.log(`Inserting ${prescriptionData.length} multi-medication prescriptions and issuing cryptographic credentials...`);

  const createdCredentials = [];

  for (const item of prescriptionData) {
    const provider = providerMap[item.providerEmail];
    const patient = patientMap[item.patientEmail];
    const key = keyMap[provider.id];

    if (!provider || !patient || !key) {
      console.warn('Skipping prescription, missing provider/patient/key:', item.providerEmail);
      continue;
    }

    const issuedDate = getDateDaysAgo(item.daysAgo);
    const expiresDate = new Date(issuedDate.getTime() + item.validDays * MS_DAY);

    const firstItem = item.items[0];

    const formattedItems = item.items.map((it, idx) => ({
      medication: it.medication,
      strength: it.strength,
      dosage: it.dosage,
      duration: it.duration,
      timing: it.timing || '',
      refills: it.refills || 0,
      sort_order: idx
    }));

    // Insert prescription
    const presDoc = {
      provider_id: provider.id,
      patient_id: patient.id,
      medication: firstItem.medication,
      strength: firstItem.strength,
      dosage: firstItem.dosage,
      duration: firstItem.duration,
      notes: item.notes || '',
      items: formattedItems,
      created_at: issuedDate
    };

    const presRes = await db.collection('prescriptions').insertOne(presDoc);
    const presId = presRes.insertedId.toString();

    // Also populate prescription_items collection for legacy/backward compatibility
    for (const fit of formattedItems) {
      await db.collection('prescription_items').insertOne({
        prescription_id: presId,
        ...fit
      });
    }

    // Build Canonical Credential Data exactly as api/credentials/[...path].js and api/verify/[...path].js expect
    const credentialDataObj = {
      items: formattedItems.map(i => ({
        dosage: i.dosage,
        duration: i.duration,
        medication: i.medication,
        strength: i.strength
      })),
      notes: item.notes || ''
    };

    const canonical = canonicalizeToString(credentialDataObj);
    const contentHash = hashCanonical(canonical);
    const signature = signCredential(contentHash, key.privateKeyPem);

    const credentialId = item.customUUID || crypto.randomUUID();

    const maxRefills = Math.max(...formattedItems.map(i => i.refills || 0));
    const maxDispensations = 1 + maxRefills;

    // Dispensations list
    const embeddedDispensations = [];

    if (item.status === 'DISPENSED') {
      // Create dispensations up to maxDispensations
      for (let d = 0; d < maxDispensations; d++) {
        const dispDaysAfter = (item.dispensedDaysAfter || 1) + d * 30;
        const dispDate = new Date(issuedDate.getTime() + dispDaysAfter * MS_DAY);
        const pharmacy = item.pharmacy || 'Metro Central Pharmacy';
        embeddedDispensations.push({
          dispensed_by: userMap['pharmacist@medishare.com'].id,
          pharmacy_name: pharmacy,
          notes: d === 0 ? 'Initial supply dispensed' : `Refill #${d} dispensed`,
          dispensed_at: dispDate.toISOString()
        });

        auditLogs.push({
          actor_id: userMap['pharmacist@medishare.com'].id,
          action: 'CREDENTIAL_DISPENSED',
          target_type: 'credential',
          target_id: credentialId,
          metadata: { pharmacy_name: pharmacy, fill_number: d + 1, total_fills: maxDispensations },
          created_at: dispDate.toISOString()
        });
      }
    } else if (item.dispensations && item.dispensations.length > 0) {
      for (let d = 0; d < item.dispensations.length; d++) {
        const spec = item.dispensations[d];
        const dispDate = new Date(issuedDate.getTime() + spec.daysAfter * MS_DAY);
        embeddedDispensations.push({
          dispensed_by: userMap['pharmacist@medishare.com'].id,
          pharmacy_name: spec.pharmacy || 'CityCare Chemist',
          notes: spec.notes || `Fill #${d + 1} dispensed`,
          dispensed_at: dispDate.toISOString()
        });

        auditLogs.push({
          actor_id: userMap['pharmacist@medishare.com'].id,
          action: 'CREDENTIAL_DISPENSED',
          target_type: 'credential',
          target_id: credentialId,
          metadata: { pharmacy_name: spec.pharmacy, fill_number: d + 1, total_fills: maxDispensations },
          created_at: dispDate.toISOString()
        });
      }
    }

    const credDoc = {
      credential_id: credentialId,
      prescription_id: presId,
      issuer_key_id: key.id,
      content_hash: contentHash,
      signature,
      issued_at: issuedDate.toISOString(),
      expires_at: expiresDate.toISOString(),
      status: item.status,
      max_dispensations: maxDispensations,
      dispensations: embeddedDispensations,
      pickup_pin: '839214',
      created_at: issuedDate
    };

    const credRes = await db.collection('credentials').insertOne(credDoc);
    const credDbId = credRes.insertedId.toString();

    createdCredentials.push({ ...credDoc, _id: credRes.insertedId, id: credDbId });

    // Handle Revocations
    if (item.status === 'REVOKED') {
      const revokedDate = new Date(issuedDate.getTime() + 2 * MS_DAY).toISOString();
      await db.collection('revocations').insertOne({
        credential_id: credDbId,
        revoked_by: userMap[item.providerEmail].id,
        reason: item.revocationReason || 'Provider requested revocation',
        revoked_at: revokedDate
      });

      auditLogs.push({
        actor_id: userMap[item.providerEmail].id,
        action: 'CREDENTIAL_REVOKED',
        target_type: 'credential',
        target_id: credDbId,
        metadata: { reason: item.revocationReason, credential_id: credentialId },
        created_at: revokedDate
      });
    }

    // Prescription & Credential audit logs
    auditLogs.push({
      actor_id: userMap[item.providerEmail].id,
      action: 'PRESCRIPTION_CREATED',
      target_type: 'prescription',
      target_id: presId,
      metadata: { medication: firstItem.medication, patient_id: patient.id },
      created_at: issuedDate.toISOString()
    });

    auditLogs.push({
      actor_id: userMap[item.providerEmail].id,
      action: 'CREDENTIAL_ISSUED',
      target_type: 'credential',
      target_id: credDbId,
      metadata: { credential_id: credentialId, hash: contentHash, status: item.status },
      created_at: issuedDate.toISOString()
    });
  }

  // ==========================================
  // 5. VERIFICATION EVENTS ACROSS 1 YEAR
  // ==========================================
  console.log('Generating realistic verification audit events...');
  const verificationEvents = [];

  for (const cred of createdCredentials) {
    // Recent and dispensed credentials had verifications
    const isOld = new Date(cred.issued_at).getTime() < NOW.getTime() - 100 * MS_DAY;
    const numChecks = isOld ? 1 : 2;

    for (let c = 0; c < numChecks; c++) {
      const issuedTime = new Date(cred.issued_at).getTime();
      const verifyTime = new Date(issuedTime + (c + 1) * MS_DAY * 2);
      if (verifyTime > NOW) continue;

      const isRevoked = cred.status === 'REVOKED';
      const isExpired = cred.status === 'EXPIRED' && verifyTime > new Date(cred.expires_at);

      const pass = !isRevoked && !isExpired;
      const failureReason = isRevoked ? 'Credential Revoked' : (isExpired ? 'Credential Expired' : null);

      verificationEvents.push({
        credential_id: cred._id.toString(),
        result: pass ? 'PASS' : 'FAIL',
        failure_reason: failureReason,
        verified_at: verifyTime.toISOString(),
        session_nonce: crypto.randomBytes(16).toString('hex')
      });

      auditLogs.push({
        actor_id: userMap['pharmacist@medishare.com'].id,
        action: 'VERIFICATION_ATTEMPTED',
        target_type: 'credential',
        target_id: cred._id.toString(),
        metadata: { result: pass ? 'PASS' : 'FAIL', failure_reason: failureReason, credential_id: cred.credential_id },
        created_at: verifyTime.toISOString()
      });
    }
  }

  if (verificationEvents.length > 0) {
    await db.collection('verification_events').insertMany(verificationEvents);
  }

  // ==========================================
  // 6. INSERT SORTED AUDIT LOGS
  // ==========================================
  auditLogs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (auditLogs.length > 0) {
    await db.collection('audit_logs').insertMany(auditLogs);
  }

  // Summary counts
  const userCount = await db.collection('users').countDocuments();
  const providerCount = await db.collection('providers').countDocuments();
  const patientCount = await db.collection('patients').countDocuments();
  const prescriptionCount = await db.collection('prescriptions').countDocuments();
  console.log('Ensuring all database indexes...');
  const { createIndexes } = await import('./setup-indexes.js');
  await createIndexes(db);

  const credentialCount = await db.collection('credentials').countDocuments();
  const verificationCount = await db.collection('verification_events').countDocuments();
  const auditCount = await db.collection('audit_logs').countDocuments();

  await client.close();

  console.log('\n=============================================================');
  console.log('🎉 1-YEAR MONGODB DEMO DATA SEEDED SUCCESSFULLY!');
  console.log('=============================================================');
  console.log(`👥 Users:                 ${userCount}`);
  console.log(`🩺 Providers:             ${providerCount} (3 approved, 1 pending approval)`);
  console.log(`🧑 Patients:              ${patientCount}`);
  console.log(`📋 Prescriptions:         ${prescriptionCount}`);
  console.log(`🔐 Signed Credentials:    ${credentialCount}`);
  console.log(`🔍 Verification Events:   ${verificationCount}`);
  console.log(`📜 Audit Logs:            ${auditCount} (spanning Aug 2025 - Sep 2026)`);
  console.log('=============================================================');
  console.log('🔑 DEMO LOGIN CREDENTIALS (All passwords: password123):');
  console.log('-------------------------------------------------------------');
  console.log('👑 Admin:                 admin@medishare.com');
  console.log('👨‍⚕️ Provider (Doctor):    dr.sharma@medishare.com (or dr.chen@medishare.com)');
  console.log('💊 Pharmacist:            pharmacist@medishare.com (or sarah.rx@citycare.com)');
  console.log('🧑 Patient:               john.doe@medishare.com (or emily.davis@medishare.com)');
  console.log('-------------------------------------------------------------');
  console.log('📌 Benchmark Sample UUID: c9c52004-6fb3-4654-8fbd-2bd360802816');
  console.log('🔐 Demo Patient Pickup PIN: 839214');
  console.log('=============================================================\n');
}

seed().catch(err => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});
