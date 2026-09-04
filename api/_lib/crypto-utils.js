import crypto from 'crypto';

const KEK = process.env.KEY_ENCRYPTION_KEY || 'default-kek-32-chars-long!!!!';

export function canonicalize(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);

  const sortedKeys = Object.keys(obj).sort();
  const result = {};
  for (const key of sortedKeys) {
    const value = obj[key];
    if (value === undefined) continue;
    if (typeof value === 'string') {
      result[key] = value.trim();
    } else if (typeof value === 'object' && value !== null) {
      result[key] = canonicalize(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function canonicalizeToString(obj) {
  const canonical = canonicalize(obj);
  return JSON.stringify(canonical, (key, value) => {
    if (value === undefined) return null;
    return value;
  });
}

export function hashCanonical(canonicalString) {
  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

export function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

export function signCredential(hash, privateKeyPem) {
  return crypto.sign(null, Buffer.from(hash, 'utf8'), privateKeyPem).toString('base64');
}

export function verifySignature(hash, signatureBase64, publicKeyPem) {
  return crypto.verify(null, Buffer.from(hash, 'utf8'), publicKeyPem, Buffer.from(signatureBase64, 'base64'));
}

export function encryptPrivateKey(privateKeyPem) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(KEK.padEnd(32, '0').slice(0, 32)), iv);
  let encrypted = cipher.update(privateKeyPem, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');
  return {
    encrypted_private_key: encrypted,
    iv: iv.toString('base64'),
    auth_tag: authTag,
  };
}

export function decryptPrivateKey(encryptedPrivateKey, iv, authTag) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(KEK.padEnd(32, '0').slice(0, 32)),
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  let decrypted = decipher.update(encryptedPrivateKey, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function generateCredentialId() {
  return crypto.randomUUID();
}

export function generateNonce() {
  return crypto.randomBytes(32).toString('base64url');
}

export function detectTamper(storedHash, recomputedHash) {
  return storedHash !== recomputedHash;
}

export function generateVerificationUrl(credentialId, host = null, protocol = 'http') {
  if (host) {
    return `${protocol}://${host}/verify/${credentialId}`;
  }
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.APP_URL || 'http://localhost:5173');
  return `${baseUrl}/verify/${credentialId}`;
}
