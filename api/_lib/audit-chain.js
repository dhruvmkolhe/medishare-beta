import crypto from 'crypto';
import { canonicalizeToString, hashCanonical } from './crypto-utils.js';

// In-module async mutex to serialize concurrent audit writes
// so the hash chain is never broken by race conditions.
let chainLock = Promise.resolve();
function withLock(fn) {
  const result = chainLock.then(fn);
  chainLock = result.catch(() => {});
  return result;
}

/**
 * Inserts a cryptographically chained audit log entry.
 *
 * @param {import('mongodb').Db} db
 * @param {string} actorId
 * @param {string} action
 * @param {string} targetType
 * @param {string} targetId
 * @param {object} metadata
 */
export function logChainedAudit(db, actorId, action, targetType, targetId, metadata = {}) {
  return withLock(async () => {
    // Fetch the most recent audit entry to get the prev_hash
    const lastEntry = await db
      .collection('audit_logs')
      .find({})
      .sort({ _id: -1 })
      .limit(1)
      .next();

    const prev_hash = lastEntry?.current_hash ?? 'GENESIS';

    const audit_id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Build the canonical payload with sorted keys (canonicalize sorts them,
    // but we define them here for clarity and documentation).
    const payload = {
      action,
      actor_id: actorId,
      audit_id,
      metadata,
      prev_hash,
      target_id: String(targetId),
      target_type: targetType,
      timestamp,
    };

    // Serialize deterministically
    const canonical = canonicalizeToString(payload);

    // current_hash = SHA-256( canonical + prev_hash + timestamp )
    const current_hash = hashCanonical(canonical + prev_hash + timestamp);

    await db.collection('audit_logs').insertOne({
      audit_id,
      action,
      actor_id: actorId,
      target_type: targetType,
      target_id: String(targetId),
      metadata,
      timestamp,
      prev_hash,
      current_hash,
      created_at: new Date().toISOString(),
    });
  });
}

/**
 * Verifies the integrity of the entire audit log chain.
 *
 * @param {import('mongodb').Db} db
 * @returns {Promise<{ valid: boolean, total: number, brokenAt: object|null, message: string }>}
 */
export async function verifyAuditChain(db) {
  const entries = await db
    .collection('audit_logs')
    .find({})
    .sort({ _id: 1 })
    .toArray();

  const total = entries.length;

  if (total === 0) {
    return { valid: true, total: 0, brokenAt: null, message: 'No audit log entries found.' };
  }

  let expectedPrevHash = 'GENESIS';

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Recompute the canonical payload exactly as logChainedAudit does
    const payload = {
      action: entry.action,
      actor_id: entry.actor_id,
      audit_id: entry.audit_id,
      metadata: entry.metadata,
      prev_hash: entry.prev_hash,
      target_id: String(entry.target_id),
      target_type: entry.target_type,
      timestamp: entry.timestamp,
    };

    const canonical = canonicalizeToString(payload);
    const recomputedHash = hashCanonical(canonical + entry.prev_hash + entry.timestamp);

    // Check 1: current_hash matches recomputed hash
    if (entry.current_hash !== recomputedHash) {
      return {
        valid: false,
        total,
        brokenAt: entry,
        message: `Entry ${i} (audit_id=${entry.audit_id}) has a tampered current_hash.`,
      };
    }

    // Check 2: prev_hash links correctly to the previous entry
    if (entry.prev_hash !== expectedPrevHash) {
      return {
        valid: false,
        total,
        brokenAt: entry,
        message: `Entry ${i} (audit_id=${entry.audit_id}) has a broken prev_hash link.`,
      };
    }

    expectedPrevHash = entry.current_hash;
  }

  return {
    valid: true,
    total,
    brokenAt: null,
    message: `All ${total} entries verified successfully.`,
  };
}
