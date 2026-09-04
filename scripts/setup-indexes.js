import { MongoClient } from 'mongodb';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore if custom DNS cannot be set
}

try {
  const dotenv = await import('dotenv');
  (dotenv.default || dotenv).config?.();
} catch {
  // Gracefully fallback to process.env if dotenv is unavailable
}

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB_NAME || 'medishare';

export async function createIndexes(db) {
  console.log('⚡ Ensuring MongoDB indexes on database:', db.databaseName);

  const indexDefinitions = [
    // 1. Unique Indexes
    {
      collection: 'users',
      spec: { email: 1 },
      options: { unique: true, name: 'uniq_user_email' },
      purpose: 'Enforces unique email across all user accounts'
    },
    {
      collection: 'credentials',
      spec: { credential_id: 1 },
      options: { unique: true, name: 'uniq_credential_uuid' },
      purpose: 'Guarantees cryptographic UUID uniqueness for credentials'
    },

    // 2. Query Performance Indexes on Prescriptions
    {
      collection: 'prescriptions',
      spec: { patient_id: 1 },
      options: { name: 'idx_prescriptions_patient_id' },
      purpose: 'Accelerates patient prescription history lookups'
    },
    {
      collection: 'prescriptions',
      spec: { provider_id: 1 },
      options: { name: 'idx_prescriptions_provider_id' },
      purpose: 'Accelerates provider dashboard queries'
    },
    {
      collection: 'prescriptions',
      spec: { created_at: -1 },
      options: { name: 'idx_prescriptions_created_desc' },
      purpose: 'Accelerates chronological sorting of prescriptions'
    },

    // 3. Query Performance Indexes on Audit Logs
    {
      collection: 'audit_logs',
      spec: { created_at: -1 },
      options: { name: 'idx_audit_created_desc' },
      purpose: 'Accelerates audit trail log queries and date filtering'
    },
    {
      collection: 'audit_logs',
      spec: { user_id: 1 },
      options: { name: 'idx_audit_user_id' },
      purpose: 'Fast lookup of actions performed by a specific user'
    },
    {
      collection: 'audit_logs',
      spec: { target_id: 1 },
      options: { name: 'idx_audit_target_id' },
      purpose: 'Fast lookup of audit history for a specific credential/prescription'
    },

    // 4. Lookups on Credentials
    {
      collection: 'credentials',
      spec: { prescription_id: 1 },
      options: { name: 'idx_credentials_prescription_id' },
      purpose: 'Fast join between prescriptions and credentials'
    },
    {
      collection: 'credentials',
      spec: { status: 1 },
      options: { name: 'idx_credentials_status' },
      purpose: 'Fast filtering by credential status (ACTIVE, EXPIRED, REVOKED)'
    },

    // 5. Providers & Patients
    {
      collection: 'providers',
      spec: { user_id: 1 },
      options: { name: 'idx_providers_user_id' },
      purpose: 'Fast provider profile resolution on login'
    },
    {
      collection: 'patients',
      spec: { user_id: 1 },
      options: { name: 'idx_patients_user_id' },
      purpose: 'Fast patient profile resolution on login'
    },
    {
      collection: 'patients',
      spec: { patient_reference: 1 },
      options: { unique: true, sparse: true, name: 'uniq_patient_ref' },
      purpose: 'Ensures uniqueness of patient reference IDs (e.g. PAT-1001)'
    },

    // 6. Issuer Keys
    {
      collection: 'issuer_keys',
      spec: { provider_id: 1, is_active: 1 },
      options: { name: 'idx_issuer_keys_active' },
      purpose: 'Rapid retrieval of active cryptographic signing key for provider'
    }
  ];

  const results = [];
  for (const def of indexDefinitions) {
    try {
      const indexName = await db.collection(def.collection).createIndex(def.spec, def.options);
      results.push({ collection: def.collection, indexName, status: 'CREATED / VERIFIED', purpose: def.purpose });
      console.log(`  ✓ [${def.collection}] ${indexName} — ${def.purpose}`);
    } catch (err) {
      results.push({ collection: def.collection, error: err.message, status: 'FAILED' });
      console.error(`  ✗ [${def.collection}] Failed:`, err.message);
    }
  }

  return results;
}

// If run directly via CLI
if (process.argv[1]?.endsWith('setup-indexes.js')) {
  const client = new MongoClient(uri);
  client.connect().then(async () => {
    const db = client.db(dbName);
    console.log(`\n=============================================================`);
    console.log(`📊 CREATING / VERIFYING MONGODB INDEXES (${dbName})`);
    console.log(`=============================================================`);
    await createIndexes(db);
    console.log(`=============================================================\n`);
    await client.close();
  }).catch(err => {
    console.error('Index setup error:', err);
    process.exit(1);
  });
}
