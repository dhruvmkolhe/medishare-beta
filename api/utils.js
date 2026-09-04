import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'medishare-jwt-secret-change-in-production-32bytes');
const REFRESH_SECRET = new TextEncoder().encode(process.env.REFRESH_SECRET || 'medishare-refresh-secret-change-in-production-32bytes');

export const JWT_EXPIRY = '15m';
export const REFRESH_EXPIRY = '7d';

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function createAccessToken(userId, email, role) {
  return new SignJWT({ sub: userId, email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);
}

export async function createRefreshToken(userId) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_EXPIRY)
    .sign(REFRESH_SECRET);
}

export async function verifyAccessToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { clockTolerance: 60 });
    return payload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token) {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET, { clockTolerance: 60 });
    return payload;
  } catch {
    return null;
  }
}

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['PATIENT', 'PROVIDER', 'PHARMACIST', 'ADMIN']),
  name: z.string().min(1),
  licenseNumber: z.string().optional(),
});

export const prescriptionItemSchema = z.object({
  medication: z.string().min(1),
  strength: z.string().min(1),
  dosage: z.string().min(1),
  duration: z.string().min(1),
  timing: z.string().optional().default(''),
  refills: z.number().int().min(0).optional().default(0),
});

export const prescriptionSchema = z.object({
  patientId: z.string(),
  items: z.array(prescriptionItemSchema).min(1),
  notes: z.string().optional().default(''),
});

export const credentialRevokeSchema = z.object({
  reason: z.string().min(1),
});

export const dispensationSchema = z.object({
  credentialId: z.string().uuid(),
  pharmacyName: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  pickupPin: z.string().optional().default(''),
});

export const verifyInitSchema = z.object({
  credentialId: z.string().uuid(),
});

export const verifyExchangeSchema = z.object({
  credentialId: z.string().uuid(),
  nonce: z.string().min(1),
});

const rateLimitMap = new Map();

// Periodic cleanup of stale rate limit entries to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, attempts] of rateLimitMap.entries()) {
      const active = attempts.filter(t => now - t < 15 * 60 * 1000);
      if (active.length === 0) {
        rateLimitMap.delete(key);
      } else {
        rateLimitMap.set(key, active);
      }
    }
  }, 10 * 60 * 1000);
  if (cleanupTimer.unref) cleanupTimer.unref();
}

export function rateLimit(ip, action, maxAttempts, windowMs) {
  const effectiveMax = process.env.NODE_ENV === 'production' ? maxAttempts : Math.max(maxAttempts, 200);
  const key = `${ip}:${action}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  const attempts = rateLimitMap.get(key) || [];
  const recentAttempts = attempts.filter(t => t > windowStart);
  if (recentAttempts.length >= effectiveMax) {
    return false;
  }
  recentAttempts.push(now);
  rateLimitMap.set(key, recentAttempts);
  return true;
}

export function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
}

export function getPath(req) {
  let p = (req.url || '').split('?')[0];
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }
  return p;
}

export function parseCookies(req) {
  const cookie = req.headers.cookie || '';
  const cookies = {};
  cookie.split(';').forEach(c => {
    const [key, val] = c.trim().split('=');
    if (key) cookies[key] = val;
  });
  return cookies;
}

export function setRefreshCookie(res, token) {
  res.setHeader('Set-Cookie', `refresh_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}; Path=/api/auth/refresh`);
}

export function clearRefreshCookie(res) {
  res.setHeader('Set-Cookie', `refresh_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/api/auth/refresh`);
}

export function corsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Defense-in-depth HTTP security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

export async function requireAuth(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  return verifyAccessToken(token);
}

export async function requireRole(req, roles) {
  const payload = await requireAuth(req);
  if (!payload) return null;
  if (!roles.includes(payload.role)) return null;
  return payload;
}

export async function logAudit(db, actorId, action, targetType, targetId, metadata = {}) {
  try {
    await db.collection('audit_logs').insertOne({
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: String(targetId),
      metadata,
      created_at: new Date().toISOString()
    });
  } catch (e) {
    console.error('Audit log error:', e);
  }
}
