import getDb from '../db-client.js';
import { ObjectId } from 'mongodb';
import { corsHeaders, requireRole, logAudit, getPath } from '../utils.js';
import { generateKeyPair, encryptPrivateKey } from '../crypto-utils.js';
import { z } from 'zod';

const approveSchema = z.object({
  approvedBy: z.string(),
});

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const payload = await requireRole(req, ['ADMIN', 'PROVIDER']);
    const db = await getDb();

    if (req.method === 'GET' && getPath(req) === '/api/providers') {
      const providers = await db.collection('providers').find({}).sort({ created_at: -1 }).toArray();
      const userIds = providers.map(p => p.user_id).filter(Boolean);
      const users = await db.collection('users').find({ _id: { $in: userIds.map(id => new ObjectId(id)) } }, { projection: { email: 1 } }).toArray();
      
      const enriched = providers.map(p => {
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

    if (req.method === 'GET' && getPath(req) === '/api/providers/pending') {
      const auth = await requireRole(req, ['ADMIN']);
      if (!auth) return res.status(403).json({ error: 'Forbidden' });
      
      const providers = await db.collection('providers').find({ approved_at: null }).sort({ created_at: -1 }).toArray();
      const userIds = providers.map(p => p.user_id).filter(Boolean);
      const users = await db.collection('users').find({ _id: { $in: userIds.map(id => new ObjectId(id)) } }, { projection: { email: 1 } }).toArray();
      
      const enriched = providers.map(p => {
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

    if (req.method === 'GET' && getPath(req).startsWith('/api/providers/') && !getPath(req).endsWith('/keys') && !getPath(req).endsWith('/pending')) {
      const id = getPath(req).split('/')[3];
      if (!ObjectId.isValid(id) || id.length !== 24) {
        return res.status(404).json({ error: 'Provider not found' });
      }
      const provider = await db.collection('providers').findOne({ _id: new ObjectId(id) });
      if (!provider) return res.status(404).json({ error: 'Provider not found' });
      let user = null;
      if (provider.user_id && ObjectId.isValid(provider.user_id) && provider.user_id.length === 24) {
        user = await db.collection('users').findOne({ _id: new ObjectId(provider.user_id) }, { projection: { email: 1 } });
      }
      return res.status(200).json({
        ...provider,
        id: provider._id.toString(),
        _id: undefined,
        users: user ? { email: user.email } : null
      });
    }

    if (req.method === 'PUT' && getPath(req).startsWith('/api/providers/') && getPath(req).endsWith('/approve')) {
      const auth = await requireRole(req, ['ADMIN']);
      if (!auth) return res.status(403).json({ error: 'Forbidden' });
      
      const id = getPath(req).split('/')[3];
      const parsed = approveSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

      if (!ObjectId.isValid(id) || id.length !== 24) {
        return res.status(404).json({ error: 'Provider not found' });
      }
      const provider = await db.collection('providers').findOne({ _id: new ObjectId(id) });
      if (!provider) return res.status(404).json({ error: 'Provider not found' });

      const now = new Date().toISOString();
      await db.collection('providers').updateOne({ _id: new ObjectId(id) }, { $set: { approved_at: now, approved_by: parsed.data.approvedBy } });

      const { privateKey, publicKey } = generateKeyPair();
      const encrypted = encryptPrivateKey(privateKey);

      await db.collection('issuer_keys').insertOne({
        provider_id: id,
        public_key: publicKey,
        encrypted_private_key: encrypted.encrypted_private_key,
        iv: encrypted.iv,
        auth_tag: encrypted.auth_tag,
        is_active: true,
        created_at: new Date().toISOString(),
      });

      await logAudit(db, parsed.data.approvedBy, 'PROVIDER_APPROVED', 'provider', id, {});
      return res.status(200).json({ ok: true, approvedAt: now });
    }

    if (req.method === 'PUT' && getPath(req).startsWith('/api/providers/') && getPath(req).endsWith('/keys')) {
      const auth = await requireRole(req, ['ADMIN', 'PROVIDER']);
      if (!auth) return res.status(403).json({ error: 'Forbidden' });
      
      const id = getPath(req).split('/')[3];
      if (!ObjectId.isValid(id) || id.length !== 24) {
        return res.status(404).json({ error: 'Provider not found' });
      }
      const provider = await db.collection('providers').findOne({ _id: new ObjectId(id) }, { projection: { user_id: 1 } });
      if (!provider) return res.status(404).json({ error: 'Provider not found' });
      if (auth.role === 'PROVIDER' && provider.user_id !== auth.sub) return res.status(403).json({ error: 'Forbidden' });

      await db.collection('issuer_keys').updateMany(
        { provider_id: id, is_active: true },
        { $set: { is_active: false, rotated_at: new Date().toISOString() } }
      );

      const { privateKey, publicKey } = generateKeyPair();
      const encrypted = encryptPrivateKey(privateKey);

      const result = await db.collection('issuer_keys').insertOne({
        provider_id: id,
        public_key: publicKey,
        encrypted_private_key: encrypted.encrypted_private_key,
        iv: encrypted.iv,
        auth_tag: encrypted.auth_tag,
        is_active: true,
        created_at: new Date().toISOString(),
      });
      const keyId = result.insertedId.toString();

      await logAudit(db, auth.sub, 'KEY_ROTATED', 'issuer_key', keyId, { provider_id: id });
      return res.status(200).json({ ok: true, keyId });
    }

    if (req.method === 'GET' && getPath(req).startsWith('/api/providers/') && getPath(req).endsWith('/keys')) {
      const auth = await requireRole(req, ['ADMIN', 'PROVIDER']);
      if (!auth) return res.status(403).json({ error: 'Forbidden' });
      
      const id = getPath(req).split('/')[3];
      if (!ObjectId.isValid(id) || id.length !== 24) {
        return res.status(404).json({ error: 'Provider not found' });
      }
      const provider = await db.collection('providers').findOne({ _id: new ObjectId(id) }, { projection: { user_id: 1 } });
      if (!provider) return res.status(404).json({ error: 'Provider not found' });
      if (auth.role === 'PROVIDER' && provider.user_id !== auth.sub) return res.status(403).json({ error: 'Forbidden' });

      const keys = await db.collection('issuer_keys').find({ provider_id: id }).sort({ created_at: -1 }).toArray();
      const mapped = keys.map(k => ({
        id: k._id.toString(),
        public_key: k.public_key,
        is_active: k.is_active,
        created_at: k.created_at,
        rotated_at: k.rotated_at,
      }));
      return res.status(200).json(mapped);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Provider error:', err);
    res.status(500).json({ error: err.message });
  }
}
