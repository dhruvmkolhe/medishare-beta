import getDb from '../_lib/db-client.js';
import { ObjectId } from 'mongodb';
import { corsHeaders, getPath, logAudit, dispensationSchema, requireRole } from '../_lib/utils.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const db = await getDb();

    if (req.method === 'POST' && getPath(req) === '/api/dispensations') {
      const payload = await requireRole(req, ['PHARMACIST', 'ADMIN']);
      if (!payload) {
        return res.status(401).json({ error: 'Unauthorized: Dispensation is restricted to licensed pharmacists or administrators' });
      }

      const parsed = dispensationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

      const { credentialId, pharmacyName, notes, pickupPin } = parsed.data;

      let credential = await db.collection('credentials').findOne({ credential_id: credentialId });
      if (!credential && ObjectId.isValid(credentialId) && credentialId.length === 24) {
        credential = await db.collection('credentials').findOne({ _id: new ObjectId(credentialId) });
      }
      if (!credential) return res.status(404).json({ error: 'Credential not found' });

      // Anti-theft Patient Pickup PIN Verification
      if (credential.pickup_pin) {
        if (!pickupPin || pickupPin.trim() !== credential.pickup_pin.trim()) {
          return res.status(400).json({ error: 'Invalid Patient Pickup PIN. Dispensation rejected.' });
        }
      }

      const maxDisp = credential.max_dispensations || 1;

      // Count existing dispensations
      const dispensations = credential.dispensations || [];
      const currentCount = dispensations.length;

      if (credential.status === 'DISPENSED' || credential.status === 'REVOKED' || credential.status === 'EXPIRED') {
        return res.status(400).json({ error: `Credential is ${credential.status.toLowerCase()} and cannot be dispensed` });
      }

      if (currentCount >= maxDisp) {
        return res.status(400).json({ error: 'All authorized dispensations have been used' });
      }

      const dispensedAt = new Date().toISOString();
      const newDispensation = {
        dispensed_by: payload.sub,
        pharmacy_name: pharmacyName || 'Metro Central Pharmacy',
        notes: notes,
        dispensed_at: dispensedAt
      };

      const newCount = currentCount + 1;
      const remaining = maxDisp - newCount;

      const updateFields = {};
      // Only mark as DISPENSED when all fills are exhausted
      if (newCount >= maxDisp) {
        updateFields.status = 'DISPENSED';
        updateFields.updated_at = dispensedAt;
      }

      await db.collection('credentials').updateOne(
        { _id: credential._id },
        { 
          $push: { dispensations: newDispensation },
          $set: updateFields
        }
      );

      await logAudit(db, payload.sub, 'CREDENTIAL_DISPENSED', 'credential', credential._id, {
        pharmacy_name: newDispensation.pharmacy_name,
        dispensation_number: newCount,
        remaining
      });

      return res.status(200).json({ ok: true, dispensedAt, remaining, dispensationNumber: newCount, totalAuthorized: maxDisp });
    }

    if (req.method === 'GET' && getPath(req).startsWith('/api/dispensations/')) {
      const credentialUuid = getPath(req).split('/')[3];
      
      let credential = await db.collection('credentials').findOne({ credential_id: credentialUuid });
      if (!credential && ObjectId.isValid(credentialUuid) && credentialUuid.length === 24) {
        credential = await db.collection('credentials').findOne({ _id: new ObjectId(credentialUuid) });
      }
      if (!credential) return res.status(404).json({ error: 'Credential not found' });

      const dispensations = credential.dispensations || [];
      const dispensation = dispensations[0];
      if (!dispensation) return res.status(404).json({ error: 'Dispensation not found' });

      return res.status(200).json(dispensation);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Dispensation error:', err);
    res.status(500).json({ error: err.message });
  }
}
