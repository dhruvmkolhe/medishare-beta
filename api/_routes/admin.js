import getDb from '../_lib/db-client.js';
import { ObjectId } from 'mongodb';
import { corsHeaders, requireRole, logAudit, getPath } from '../_lib/utils.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const payload = await requireRole(req, ['ADMIN']);
    if (!payload) return res.status(403).json({ error: 'Forbidden' });

    const db = await getDb();

    if (req.method === 'GET' && getPath(req) === '/api/admin/stats') {
      const totalUsers = await db.collection('users').countDocuments();
      const totalProviders = await db.collection('providers').countDocuments();
      const approvedProviders = await db.collection('providers').countDocuments({ approved_at: { $exists: true, $ne: null } });
      const totalCredentials = await db.collection('credentials').countDocuments();
      const activeCredentials = await db.collection('credentials').countDocuments({ status: 'ACTIVE' });
      const revokedCredentials = await db.collection('credentials').countDocuments({ status: 'REVOKED' });
      const totalVerifications = await db.collection('verification_events').countDocuments();
      const passedVerifications = await db.collection('verification_events').countDocuments({ result: 'PASS' });

      const stats = {
        totalUsers,
        totalProviders,
        approvedProviders,
        totalCredentials,
        activeCredentials,
        revokedCredentials,
        totalVerifications,
        passedVerifications,
      };
      return res.status(200).json(stats);
    }

    if (req.method === 'GET' && getPath(req) === '/api/admin/users') {
      const users = await db.collection('users').find({}).sort({ created_at: -1 }).toArray();
      const mapped = users.map(u => ({
        id: u._id.toHexString(),
        email: u.email,
        role: u.role,
        created_at: u.created_at
      }));
      return res.status(200).json(mapped);
    }

    if (req.method === 'PUT' && getPath(req).startsWith('/api/admin/users/') && getPath(req).endsWith('/role')) {
      const userId = getPath(req).split('/')[4];
      const { role } = req.body;
      if (!['PATIENT', 'PROVIDER', 'PHARMACIST', 'ADMIN'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      
      await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: { role } });
      await logAudit(db, payload.sub, 'USER_ROLE_CHANGED', 'user', userId, { new_role: role });
      return res.status(200).json({ ok: true });
    }

    // ------------------------------------------------------------------
    // GET /api/admin/security-alerts
    // Returns paginated security alerts (impossible travel, rapid re-verification).
    // Optional query params:
    //   ?reviewed=false  — only unreviewed alerts (default: all)
    //   ?reviewed=true   — only reviewed alerts
    //   ?page=1&limit=20
    // ------------------------------------------------------------------
    if (req.method === 'GET' && getPath(req) === '/api/admin/security-alerts') {
      if (payload?.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });

      const url = new URL(req.url, 'http://localhost');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
      const reviewed = url.searchParams.get('reviewed');

      const query = {};
      if (reviewed === 'false') query.reviewed = false;
      if (reviewed === 'true') query.reviewed = true;

      const total = await db.collection('security_alerts').countDocuments(query);
      const alerts = await db
        .collection('security_alerts')
        .find(query)
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      return res.status(200).json({ data: alerts, total, page, limit });
    }

    // ------------------------------------------------------------------
    // POST /api/admin/security-alerts/:id/review
    // Marks a specific security alert as reviewed by the acting admin.
    // ------------------------------------------------------------------
    if (req.method === 'POST' && getPath(req).match(/^\/api\/admin\/security-alerts\/[^/]+\/review$/)) {
      if (payload?.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });

      const alertId = getPath(req).split('/')[4];
      if (!ObjectId.isValid(alertId)) {
        return res.status(400).json({ error: 'Invalid alert ID' });
      }

      await db.collection('security_alerts').updateOne(
        { _id: new ObjectId(alertId) },
        {
          $set: {
            reviewed: true,
            reviewed_at: new Date().toISOString(),
            reviewed_by: payload.sub, // ID of the admin who reviewed
          },
        }
      );

      await logAudit(db, payload.sub, 'SECURITY_ALERT_REVIEWED', 'security_alert', alertId, {});
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Admin error:', err);
    res.status(500).json({ error: err.message });
  }
}
