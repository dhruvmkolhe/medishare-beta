/**
 * setup-security-alerts-index.js
 *
 * Creates MongoDB indexes required for the anomaly detection feature.
 *
 * New collection: security_alerts
 *   - { created_at: -1 }           — default sort for the admin list view
 *   - { credential_id: 1 }         — look up all alerts for a given credential
 *   - { reviewed: 1 }              — filter by review status efficiently
 *
 * Existing collection: verification_events
 *   - { credential_id: 1, verified_at: -1 }  — power the impossible-travel and
 *                                               rapid-reverification queries that
 *                                               search by credential + time window
 *
 * Usage:
 *   MONGODB_URI=mongodb://... MONGODB_DB_NAME=medishare node scripts/setup-security-alerts-index.js
 */

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB_NAME || 'medishare';

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(dbName);

  // security_alerts indexes
  await db.collection('security_alerts').createIndex({ created_at: -1 });
  console.log('✅ security_alerts: index on created_at');

  await db.collection('security_alerts').createIndex({ credential_id: 1 });
  console.log('✅ security_alerts: index on credential_id');

  await db.collection('security_alerts').createIndex({ reviewed: 1 });
  console.log('✅ security_alerts: index on reviewed');

  // verification_events compound index (already may exist — createIndex is idempotent)
  await db.collection('verification_events').createIndex(
    { credential_id: 1, verified_at: -1 },
    { name: 'credential_id_verified_at' }
  );
  console.log('✅ verification_events: compound index on credential_id + verified_at');

  console.log('\n✅ All security alerts indexes created successfully.');
} finally {
  await client.close();
}
