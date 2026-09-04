import { MongoClient } from 'mongodb';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore if custom DNS cannot be set
}

const uri = process.env.MONGODB_URI;
const options = {};

let client;
let clientPromise;

if (!process.env.MONGODB_URI) {
  console.warn('Please add your MONGODB_URI to .env');
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise && uri) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  if (uri) {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }
}

let indexesCreated = false;

export async function ensureIndexes(db) {
  if (indexesCreated) return;
  try {
    await Promise.all([
      // 1. Unique Indexes
      db.collection('users').createIndex({ email: 1 }, { unique: true, name: 'uniq_user_email' }),
      db.collection('credentials').createIndex({ credential_id: 1 }, { unique: true, name: 'uniq_credential_uuid' }),

      // 2. Query Performance Indexes
      db.collection('prescriptions').createIndex({ patient_id: 1 }, { name: 'idx_prescriptions_patient_id' }),
      db.collection('prescriptions').createIndex({ provider_id: 1 }, { name: 'idx_prescriptions_provider_id' }),
      db.collection('prescriptions').createIndex({ created_at: -1 }, { name: 'idx_prescriptions_created_desc' }),

      db.collection('audit_logs').createIndex({ created_at: -1 }, { name: 'idx_audit_created_desc' }),
      db.collection('audit_logs').createIndex({ user_id: 1 }, { name: 'idx_audit_user_id' }),
      db.collection('audit_logs').createIndex({ target_id: 1 }, { name: 'idx_audit_target_id' }),

      db.collection('credentials').createIndex({ prescription_id: 1 }, { name: 'idx_credentials_prescription_id' }),
      db.collection('credentials').createIndex({ status: 1 }, { name: 'idx_credentials_status' }),

      db.collection('providers').createIndex({ user_id: 1 }, { name: 'idx_providers_user_id' }),
      db.collection('patients').createIndex({ user_id: 1 }, { name: 'idx_patients_user_id' }),
      db.collection('patients').createIndex({ patient_reference: 1 }, { unique: true, sparse: true, name: 'uniq_patient_ref' }),
      db.collection('issuer_keys').createIndex({ provider_id: 1, is_active: 1 }, { name: 'idx_issuer_keys_active' }),
    ]);
    indexesCreated = true;
  } catch (err) {
    console.warn('Note on database index check:', err.message);
  }
}

export default async function getDb() {
  if (!clientPromise) throw new Error('MONGODB_URI not defined');
  const connectedClient = await clientPromise;
  const db = connectedClient.db(process.env.MONGODB_DB_NAME || 'medishare');
  if (!indexesCreated) {
    await ensureIndexes(db);
  }
  return db;
}
