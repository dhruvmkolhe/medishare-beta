#!/usr/bin/env node
/**
 * migrate-audit-chain.js
 *
 * Migrates existing audit_log documents that do NOT have a `current_hash` field
 * by computing and persisting the hash chain for them (oldest first).
 *
 * Run ONCE after deploying the cryptographically chained audit trail feature.
 *
 * Usage:
 *   MONGODB_URI=mongodb://... MONGODB_DB_NAME=medishare node scripts/migrate-audit-chain.js
 */
import { MongoClient } from 'mongodb';
import { canonicalizeToString, hashCanonical } from '../api/_lib/crypto-utils.js';

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'medishare';
  const client = new MongoClient(uri);

  await client.connect();
  console.log(`Connected to MongoDB at ${uri}, database: ${dbName}`);

  const db = client.db(dbName);
  const collection = db.collection('audit_logs');

  // Fetch ALL entries sorted by _id ascending (insertion order).
  // We process ALL of them to build a coherent chain from the very first document.
  const allEntries = await collection.find({}).sort({ _id: 1 }).toArray();

  if (allEntries.length === 0) {
    console.log('No audit_log entries found. Nothing to migrate.');
    await client.close();
    return;
  }

  const rebuild = process.argv.includes('--rebuild');

  // Find the index of the first un-migrated entry.
  let startIndex = 0;
  let expectedPrevHash = 'GENESIS';

  if (!rebuild) {
    for (let i = 0; i < allEntries.length; i++) {
      if (allEntries[i].current_hash) {
        // Already migrated — adopt its current_hash as the next prev_hash
        expectedPrevHash = allEntries[i].current_hash;
        startIndex = i + 1;
      } else {
        // First un-migrated entry found
        break;
      }
    }
  }

  const toMigrate = allEntries.slice(startIndex);

  if (toMigrate.length === 0) {
    console.log('All audit_log entries already have current_hash. Nothing to migrate.');
    await client.close();
    return;
  }

  console.log(
    `Found ${toMigrate.length} un-migrated entr${toMigrate.length === 1 ? 'y' : 'ies'} ` +
    `(out of ${allEntries.length} total). Starting migration…`
  );

  let migrated = 0;

  for (const entry of toMigrate) {
    const prev_hash = expectedPrevHash;

    // Derive audit_id: use stored value if present, else generate a stable one from _id.
    const audit_id = entry.audit_id ?? entry._id.toHexString();

    // Derive timestamp: use stored value if present, fall back to created_at.
    const timestamp = entry.timestamp ?? entry.created_at ?? new Date().toISOString();

    // Build canonical payload identical to what logChainedAudit produces.
    const payload = {
      action: entry.action,
      actor_id: entry.actor_id,
      audit_id,
      metadata: entry.metadata || {},
      prev_hash,
      target_id: String(entry.target_id ?? ''),
      target_type: entry.target_type,
      timestamp,
    };

    const canonical = canonicalizeToString(payload);
    const current_hash = hashCanonical(canonical + prev_hash + timestamp);

    await collection.updateOne(
      { _id: entry._id },
      {
        $set: {
          audit_id,
          timestamp,
          prev_hash,
          current_hash,
        },
      }
    );

    expectedPrevHash = current_hash;
    migrated++;

    if (migrated % 100 === 0) {
      console.log(`  … migrated ${migrated}/${toMigrate.length}`);
    }
  }

  console.log(`✅ Migration complete. ${migrated} entr${migrated === 1 ? 'y' : 'ies'} updated.`);
  await client.close();
}

main().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
