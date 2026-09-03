import getDb from '../db-client.js';
import { corsHeaders, requireRole, prescriptionSchema, logAudit, getPath } from '../utils.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const payload = await requireRole(req, ['ADMIN', 'PROVIDER', 'PATIENT']);
    if (!payload) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    if (req.method === 'POST' && getPath(req) === '/api/prescriptions') {
      if (payload.role !== 'PROVIDER' && payload.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });

      const parsed = prescriptionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

      const provider = await db.collection('providers').findOne({ user_id: payload.sub });
      if (!provider) return res.status(403).json({ error: 'Provider not found' });

      const items = parsed.data.items.map((item, i) => ({
        medication: item.medication,
        strength: item.strength,
        dosage: item.dosage,
        duration: item.duration,
        timing: item.timing || '',
        refills: item.refills || 0,
        sort_order: i,
      }));

      const firstItem = items[0];

      const prescriptionDoc = {
        provider_id: provider._id.toString(),
        patient_id: parsed.data.patientId,
        medication: firstItem.medication,
        strength: firstItem.strength,
        dosage: firstItem.dosage,
        duration: firstItem.duration,
        notes: parsed.data.notes || '',
        items,
        created_at: new Date()
      };

      const result = await db.collection('prescriptions').insertOne(prescriptionDoc);
      const prescriptionId = result.insertedId.toString();

      await logAudit(db, payload.sub, 'PRESCRIPTION_CREATED', 'prescription', prescriptionId, { patient_id: parsed.data.patientId });
      
      return res.status(201).json({ ...prescriptionDoc, id: prescriptionId, _id: undefined });
    }

    if (req.method === 'GET' && getPath(req) === '/api/prescriptions') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const search = url.searchParams.get('search') || '';
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      let filter = {};

      if (payload.role === 'PROVIDER') {
        const provider = await db.collection('providers').findOne({ user_id: payload.sub });
        if (provider) {
          filter.provider_id = provider._id.toString();
        }
      } else if (payload.role === 'PATIENT') {
        const patient = await db.collection('patients').findOne({ user_id: payload.sub });
        if (patient) {
          filter.patient_id = patient._id.toString();
        }
      }

      if (search) {
        filter.medication = { $regex: search, $options: 'i' };
      }

      const count = await db.collection('prescriptions').countDocuments(filter);
      
      const from = (page - 1) * limit;

      const prescriptions = await db.collection('prescriptions')
        .find(filter)
        .sort({ created_at: -1 })
        .skip(from)
        .limit(limit)
        .toArray();

      const providerIds = [...new Set(prescriptions.map(p => p.provider_id).filter(Boolean))];
      const patientIds = [...new Set(prescriptions.map(p => p.patient_id).filter(Boolean))];

      const providers = await db.collection('providers').find({ _id: { $in: providerIds.map(id => new ObjectId(id)) } }).toArray();
      const patients = await db.collection('patients').find({ _id: { $in: patientIds.map(id => new ObjectId(id)) } }).toArray();
      
      const enriched = prescriptions.map(p => {
        const prov = providers.find(pr => pr._id.toString() === p.provider_id);
        const pat = patients.find(pa => pa._id.toString() === p.patient_id);
        
        const mappedP = { ...p, id: p._id.toString(), _id: undefined };
        
        return {
          ...mappedP,
          providers: prov ? { name: prov.name } : null,
          patients: pat ? { display_name: pat.display_name, patient_reference: pat.patient_reference } : null,
          items: p.items || [],
        };
      });

      return res.status(200).json({ data: enriched, total: count || 0, page, limit });
    }

    if (req.method === 'GET' && getPath(req).startsWith('/api/prescriptions/')) {
      const id = getPath(req).split('/')[3];
      if (!ObjectId.isValid(id) || id.length !== 24) {
        return res.status(404).json({ error: 'Prescription not found' });
      }
      const data = await db.collection('prescriptions').findOne({ _id: new ObjectId(id) });
      if (!data) return res.status(404).json({ error: 'Prescription not found' });

      if (payload.role === 'PATIENT') {
        const patient = await db.collection('patients').findOne({ user_id: payload.sub });
        if (!patient || patient._id.toString() !== data.patient_id) return res.status(403).json({ error: 'Forbidden' });
      }
      if (payload.role === 'PROVIDER') {
        const provider = await db.collection('providers').findOne({ user_id: payload.sub });
        if (!provider || provider._id.toString() !== data.provider_id) return res.status(403).json({ error: 'Forbidden' });
      }

      let prov = null;
      let pat = null;
      if (data.provider_id) {
        prov = await db.collection('providers').findOne({ _id: new ObjectId(data.provider_id) }, { projection: { name: 1 } });
      }
      if (data.patient_id) {
        pat = await db.collection('patients').findOne({ _id: new ObjectId(data.patient_id) }, { projection: { display_name: 1, patient_reference: 1 } });
      }
      
      return res.status(200).json({
        ...data,
        id: data._id.toString(),
        _id: undefined,
        providers: prov ? { name: prov.name } : null,
        patients: pat ? { display_name: pat.display_name, patient_reference: pat.patient_reference } : null,
        items: data.items || [],
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Prescription error:', err);
    res.status(500).json({ error: err.message });
  }
}
