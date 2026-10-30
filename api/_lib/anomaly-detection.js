/**
 * anomaly-detection.js
 *
 * Privacy-first anomaly detection for MediShare verification events.
 *
 * Design principles:
 *  - Raw IP addresses are NEVER stored; only a truncated SHA-256 hash is persisted.
 *  - Geographic resolution is intentionally coarse (continent-level buckets based
 *    on first IPv4 octet) — precise geolocation is neither needed nor stored.
 *  - Anomaly detection is fully non-blocking: callers must wrap usage in
 *    Promise chains with .catch() so that a detection failure never interrupts
 *    the verification flow.
 *  - Alerts inform admins for manual review only — no user is ever blocked solely
 *    on the basis of an anomaly signal.
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// IP hashing
// ---------------------------------------------------------------------------

/**
 * Hashes an IP address with a server-side salt so raw IPs are never at rest.
 * Only the first 16 hex characters (64 bits) are kept — sufficient for
 * deduplication purposes while further reducing re-identification risk.
 *
 * @param {string} ip
 * @returns {string} 16-char hex string
 */
export function hashIp(ip) {
  return crypto
    .createHash('sha256')
    .update(ip + (process.env.IP_HASH_SALT || 'medishare-ip-salt'))
    .digest('hex')
    .slice(0, 16);
}

// ---------------------------------------------------------------------------
// Coarse regional classification
// ---------------------------------------------------------------------------

/**
 * Maps an IPv4 address to a very coarse regional bucket (REGION_A … REGION_E).
 * This is NOT geolocation — it is an intentionally imprecise anomaly signal.
 * Private / loopback addresses return 'LOCAL'; non-parseable values 'UNKNOWN'.
 *
 * Buckets are based solely on the first octet of the IPv4 address:
 *   REGION_A: 1 – 50
 *   REGION_B: 51 – 100
 *   REGION_C: 101 – 150
 *   REGION_D: 151 – 200
 *   REGION_E: 201 – 255
 *
 * @param {string} ip
 * @returns {string}
 */
export function getIpRegion(ip) {
  if (
    !ip ||
    ip === 'unknown' ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.')
  ) {
    return 'LOCAL';
  }

  const firstOctet = parseInt(ip.split('.')[0], 10);
  if (isNaN(firstOctet)) return 'UNKNOWN';

  if (firstOctet >= 1 && firstOctet <= 50) return 'REGION_A';
  if (firstOctet >= 51 && firstOctet <= 100) return 'REGION_B';
  if (firstOctet >= 101 && firstOctet <= 150) return 'REGION_C';
  if (firstOctet >= 151 && firstOctet <= 200) return 'REGION_D';
  return 'REGION_E';
}

// ---------------------------------------------------------------------------
// Impossible-travel detection
// ---------------------------------------------------------------------------

/**
 * Checks whether the same credential was successfully verified from a
 * *different* network region within the last 10 minutes.
 *
 * Only PASS events are examined — failed verifications could be noise
 * (e.g., brute-force probes) and should not trigger travel alerts.
 * LOCAL and UNKNOWN regions are excluded because they carry no meaningful
 * geographic signal.
 *
 * @param {import('mongodb').Db} db
 * @param {string} credentialId
 * @param {string} currentIpHash  - privacy-preserving hash of the current IP
 * @param {string} currentRegion  - coarse region of the current request
 * @returns {Promise<{detected: boolean, reason?: string, previousEvent?: object, currentRegion?: string}>}
 */
export async function checkImpossibleTravel(db, credentialId, currentIpHash, currentRegion) {
  // Skip the check entirely when the current request has no meaningful region signal
  if (currentRegion === 'LOCAL' || currentRegion === 'UNKNOWN') {
    return { detected: false };
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const recentEvents = await db
    .collection('verification_events')
    .find({
      credential_id: credentialId,
      verified_at: { $gte: tenMinutesAgo },
      result: 'PASS', // Only flag successful verifications
    })
    .sort({ verified_at: -1 })
    .limit(5)
    .toArray();

  for (const event of recentEvents) {
    if (
      event.ip_region &&
      event.ip_region !== 'LOCAL' &&
      event.ip_region !== 'UNKNOWN' &&
      event.ip_region !== currentRegion &&
      event.ip_hash !== currentIpHash // Different device/IP hash
    ) {
      return {
        detected: true,
        reason: 'Credential verified from different network regions within 10 minutes',
        previousEvent: {
          verified_at: event.verified_at,
          ip_region: event.ip_region,
        },
        currentRegion,
      };
    }
  }

  return { detected: false };
}

// ---------------------------------------------------------------------------
// Rapid re-verification detection
// ---------------------------------------------------------------------------

/**
 * Flags when the same credential is verified 5 or more times within 2 minutes,
 * which may indicate automated scanning or relay-attack tooling.
 *
 * Both PASS and FAIL events are counted because even failed verification
 * attempts are a meaningful signal for automated probing.
 *
 * @param {import('mongodb').Db} db
 * @param {string} credentialId
 * @returns {Promise<{detected: boolean, reason?: string, count?: number}>}
 */
export async function checkRapidReverification(db, credentialId) {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const count = await db.collection('verification_events').countDocuments({
    credential_id: credentialId,
    verified_at: { $gte: twoMinutesAgo },
  });

  if (count >= 5) {
    return {
      detected: true,
      reason: `Credential verified ${count} times in the last 2 minutes (possible automated scanning)`,
      count,
    };
  }

  return { detected: false };
}

// ---------------------------------------------------------------------------
// Alert persistence
// ---------------------------------------------------------------------------

/**
 * Writes a security alert document to the `security_alerts` collection.
 * Errors are swallowed after logging — recording an alert must never
 * propagate an exception back to the verification flow.
 *
 * @param {import('mongodb').Db} db
 * @param {'IMPOSSIBLE_TRAVEL'|'RAPID_REVERIFICATION'} alertType
 * @param {string} credentialId
 * @param {object} details
 * @returns {Promise<void>}
 */
export async function recordSecurityAlert(db, alertType, credentialId, details) {
  try {
    await db.collection('security_alerts').insertOne({
      alert_type: alertType,
      credential_id: credentialId,
      details,
      created_at: new Date().toISOString(),
      reviewed: false, // Admins must manually mark alerts as reviewed
    });
  } catch (e) {
    // Non-fatal: log the failure but do not propagate
    console.error('Failed to record security alert:', e);
  }
}
