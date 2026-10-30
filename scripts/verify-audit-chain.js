#!/usr/bin/env node
import { MongoClient } from 'mongodb';
import { verifyAuditChain } from '../api/_lib/audit-chain.js';

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'medishare';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const result = await verifyAuditChain(db);
  if (result.valid) {
    console.log(`✅ Audit chain VALID — ${result.total} entries verified.`);
  } else {
    console.error(`❌ Audit chain BROKEN — ${result.message}`);
    if (result.brokenAt) console.error('Broken entry:', JSON.stringify(result.brokenAt, null, 2));
    process.exit(1);
  }
  await client.close();
}
main().catch(e => { console.error(e); process.exit(1); });
