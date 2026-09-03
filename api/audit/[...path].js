import getDb from '../db-client.js';
import { ObjectId } from 'mongodb';
import { corsHeaders, requireRole, getPath } from '../utils.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const payload = await requireRole(req, ['ADMIN', 'PROVIDER']);
    if (!payload) return res.status(401).json({ error: 'Unauthorized' });

    const db = await getDb();

    if (req.method === 'GET' && getPath(req) === '/api/audit') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const action = url.searchParams.get('action') || '';
      const fromParam = url.searchParams.get('from') || '';
      const toParam = url.searchParams.get('to') || '';
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      let query = {};

      if (payload.role === 'PROVIDER') {
        query.actor_id = payload.sub;
      }

      if (action) {
        query.action = action;
      }
      if (fromParam || toParam) {
        query.created_at = {};
        if (fromParam) query.created_at.$gte = fromParam;
        if (toParam) query.created_at.$lte = toParam;
      }

      const skip = (page - 1) * limit;

      const total = await db.collection('audit_logs').countDocuments(query);
      const data = await db.collection('audit_logs').find(query).sort({ created_at: -1 }).skip(skip).limit(limit).toArray();
      
      const mappedData = data.map(d => {
        const item = { ...d, id: d._id.toHexString() };
        delete item._id;
        return item;
      });

      return res.status(200).json({ data: mappedData, total, page, limit });
    }

    if (req.method === 'GET' && getPath(req) === '/api/audit/credentials') {
      if (payload.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
      
      const data = await db.collection('audit_logs').find({ target_type: 'credential' }).sort({ created_at: -1 }).limit(200).toArray();
      
      const mappedData = data.map(d => {
        const item = { ...d, id: d._id.toHexString() };
        delete item._id;
        return item;
      });

      return res.status(200).json(mappedData);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Audit error:', err);
    res.status(500).json({ error: err.message });
  }
}
