import getDb from '../db-client.js';
import { corsHeaders, getClientIp, rateLimit, logAudit, getPath } from '../utils.js';
import {
  canonicalizeToString, hashCanonical, verifySignature, detectTamper, generateNonce
} from '../crypto-utils.js';
import { z } from 'zod';
import { ObjectId } from 'mongodb';

const verifyInitSchema = z.object({
  credentialId: z.string().min(1),
});

const verifyExchangeSchema = z.object({
  credentialId: z.string().min(1),
  nonce: z.string().min(1),
});

const verificationSessions = new Map();

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const db = await getDb();

    if (req.method === 'POST' && getPath(req) === '/api/verify/init') {
      const ip = getClientIp(req);
      if (!rateLimit(ip, 'verify_init', 10, 60 * 1000)) {
        return res.status(429).json({ error: 'Too many verification attempts. Please try again later.' });
      }

      const parsed = verifyInitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid Credential ID. Please enter a valid credential identifier.' });
      }
      const { credentialId } = parsed.data;

      let credential = await db.collection('credentials').findOne({ credential_id: credentialId });
      if (!credential && ObjectId.isValid(credentialId) && credentialId.length === 24) {
        credential = await db.collection('credentials').findOne({ _id: new ObjectId(credentialId) });
      }
      if (!credential) return res.status(404).json({ error: 'Credential not found' });

      const activeSessions = Array.from(verificationSessions.values()).filter(s => s.credentialId === credentialId && s.used === false && s.expiresAt > Date.now());
      if (activeSessions.length >= 3) {
        return res.status(429).json({ error: 'Maximum active verification sessions reached for this credential.' });
      }

      const nonce = generateNonce();
      verificationSessions.set(nonce, {
        credentialId,
        expiresAt: Date.now() + 60 * 1000,
        used: false,
      });

      return res.status(200).json({ nonce, expiresIn: 60 });
    }

    if (req.method === 'POST' && getPath(req) === '/api/verify/exchange') {
      const ip = getClientIp(req);
      if (!rateLimit(ip, 'verify_exchange', 10, 60 * 1000)) {
        return res.status(429).json({ error: 'Too many verification attempts. Please try again later.' });
      }

      const parsed = verifyExchangeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const { credentialId, nonce } = parsed.data;

      const session = verificationSessions.get(nonce);
      if (!session || session.used || session.expiresAt < Date.now()) {
        return res.status(400).json({ error: 'Invalid or expired verification session' });
      }
      if (session.credentialId !== credentialId) {
        return res.status(400).json({ error: 'Nonce mismatch' });
      }
      session.used = true;

      let credential = await db.collection('credentials').findOne({ credential_id: credentialId });
      if (!credential && ObjectId.isValid(credentialId) && credentialId.length === 24) {
        credential = await db.collection('credentials').findOne({ _id: new ObjectId(credentialId) });
      }
      if (!credential) return res.status(404).json({ error: 'Credential not found' });

      const prescription = await db.collection('prescriptions').findOne({ _id: new ObjectId(credential.prescription_id) });
      if (!prescription) return res.status(404).json({ error: 'Prescription not found' });

      const issuerKey = await db.collection('issuer_keys').findOne({ _id: new ObjectId(credential.issuer_key_id) });

      let providerName = 'Unknown Provider';
      if (prescription.provider_id) {
        const provider = await db.collection('providers').findOne({ _id: new ObjectId(prescription.provider_id) });
        if (provider) providerName = provider.name;
      }

      let items = prescription.items || [];
      if (!items || items.length === 0) {
        items = await db.collection('prescription_items').find({ prescription_id: prescription._id.toString() }).sort({ sort_order: 1 }).toArray();
      }

      let originalData;
      if (items && items.length > 0) {
        originalData = {
          items: items.map(i => ({
            dosage: i.dosage,
            duration: i.duration,
            medication: i.medication,
            strength: i.strength,
          })),
          notes: prescription.notes,
        };
      } else {
        originalData = {
          medication: prescription.medication,
          strength: prescription.strength,
          dosage: prescription.dosage,
          duration: prescription.duration,
          notes: prescription.notes,
        };
      }
      const canonical = canonicalizeToString(originalData);
      const currentHash = hashCanonical(canonical);

      const dispensations = credential.dispensations || [];
      const currentDispCount = dispensations.length;
      
      let latestDispensation = null;
      if (currentDispCount > 0) {
        latestDispensation = dispensations.sort((a, b) => new Date(b.dispensed_at) - new Date(a.dispensed_at))[0];
      }

      const maxDisp = credential.max_dispensations || 1;

      const checks = {
        issuer: { passed: !!issuerKey?.public_key, label: 'Issuer Verified' },
        signature: { passed: false, label: 'Digital Signature Valid' },
        integrity: { passed: !detectTamper(credential.content_hash, currentHash), label: 'Data Integrity Valid' },
        status: { passed: credential.status === 'ACTIVE' || credential.status === 'DISPENSED', label: 'Credential Active or Dispensed' },
        expiry: { passed: new Date(credential.expires_at) > new Date(), label: 'Not Expired' },
        dispensed: { passed: credential.status !== 'DISPENSED' || currentDispCount < maxDisp, label: 'Not Fully Dispensed' },
      };

      if (checks.issuer.passed && checks.integrity.passed && issuerKey?.public_key) {
        checks.signature.passed = verifySignature(credential.content_hash, credential.signature, issuerKey.public_key);
      }

      const allPassed = Object.values(checks).every(c => c.passed);
      const result = allPassed ? 'PASS' : 'FAIL';
      const failureReason = allPassed ? null : Object.entries(checks).filter(([_, c]) => !c.passed).map(([k, c]) => c.label).join(', ');

      const event = {
        credential_id: credential._id.toString(),
        result,
        failure_reason: failureReason,
        verified_at: new Date().toISOString(),
        session_nonce: nonce,
      };
      
      const insertEvent = await db.collection('verification_events').insertOne(event);

      await logAudit(db, null, 'VERIFICATION_ATTEMPTED', 'credential', credential._id.toString(), { result, failure_reason: failureReason });

      return res.status(200).json({
        result,
        checks,
        credential: {
          medication: prescription.medication,
          strength: prescription.strength,
          dosage: prescription.dosage,
          duration: prescription.duration,
          items: items,
          issued_at: credential.issued_at,
          expires_at: credential.expires_at,
          provider_name: providerName,
          status: credential.status,
          dispensation: latestDispensation ? {
            dispensed_at: latestDispensation.dispensed_at,
            pharmacy_name: latestDispensation.pharmacy_name,
          } : null,
          refills_total: maxDisp - 1,
          refills_remaining: Math.max(0, maxDisp - currentDispCount),
          dispensation_count: currentDispCount,
          max_dispensations: maxDisp,
        },
        failureReason,
        eventId: insertEvent.insertedId.toString(),
      });
    }

    if (req.method === 'GET' && getPath(req).startsWith('/api/verify/')) {
      const cid = getPath(req).split('/')[3];
      let credential = await db.collection('credentials').findOne({ credential_id: cid });
      if (!credential && ObjectId.isValid(cid) && cid.length === 24) {
        credential = await db.collection('credentials').findOne({ _id: new ObjectId(cid) });
      }
      if (!credential) return res.status(404).json({ error: 'Credential not found' });
      return res.status(200).json({
        credentialId: credential.credential_id,
        status: credential.status,
        issuedAt: credential.issued_at,
        expiresAt: credential.expires_at,
        contentHash: credential.content_hash,
        dispensations: credential.dispensations || [],
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: err.message });
  }
}
