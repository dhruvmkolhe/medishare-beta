import getDb from '../_lib/db-client.js';
import { ObjectId } from 'mongodb';
import {
  hashPassword, comparePassword, createAccessToken, createRefreshToken, verifyRefreshToken,
  loginSchema, registerSchema, corsHeaders, setRefreshCookie, clearRefreshCookie, getClientIp, rateLimit, logAudit, getPath, parseCookies
} from '../_lib/utils.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const db = await getDb();

    if (req.method === 'POST' && getPath(req) === '/api/auth/register') {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const { email, password, role, name, licenseNumber } = parsed.data;

      const existing = await db.collection('users').findOne({ email });
      if (existing) return res.status(409).json({ error: 'Email already registered' });

      const passwordHash = await hashPassword(password);
      
      const insertResult = await db.collection('users').insertOne({
        email,
        password_hash: passwordHash,
        role,
        created_at: new Date().toISOString()
      });
      const newUserId = insertResult.insertedId.toHexString();

      if (role === 'PATIENT') {
        await db.collection('patients').insertOne({
          user_id: newUserId,
          patient_reference: `PAT-${newUserId.slice(0, 8)}`,
          display_name: name,
        });
      } else if (role === 'PROVIDER') {
        await db.collection('providers').insertOne({
          user_id: newUserId,
          name,
          license_number: licenseNumber || 'PENDING',
        });
      }

      await logAudit(db, newUserId, 'USER_REGISTERED', 'user', newUserId, { role });
      return res.status(201).json({ id: newUserId, email, role });
    }

    if (req.method === 'POST' && getPath(req) === '/api/auth/login') {
      const ip = getClientIp(req);
      if (!rateLimit(ip, 'login', 5, 60 * 1000)) {
        return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
      }

      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const { email, password } = parsed.data;

      const user = await db.collection('users').findOne({ email });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      const userIdStr = user._id.toHexString();

      const valid = await comparePassword(password, user.password_hash);
      if (!valid) {
        await logAudit(db, userIdStr, 'LOGIN_FAILED', 'user', userIdStr, {});
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const accessToken = await createAccessToken(userIdStr, user.email, user.role);
      const refreshToken = await createRefreshToken(userIdStr);
      setRefreshCookie(res, refreshToken);

      await logAudit(db, userIdStr, 'LOGIN_SUCCESS', 'user', userIdStr, {});
      return res.status(200).json({ accessToken, user: { id: userIdStr, email: user.email, role: user.role } });
    }

    if (req.method === 'POST' && getPath(req) === '/api/auth/refresh') {
      const refreshToken = parseCookies(req).refresh_token;
      if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

      const payload = await verifyRefreshToken(refreshToken);
      if (!payload) return res.status(401).json({ error: 'Invalid refresh token' });

      let user = null;
      try {
        user = await db.collection('users').findOne({ _id: new ObjectId(payload.sub) });
      } catch {
        clearRefreshCookie(res);
        return res.status(401).json({ error: 'Invalid user session' });
      }
      if (!user) {
        clearRefreshCookie(res);
        return res.status(401).json({ error: 'User not found' });
      }

      const userIdStr = user._id.toHexString();

      const newAccessToken = await createAccessToken(userIdStr, user.email, user.role);
      const newRefreshToken = await createRefreshToken(userIdStr);
      setRefreshCookie(res, newRefreshToken);

      return res.status(200).json({ accessToken: newAccessToken, user: { id: userIdStr, email: user.email, role: user.role } });
    }

    if (req.method === 'POST' && getPath(req) === '/api/auth/logout') {
      clearRefreshCookie(res);
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: err.message });
  }
}
