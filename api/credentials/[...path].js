import getDb from '../db-client.js';
import { ObjectId } from 'mongodb';
import {
  corsHeaders, requireRole, credentialRevokeSchema, logAudit, getPath
} from '../utils.js';
import {
  canonicalizeToString, hashCanonical, signCredential, decryptPrivateKey,
  generateCredentialId, verifySignature, detectTamper, generateVerificationUrl
} from '../crypto-utils.js';

async function findCredential(db, id) {
  if (!id) return null;
  let credential = null;
  if (ObjectId.isValid(id) && id.length === 24) {
    try {
      credential = await db.collection('credentials').findOne({ _id: new ObjectId(id) });
    } catch {}
  }
  if (!credential) {
    credential = await db.collection('credentials').findOne({ credential_id: id });
  }
  return credential;
}

async function getPrescriptionItems(db, prescription) {
  if (!prescription) return [];
  let items = await db.collection('prescription_items').find({ prescription_id: prescription._id.toString() }).sort({ sort_order: 1 }).toArray();
  if (!items || items.length === 0) {
    items = prescription.items || [];
  }
  return items;
}

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const db = await getDb();

    if (req.method === 'POST' && getPath(req) === '/api/credentials') {
      const payload = await requireRole(req, ['ADMIN', 'PROVIDER']);
      if (!payload) return res.status(401).json({ error: 'Unauthorized' });

      const { prescriptionId } = req.body;
      if (!prescriptionId) return res.status(400).json({ error: 'prescriptionId required' });

      const prescription = await db.collection('prescriptions').findOne({ _id: new ObjectId(prescriptionId) });
      if (!prescription) return res.status(404).json({ error: 'Prescription not found' });

      const provider = await db.collection('providers').findOne({ user_id: payload.sub });
      if (!provider || provider._id.toString() !== prescription.provider_id.toString()) return res.status(403).json({ error: 'Forbidden' });

      const key = await db.collection('issuer_keys').findOne({ provider_id: provider._id.toString(), is_active: true });
      if (!key) return res.status(400).json({ error: 'No active signing key found' });

      const items = await db.collection('prescription_items').find({ prescription_id: prescription._id.toString() }).sort({ sort_order: 1 }).toArray();

      const maxRefills = items && items.length > 0 ? Math.max(...items.map(i => i.refills || 0)) : 0;
      const maxDispensations = 1 + maxRefills;

      let credentialData;
      if (items && items.length > 0) {
        credentialData = {
          items: items.map(i => ({
            dosage: i.dosage,
            duration: i.duration,
            medication: i.medication,
            strength: i.strength,
          })),
          notes: prescription.notes,
        };
      } else {
        credentialData = {
          medication: prescription.medication,
          strength: prescription.strength,
          dosage: prescription.dosage,
          duration: prescription.duration,
          notes: prescription.notes,
        };
      }

      const canonical = canonicalizeToString(credentialData);
      const contentHash = hashCanonical(canonical);
      const privateKey = decryptPrivateKey(key.encrypted_private_key, key.iv, key.auth_tag);
      const signature = signCredential(contentHash, privateKey);

      const credentialId = generateCredentialId();
      const issuedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const pickupPin = Math.floor(100000 + Math.random() * 900000).toString();

      const credDoc = {
        credential_id: credentialId,
        prescription_id: prescription._id.toString(),
        issuer_key_id: key._id.toString(),
        content_hash: contentHash,
        signature,
        issued_at: issuedAt,
        expires_at: expiresAt,
        status: 'ACTIVE',
        max_dispensations: maxDispensations,
        dispensations: [],
        pickup_pin: pickupPin,
      };
      
      const result = await db.collection('credentials').insertOne(credDoc);
      const credential = { ...credDoc, _id: result.insertedId };

      const host = req.headers.host;
      const proto = req.headers['x-forwarded-proto'] || 'http';
      return res.status(201).json({ ...credential, canonical, verificationUrl: generateVerificationUrl(credentialId, host, proto) });
    }

    if (req.method === 'GET' && getPath(req) === '/api/credentials') {
      const payload = await requireRole(req, ['ADMIN', 'PROVIDER', 'PATIENT']);
      if (!payload) return res.status(401).json({ error: 'Unauthorized' });

      let providerId = null;
      let patientId = null;
      if (payload.role === 'PROVIDER') {
        const provider = await db.collection('providers').findOne({ user_id: payload.sub });
        if (provider) providerId = provider._id.toString();
      } else if (payload.role === 'PATIENT') {
        const patient = await db.collection('patients').findOne({ user_id: payload.sub });
        if (patient) patientId = patient._id.toString();
      }

      const url = new URL(req.url, `http://${req.headers.host}`);
      const search = (url.searchParams.get('search') || '').toLowerCase();
      const status = url.searchParams.get('status') || '';
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      const credentials = await db.collection('credentials').find({}).sort({ created_at: -1 }).toArray();

      const prescriptions = await db.collection('prescriptions').find({}).toArray();
      const providers = await db.collection('providers').find({}, { projection: { _id: 1, name: 1 } }).toArray();
      const patients = await db.collection('patients').find({}, { projection: { _id: 1, display_name: 1, patient_reference: 1 } }).toArray();
      const allItems = await db.collection('prescription_items').find({}).sort({ sort_order: 1 }).toArray();

      const rxMap = new Map(prescriptions.map(p => {
        const prov = providers.find(pr => pr._id.toString() === p.provider_id?.toString());
        const pat = patients.find(pa => pa._id.toString() === p.patient_id?.toString());
        const pxItems = allItems.filter(item => item.prescription_id?.toString() === p._id.toString());
        return [p._id.toString(), { ...p, items: pxItems, providers: prov ? { name: prov.name } : null, patients: pat ? { display_name: pat.display_name, patient_reference: pat.patient_reference } : null }];
      }));

      let enriched = credentials.map(c => ({
        ...c,
        id: c._id.toString(),
        prescriptions: rxMap.get(c.prescription_id?.toString()) || null,
      }));

      if (providerId) {
        enriched = enriched.filter(c => c.prescriptions?.provider_id?.toString() === providerId);
      } else if (patientId) {
        enriched = enriched.filter(c => c.prescriptions?.patient_id?.toString() === patientId);
      }

      if (search) {
        enriched = enriched.filter(c => {
          if (!c.prescriptions) return false;
          if (c.prescriptions.items && c.prescriptions.items.length > 0) {
            return c.prescriptions.items.some(i => (i.medication || '').toLowerCase().includes(search));
          }
          return (c.prescriptions.medication || '').toLowerCase().includes(search);
        });
      }

      if (status) {
        enriched = enriched.filter(c => c.status === status);
      }

      const total = enriched.length;
      const from = (page - 1) * limit;
      enriched = enriched.slice(from, from + limit);

      return res.status(200).json({ data: enriched, total, page, limit });
    }

    if (req.method === 'GET' && getPath(req).startsWith('/api/credentials/') && !getPath(req).includes('/revoke') && !getPath(req).includes('/compare') && !getPath(req).includes('/qr') && !getPath(req).includes('/export')) {
      const payload = await requireRole(req, ['ADMIN', 'PROVIDER', 'PATIENT']);
      if (!payload) return res.status(401).json({ error: 'Unauthorized' });
      const id = getPath(req).split('/')[3];

      const credential = await findCredential(db, id);
      if (!credential) return res.status(404).json({ error: 'Credential not found' });

      const prescription = credential.prescription_id ? await db.collection('prescriptions').findOne({ _id: new ObjectId(credential.prescription_id) }) : null;
      
      let provider = null;
      let patient = null;
      if (prescription) {
        if (prescription.provider_id) {
          provider = await db.collection('providers').findOne({ _id: new ObjectId(prescription.provider_id) }, { projection: { _id: 1, name: 1 } });
        }
        if (prescription.patient_id) {
          patient = await db.collection('patients').findOne({ _id: new ObjectId(prescription.patient_id) }, { projection: { _id: 1, display_name: 1, patient_reference: 1 } });
        }
      }

      const items = await getPrescriptionItems(db, prescription);
      const fullPrescription = prescription ? {
        ...prescription,
        items: items,
        providers: provider ? { name: provider.name } : null,
        patients: patient ? { display_name: patient.display_name, patient_reference: patient.patient_reference } : null,
      } : null;

      if (payload.role === 'PATIENT') {
        const pat = await db.collection('patients').findOne({ user_id: payload.sub }, { projection: { _id: 1 } });
        if (!pat || pat._id.toString() !== prescription?.patient_id?.toString()) return res.status(403).json({ error: 'Forbidden' });
      }
      if (payload.role === 'PROVIDER') {
        const prov = await db.collection('providers').findOne({ user_id: payload.sub }, { projection: { _id: 1 } });
        if (!prov || prov._id.toString() !== prescription?.provider_id?.toString()) return res.status(403).json({ error: 'Forbidden' });
      }

      return res.status(200).json({ ...credential, id: credential._id.toString(), prescriptions: fullPrescription });
    }

    if (req.method === 'POST' && getPath(req).startsWith('/api/credentials/') && getPath(req).endsWith('/revoke')) {
      const payload = await requireRole(req, ['ADMIN', 'PROVIDER', 'PATIENT']);
      if (!payload) return res.status(401).json({ error: 'Unauthorized' });
      const id = getPath(req).split('/')[3];

      const parsed = credentialRevokeSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

      const credential = await findCredential(db, id);
      if (!credential) return res.status(404).json({ error: 'Credential not found' });

      const prescription = credential.prescription_id ? await db.collection('prescriptions').findOne({ _id: new ObjectId(credential.prescription_id) }) : null;

      if (payload.role === 'PATIENT') {
        const patient = await db.collection('patients').findOne({ user_id: payload.sub }, { projection: { _id: 1 } });
        if (!patient || patient._id.toString() !== prescription?.patient_id?.toString()) return res.status(403).json({ error: 'Forbidden' });
      }
      if (payload.role === 'PROVIDER') {
        const provider = await db.collection('providers').findOne({ user_id: payload.sub }, { projection: { _id: 1 } });
        if (!provider || provider._id.toString() !== prescription?.provider_id?.toString()) return res.status(403).json({ error: 'Forbidden' });
      }

      const now = new Date().toISOString();
      await db.collection('credentials').updateOne({ _id: credential._id }, { $set: { status: 'REVOKED', updated_at: now } });

      await db.collection('revocations').insertOne({
        credential_id: credential._id.toString(),
        revoked_by: payload.sub,
        reason: parsed.data.reason,
        revoked_at: now,
      });

      await logAudit(db, payload.sub, 'CREDENTIAL_REVOKED', 'credential', credential._id.toString(), { reason: parsed.data.reason, credential_id: credential.credential_id });
      return res.status(200).json({ ok: true, status: 'REVOKED' });
    }

    if (req.method === 'GET' && getPath(req).startsWith('/api/credentials/') && getPath(req).endsWith('/qr')) {
      const payload = await requireRole(req, ['ADMIN', 'PROVIDER', 'PATIENT']);
      if (!payload) return res.status(401).json({ error: 'Unauthorized' });
      const id = getPath(req).split('/')[3];

      const credential = await findCredential(db, id);
      if (!credential) return res.status(404).json({ error: 'Credential not found' });

      if (payload.role === 'PATIENT') {
        const prescription = credential.prescription_id ? await db.collection('prescriptions').findOne({ _id: new ObjectId(credential.prescription_id) }) : null;
        const patient = await db.collection('patients').findOne({ user_id: payload.sub }, { projection: { _id: 1 } });
        if (!patient || patient._id.toString() !== prescription?.patient_id?.toString()) return res.status(403).json({ error: 'Forbidden' });
      }

      const host = req.headers.host;
      const proto = req.headers['x-forwarded-proto'] || 'http';
      const url = generateVerificationUrl(credential.credential_id, host, proto);
      return res.status(200).json({ qrUrl: url, credentialId: credential.credential_id });
    }

    if (req.method === 'GET' && getPath(req).startsWith('/api/credentials/') && getPath(req).endsWith('/export/vc')) {
      const payload = await requireRole(req, ['ADMIN', 'PROVIDER', 'PATIENT']);
      if (!payload) return res.status(401).json({ error: 'Unauthorized' });
      const id = getPath(req).split('/')[3];

      const credential = await findCredential(db, id);
      if (!credential) return res.status(404).json({ error: 'Credential not found' });

      const prescription = credential.prescription_id ? await db.collection('prescriptions').findOne({ _id: new ObjectId(credential.prescription_id) }) : null;
      if (!prescription) return res.status(404).json({ error: 'Prescription not found' });

      const items = await getPrescriptionItems(db, prescription);

      let providerName = 'Unknown Provider';
      if (prescription.provider_id) {
        const provider = await db.collection('providers').findOne({ _id: new ObjectId(prescription.provider_id) }, { projection: { name: 1 } });
        if (provider) providerName = provider.name;
      }

      let patientRef = 'unknown';
      let patientName = 'Unknown Patient';
      if (prescription.patient_id) {
        const patient = await db.collection('patients').findOne({ _id: new ObjectId(prescription.patient_id) }, { projection: { display_name: 1, patient_reference: 1 } });
        if (patient) {
          patientRef = patient.patient_reference;
          patientName = patient.display_name;
        }
      }

      const medications = items && items.length > 0 ? items.map(i => ({
        medication: i.medication,
        strength: i.strength,
        dosage: i.dosage,
        duration: i.duration,
        timing: i.timing || '',
        refills: i.refills || 0,
      })) : [{
        medication: prescription.medication,
        strength: prescription.strength,
        dosage: prescription.dosage,
        duration: prescription.duration,
        timing: '',
        refills: 0,
      }];

      const statusMap = { ACTIVE: 'active', REVOKED: 'revoked', DISPENSED: 'dispensed', EXPIRED: 'expired', SUPERSEDED: 'superseded' };

      const vc = {
        '@context': [
          'https://www.w3.org/ns/credentials/v2',
          'https://w3id.org/security/suites/ed25519-2020/v1'
        ],
        id: `urn:uuid:${credential.credential_id}`,
        type: ['VerifiableCredential', 'PrescriptionCredential'],
        issuer: {
          id: `did:web:medishare.example:provider:${prescription.provider_id}`,
          name: providerName,
        },
        validFrom: credential.issued_at,
        validUntil: credential.expires_at,
        credentialSubject: {
          id: `did:web:medishare.example:patient:${patientRef}`,
          name: patientName,
          prescription: {
            medications,
            notes: prescription.notes || '',
          },
        },
        credentialStatus: {
          type: 'StatusList2021Entry',
          statusPurpose: 'revocation',
          currentStatus: statusMap[credential.status] || credential.status.toLowerCase(),
        },
        proof: {
          type: 'Ed25519Signature2020',
          created: credential.issued_at,
          verificationMethod: `did:web:medishare.example:provider:${prescription.provider_id}#key-${credential.issuer_key_id}`,
          proofPurpose: 'assertionMethod',
          proofValue: credential.signature,
        },
      };

      res.setHeader('Content-Disposition', `attachment; filename="credential-${credential.credential_id}-vc.json"`);
      return res.status(200).json(vc);
    }

    if (req.method === 'GET' && getPath(req).startsWith('/api/credentials/') && getPath(req).endsWith('/export/fhir')) {
      const payload = await requireRole(req, ['ADMIN', 'PROVIDER', 'PATIENT']);
      if (!payload) return res.status(401).json({ error: 'Unauthorized' });
      const id = getPath(req).split('/')[3];

      const credential = await findCredential(db, id);
      if (!credential) return res.status(404).json({ error: 'Credential not found' });

      const prescription = credential.prescription_id ? await db.collection('prescriptions').findOne({ _id: new ObjectId(credential.prescription_id) }) : null;
      if (!prescription) return res.status(404).json({ error: 'Prescription not found' });

      const items = await getPrescriptionItems(db, prescription);

      let providerName = 'Unknown Provider';
      if (prescription.provider_id) {
        const provider = await db.collection('providers').findOne({ _id: new ObjectId(prescription.provider_id) }, { projection: { name: 1 } });
        if (provider) providerName = provider.name;
      }

      let patientRef = 'unknown';
      let patientName = 'Unknown Patient';
      if (prescription.patient_id) {
        const patient = await db.collection('patients').findOne({ _id: new ObjectId(prescription.patient_id) }, { projection: { display_name: 1, patient_reference: 1 } });
        if (patient) {
          patientRef = patient.patient_reference;
          patientName = patient.display_name;
        }
      }

      const medications = items && items.length > 0 ? items : [{
        medication: prescription.medication,
        strength: prescription.strength,
        dosage: prescription.dosage,
        duration: prescription.duration,
        timing: '',
        refills: 0,
      }];

      const fhirStatusMap = { ACTIVE: 'active', REVOKED: 'cancelled', DISPENSED: 'completed', EXPIRED: 'stopped', SUPERSEDED: 'stopped' };

      const bundle = {
        resourceType: 'Bundle',
        id: credential.credential_id,
        type: 'document',
        timestamp: credential.issued_at,
        entry: medications.map((med, index) => ({
          fullUrl: `urn:uuid:${credential.credential_id}-med-${index}`,
          resource: {
            resourceType: 'MedicationRequest',
            id: `${credential.credential_id}-med-${index}`,
            status: fhirStatusMap[credential.status] || 'unknown',
            intent: 'order',
            medicationCodeableConcept: {
              text: `${med.medication} ${med.strength}`,
            },
            subject: {
              display: patientName,
              reference: `Patient/${patientRef}`,
            },
            requester: {
              display: providerName,
            },
            authoredOn: credential.issued_at,
            dosageInstruction: [{
              text: med.dosage,
              timing: {
                code: { text: med.timing || med.duration || '' },
              },
            }],
            dispenseRequest: {
              numberOfRepeatsAllowed: med.refills || 0,
              validityPeriod: {
                start: credential.issued_at,
                end: credential.expires_at,
              },
            },
            note: prescription.notes ? [{ text: prescription.notes }] : [],
          },
        })),
      };

      res.setHeader('Content-Disposition', `attachment; filename="credential-${credential.credential_id}-fhir.json"`);
      return res.status(200).json(bundle);
    }

    if (req.method === 'GET' && getPath(req).startsWith('/api/credentials/') && getPath(req).endsWith('/compare')) {
      const payload = await requireRole(req, ['ADMIN', 'PROVIDER']);
      if (!payload) return res.status(401).json({ error: 'Unauthorized' });
      const id = getPath(req).split('/')[3];

      const credential = await findCredential(db, id);
      if (!credential) return res.status(404).json({ error: 'Credential not found' });

      const prescription = credential.prescription_id ? await db.collection('prescriptions').findOne({ _id: new ObjectId(credential.prescription_id) }) : null;
      if (!prescription) return res.status(404).json({ error: 'Prescription not found' });

      if (payload.role === 'PROVIDER') {
        const provider = await db.collection('providers').findOne({ user_id: payload.sub }, { projection: { _id: 1 } });
        if (!provider || provider._id.toString() !== prescription.provider_id?.toString()) return res.status(403).json({ error: 'Forbidden' });
      }

      const items = await getPrescriptionItems(db, prescription);

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
      const tampered = detectTamper(credential.content_hash, currentHash);

      let diff = [];
      if (items && items.length > 0) {
        diff.push({ field: 'notes', original: originalData.notes, current: prescription.notes, changed: originalData.notes !== prescription.notes });
        items.forEach((item, index) => {
          ['medication', 'strength', 'dosage', 'duration'].forEach(field => {
            diff.push({
              field: `items[${index}].${field}`,
              original: originalData.items[index][field],
              current: item[field],
              changed: originalData.items[index][field] !== item[field],
            });
          });
        });
      } else {
        const fields = ['medication', 'strength', 'dosage', 'duration', 'notes'];
        diff = fields.map(field => ({
          field,
          original: originalData[field],
          current: prescription[field],
          changed: originalData[field] !== prescription[field],
        }));
      }

      return res.status(200).json({ diff, tampered, contentHash: credential.content_hash, currentHash });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Credential error:', err);
    res.status(500).json({ error: err.message });
  }
}
