import getDb from '../db-client.js';
import { ObjectId } from 'mongodb';
import { corsHeaders, requireRole, getPath } from '../utils.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const payload = await requireRole(req, ['ADMIN', 'PROVIDER', 'PATIENT']);
    if (!payload) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    if (req.method === 'GET' && getPath(req) === '/api/patients') {
      let filter = {};
      if (payload.role === 'PATIENT') {
        filter.user_id = payload.sub;
      }
      const patients = await db.collection('patients').find(filter).sort({ created_at: -1 }).toArray();
      const userIds = patients.map(p => p.user_id).filter(Boolean);
      const users = await db.collection('users').find({ _id: { $in: userIds.map(id => new ObjectId(id)) } }, { projection: { email: 1 } }).toArray();
      
      const enriched = patients.map(p => {
        const u = users.find(u => u._id.toString() === p.user_id);
        return {
          ...p,
          id: p._id.toString(),
          _id: undefined,
          users: u ? { email: u.email } : null,
        };
      });
      return res.status(200).json(enriched);
    }

    if (req.method === 'GET' && getPath(req).startsWith('/api/patients/')) {
      const id = getPath(req).split('/')[3];
      if (!ObjectId.isValid(id) || id.length !== 24) {
        return res.status(404).json({ error: 'Patient not found' });
      }
      const patient = await db.collection('patients').findOne({ _id: new ObjectId(id) });
      if (!patient) return res.status(404).json({ error: 'Patient not found' });
      if (payload.role === 'PATIENT' && patient.user_id !== payload.sub) return res.status(403).json({ error: 'Forbidden' });
      
      let user = null;
      if (patient.user_id && ObjectId.isValid(patient.user_id) && patient.user_id.length === 24) {
        user = await db.collection('users').findOne({ _id: new ObjectId(patient.user_id) }, { projection: { email: 1 } });
      }
      return res.status(200).json({
        ...patient,
        id: patient._id.toString(),
        _id: undefined,
        users: user ? { email: user.email } : null
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Patient error:', err);
    res.status(500).json({ error: err.message });
  }
}
