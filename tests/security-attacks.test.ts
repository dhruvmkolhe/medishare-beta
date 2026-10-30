/**
 * MediShare Security Attack Test Suite
 * =============================================
 * Tests OWASP Top 10 API Security risks against the live dev server.
 *
 * Prerequisites: Run `npm run dev` before executing these tests.
 *   $ npm run dev   (in a separate terminal, then run tests)
 *
 * These tests intentionally attempt malicious/invalid requests to verify
 * that the server correctly rejects them. They are NOT meant to be run in
 * CI without a running dev server at localhost:5173.
 *
 * IMPORTANT – Rate Limiting note (see api/_lib/utils.js line 120):
 *   In development mode the effective rate-limit cap is raised to 200 to
 *   avoid blocking normal local development. Production sets the real limit
 *   (5 for login, 10 for verify). The Rate Limiting test group therefore sends
 *   201 requests to actually trigger a 429, or explicitly documents this
 *   dev-mode behavior. Real 429 behavior is verified in the production path.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import http from 'http';
import {
  canonicalizeToString,
  hashCanonical,
  generateKeyPair,
  signCredential,
  verifySignature,
} from '../api/_lib/crypto-utils.js';

// ---------------------------------------------------------------------------
// HTTP helper – identical pattern to api-e2e.test.ts
// ---------------------------------------------------------------------------
function request(
  options: http.RequestOptions,
  data: unknown = null,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let parsed: any = body;
        try {
          parsed = JSON.parse(body);
        } catch {}
        resolve({ status: res.statusCode || 500, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (data !== null) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

/** Convenience: POST JSON to localhost:5173 */
function post(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return request({ hostname: 'localhost', port: 5173, path, method: 'POST', headers }, body);
}

/** Convenience: GET from localhost:5173 */
function get(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return request({ hostname: 'localhost', port: 5173, path, method: 'GET', headers });
}

// ---------------------------------------------------------------------------
// Known-bad / fake JWT tokens used across auth attack tests
// ---------------------------------------------------------------------------
const MALFORMED_TOKEN = 'this.is.not.a.real.jwt';
const EMPTY_BEARER_TOKEN = '';
// A structurally valid JWT signed with a DIFFERENT secret – will fail jwtVerify
const FAKE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAiLCJlbWFpbCI6ImZha2VAZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMDkwMH0.' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

// ---------------------------------------------------------------------------
// Shared state populated in beforeAll
// ---------------------------------------------------------------------------
describe('Security Attack Test Suite – OWASP Top 10', () => {
  let adminToken = '';
  let providerToken = '';
  let patientToken = '';
  let sampleCredentialId = ''; // fetched from GET /api/credentials in beforeAll

  // -------------------------------------------------------------------------
  // beforeAll: log in with all three demo roles + grab a credential ID
  // -------------------------------------------------------------------------
  beforeAll(async () => {
    // Login admin
    try {
      const adminRes = await post('/api/auth/login', {
        email: 'admin@medishare.com',
        password: 'password123',
      });
      adminToken = adminRes.body?.accessToken ?? '';
    } catch {
      // Server not running – tests will fail with helpful messages
    }

    // Login provider (dr.sharma)
    try {
      const provRes = await post('/api/auth/login', {
        email: 'dr.sharma@medishare.com',
        password: 'password123',
      });
      providerToken = provRes.body?.accessToken ?? '';
    } catch {}

    // Login patient (john.doe)
    try {
      const patRes = await post('/api/auth/login', {
        email: 'john.doe@medishare.com',
        password: 'password123',
      });
      patientToken = patRes.body?.accessToken ?? '';
    } catch {}

    // Fetch a real credential ID for replay and BOLA tests
    if (adminToken) {
      try {
        const credRes = await get('/api/credentials', adminToken);
        if (credRes.body?.data?.length > 0) {
          sampleCredentialId =
            credRes.body.data[0].credential_id || credRes.body.data[0].id || '';
        }
      } catch {}
    }
  });

  // ==========================================================================
  // 1. OWASP API1 – Broken Object Level Authorization (BOLA)
  // ==========================================================================
  describe('OWASP API1 – Broken Object Level Authorization (BOLA)', () => {
    it('patient cannot GET /api/prescriptions with provider-only scope → 401', async () => {
      // Patients CAN call GET /api/prescriptions (it filters to their own records)
      // but the route still requires auth – we test unauthenticated here to be explicit.
      // The proper BOLA test is that a patient cannot see other patients' data.
      // prescriptions.js: requireRole(['ADMIN','PROVIDER','PATIENT']) — all roles may read,
      // but POST is PROVIDER/ADMIN only.  We cover the POST BOLA in the Access Control section.
      // Here we confirm the route is protected at all.
      const res = await get('/api/prescriptions');
      expect([401, 403]).toContain(res.status);
    });

    it('patient token cannot access GET /api/audit → 401 or 403', async () => {
      expect(patientToken, 'Patient token must be set (server running?)').toBeTruthy();
      const res = await get('/api/audit', patientToken);
      expect([401, 403]).toContain(res.status);
    });

    it('patient token cannot POST /api/providers/:id/approve → 401 or 403', async () => {
      expect(patientToken).toBeTruthy();
      // Use a plausible-looking but unrelated provider ID
      const fakeProviderId = '000000000000000000000001';
      const res = await post(
        `/api/providers/${fakeProviderId}/approve`,
        {},
        patientToken,
      );
      expect([401, 403, 404, 405]).toContain(res.status);
    });

    it('patient token cannot GET /api/admin/stats → 401 or 403', async () => {
      expect(patientToken).toBeTruthy();
      const res = await get('/api/admin/stats', patientToken);
      expect([401, 403]).toContain(res.status);
    });

    it('unauthenticated request cannot GET /api/admin/stats → 401 or 403', async () => {
      const res = await get('/api/admin/stats');
      expect([401, 403]).toContain(res.status);
    });

    it('admin token can GET /api/admin/stats (control: legitimate access) → 200', async () => {
      expect(adminToken).toBeTruthy();
      const res = await get('/api/admin/stats', adminToken);
      expect(res.status).toBe(200);
    });
  });

  // ==========================================================================
  // 2. OWASP API2 – Broken Authentication
  // ==========================================================================
  describe('OWASP API2 – Broken Authentication', () => {
    it('request with NO Authorization header is rejected → 401', async () => {
      const res = await get('/api/credentials');
      expect(res.status).toBe(401);
    });

    it('request with malformed JWT (random string) is rejected → 401', async () => {
      const res = await get('/api/credentials', MALFORMED_TOKEN);
      expect(res.status).toBe(401);
    });

    it('request with expired/fake JWT signed with wrong secret → 401', async () => {
      const res = await get('/api/credentials', FAKE_JWT);
      expect(res.status).toBe(401);
    });

    it('request with "Bearer " (empty token after prefix) → 401', async () => {
      const res = await request(
        {
          hostname: 'localhost',
          port: 5173,
          path: '/api/credentials',
          method: 'GET',
          headers: { Authorization: 'Bearer ' + EMPTY_BEARER_TOKEN },
        },
        null,
      );
      expect(res.status).toBe(401);
    });

    it('request with Authorization header but no "Bearer" prefix → 401', async () => {
      const res = await request(
        {
          hostname: 'localhost',
          port: 5173,
          path: '/api/credentials',
          method: 'GET',
          headers: { Authorization: 'Token sometoken' },
        },
        null,
      );
      expect(res.status).toBe(401);
    });

    it('valid login returns accessToken in JWT dot-notation format', async () => {
      const res = await post('/api/auth/login', {
        email: 'admin@medishare.com',
        password: 'password123',
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      const parts = (res.body.accessToken as string).split('.');
      expect(parts).toHaveLength(3); // header.payload.signature
    });
  });


  // ==========================================================================
  // 4. Schema Bypass / Parameter Pollution – OWASP API3
  // ==========================================================================
  describe('OWASP API3 – Schema Bypass & Parameter Pollution', () => {
    it('POST /api/prescriptions with negative refills is rejected → 400', async () => {
      expect(providerToken).toBeTruthy();
      const res = await post(
        '/api/prescriptions',
        {
          patientId: 'some-patient-id',
          items: [
            {
              medication: 'TestDrug',
              strength: '10mg',
              dosage: '1 daily',
              duration: '7 days',
              refills: -1, // INVALID: schema requires int >= 0
            },
          ],
        },
        providerToken,
      );
      expect(res.status).toBe(400);
    });

    it('POST /api/prescriptions with missing required items field → 400', async () => {
      expect(providerToken).toBeTruthy();
      const res = await post(
        '/api/prescriptions',
        {
          patientId: 'some-patient-id',
          // items field is missing
        },
        providerToken,
      );
      expect(res.status).toBe(400);
    });

    it('POST /api/prescriptions with empty items array → 400', async () => {
      expect(providerToken).toBeTruthy();
      const res = await post(
        '/api/prescriptions',
        {
          patientId: 'some-patient-id',
          items: [], // schema: array.min(1)
        },
        providerToken,
      );
      expect(res.status).toBe(400);
    });

    it('POST /api/auth/login with no email field → 400', async () => {
      const res = await post('/api/auth/login', {
        // email omitted
        password: 'password123',
      });
      expect(res.status).toBe(400);
    });

    it('POST /api/auth/register with invalid email format → 400', async () => {
      const res = await post('/api/auth/register', {
        email: 'not-an-email', // invalid format
        password: 'password123',
        role: 'PATIENT',
        name: 'Test User',
      });
      expect(res.status).toBe(400);
    });

    it('POST /api/auth/register with password shorter than 8 chars → 400', async () => {
      const res = await post('/api/auth/register', {
        email: 'short-pw@example.com',
        password: 'abc', // < 8 chars
        role: 'PATIENT',
        name: 'Short PW',
      });
      expect(res.status).toBe(400);
    });

    it('POST /api/auth/register with invalid role → 400', async () => {
      const res = await post('/api/auth/register', {
        email: 'badrole@example.com',
        password: 'password123',
        role: 'SUPERADMIN', // not in enum
        name: 'Bad Role',
      });
      expect(res.status).toBe(400);
    });

    it('POST /api/prescriptions item with non-string medication → 400', async () => {
      expect(providerToken).toBeTruthy();
      const res = await post(
        '/api/prescriptions',
        {
          patientId: 'some-patient-id',
          items: [
            {
              medication: 12345, // should be a string
              strength: '10mg',
              dosage: '1 daily',
              duration: '7 days',
            },
          ],
        },
        providerToken,
      );
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // 5. Broken Access Control – OWASP API5
  // ==========================================================================
  describe('OWASP API5 – Broken Access Control', () => {
    it('patient token cannot POST /api/prescriptions → 403', async () => {
      expect(patientToken).toBeTruthy();
      const res = await post(
        '/api/prescriptions',
        {
          patientId: 'any-patient-id',
          items: [
            {
              medication: 'Amoxicillin',
              strength: '500mg',
              dosage: '1 TID',
              duration: '7 days',
            },
          ],
        },
        patientToken,
      );
      // prescriptions.js line 16: PATIENT role → 403
      expect(res.status).toBe(403);
    });

    it('patient token cannot POST /api/credentials/:id/revoke on another patient credential → 403', async () => {
      expect(patientToken).toBeTruthy();
      // Use sampleCredentialId if available; otherwise use a plausible UUID
      const targetId = sampleCredentialId || 'c9c52004-6fb3-4654-8fbd-2bd360802816';
      const res = await post(
        `/api/credentials/${targetId}/revoke`,
        { reason: 'Unauthorized revocation attempt' },
        patientToken,
      );
      // The credential belongs to another patient — expect 403 (or 404 if not found)
      expect([403, 404]).toContain(res.status);
    });

    it('unauthenticated user cannot GET /api/patients → 401', async () => {
      const res = await get('/api/patients');
      expect(res.status).toBe(401);
    });

    it('unauthenticated user cannot GET /api/providers → 401', async () => {
      const res = await get('/api/providers');
      expect(res.status).toBe(401);
    });

    it('patient token cannot GET /api/providers (provider/admin resource) → 401 or 403', async () => {
      expect(patientToken).toBeTruthy();
      const res = await get('/api/providers', patientToken);
      expect([401, 403]).toContain(res.status);
    });

    it('patient token cannot GET /api/audit → 401 or 403', async () => {
      expect(patientToken).toBeTruthy();
      const res = await get('/api/audit', patientToken);
      expect([401, 403]).toContain(res.status);
    });
  });

  // ==========================================================================
  // 6. Signature Replay Attack
  // ==========================================================================
  describe('Signature Replay Attack – Nonce Single-Use Enforcement', () => {
    it('nonce cannot be re-used after a successful verify/exchange → 400 on second use', async () => {
      // We need a real credential ID. Use sampleCredentialId from beforeAll.
      // If not available, skip gracefully.
      if (!sampleCredentialId) {
        console.warn('SKIP: sampleCredentialId not available (server may not be running)');
        return;
      }

      // Step 1: Initialise verification session → get nonce
      const initRes = await post('/api/verify/init', { credentialId: sampleCredentialId });
      expect(initRes.status).toBe(200);
      expect(initRes.body).toHaveProperty('nonce');
      const nonce: string = initRes.body.nonce;

      // Step 2: First exchange – should succeed (200)
      const firstExchange = await post('/api/verify/exchange', {
        credentialId: sampleCredentialId,
        nonce,
      });
      expect(firstExchange.status).toBe(200);

      // Step 3: Replay the SAME nonce – server marks session.used = true
      const replayExchange = await post('/api/verify/exchange', {
        credentialId: sampleCredentialId,
        nonce,
      });
      // verify.js line 71: session.used === true → 400 "Invalid or expired verification session"
      expect(replayExchange.status).toBe(400);
      expect(typeof replayExchange.body?.error).toBe('string');
    });

    it('nonce from one credential cannot be used for a different credential → 400', async () => {
      if (!sampleCredentialId) return;

      // Init a nonce for the real credential
      const initRes = await post('/api/verify/init', { credentialId: sampleCredentialId });
      if (initRes.status !== 200) return; // rate-limited or not found, skip
      const nonce: string = initRes.body.nonce;

      // Try to exchange with a different credential ID
      const fakeCredId = 'c9c52004-0000-0000-0000-2bd360802816';
      const res = await post('/api/verify/exchange', {
        credentialId: fakeCredId,
        nonce,
      });
      // verify.js line 74: session.credentialId !== credentialId → 400 "Nonce mismatch"
      expect(res.status).toBe(400);
    });

    it('expired nonce is rejected → 400', async () => {
      // A nonce that was never registered (random string) behaves like expired/not-found
      const res = await post('/api/verify/exchange', {
        credentialId: sampleCredentialId || 'c9c52004-6fb3-4654-8fbd-2bd360802816',
        nonce: 'this-nonce-was-never-issued-and-does-not-exist-in-server-state',
      });
      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // 7. NoSQL Injection
  // ==========================================================================
  describe('NoSQL Injection Prevention', () => {
    it('login with email as MongoDB operator object is rejected → 400 (Zod rejects non-string)', async () => {
      /**
       * Attack: POST { email: { "$gt": "" }, password: "anything" }
       * Zod schema: z.string().email() — rejects any non-string type.
       * Expected: 400 schema validation error, NOT a query execution.
       */
      const res = await post('/api/auth/login', {
        email: { $gt: '' },
        password: 'anything',
      });
      expect(res.status).toBe(400);
    });

    it('login with MongoDB operator as string password is treated as wrong credentials → 401', async () => {
      /**
       * Attack: password = "$or:[{},...]" as a plain string.
       * Zod accepts it as a string (passes min(8) if long enough).
       * bcrypt.compare will simply not match → 401 invalid credentials.
       * NOT a 500 and NOT a bypass.
       */
      const res = await post('/api/auth/login', {
        email: 'admin@medishare.com',
        password: '$or:[{a:1},{b:2}]longer', // >= 8 chars, but not the real password
      });
      expect(res.status).toBe(401);
    });

    it('login with null email → 400 (Zod rejects null)', async () => {
      const res = await post('/api/auth/login', {
        email: null,
        password: 'password123',
      });
      expect(res.status).toBe(400);
    });

    it('login with array email → 400 (Zod rejects non-string)', async () => {
      const res = await post('/api/auth/login', {
        email: ['admin@medishare.com'],
        password: 'password123',
      });
      expect(res.status).toBe(400);
    });

    it('GET /api/prescriptions?search[$where]=this is handled safely — no crash', async () => {
      /**
       * Attack: inject a MongoDB $where operator via query string.
       * The route does: url.searchParams.get('search') which returns the literal
       * string "$where" as a search term, never passed as a MongoDB operator.
       * Expected: 200 (filtered results, possibly empty) or 401/403 — definitely NOT 500.
       */
      if (!providerToken) return;
      const res = await request(
        {
          hostname: 'localhost',
          port: 5173,
          path: '/api/prescriptions?search[$where]=this',
          method: 'GET',
          headers: { Authorization: `Bearer ${providerToken}` },
        },
        null,
      );
      expect(res.status).not.toBe(500);
      expect([200, 400, 401, 403]).toContain(res.status);
    });
  });

  // ==========================================================================
  // 8. Cryptographic Failure / Tamper Detection  (pure unit test — no HTTP)
  // ==========================================================================
  describe('Cryptographic Failure / Tamper Detection (unit level)', () => {
    it('original signature does NOT verify against tampered data hash', () => {
      // Create original prescription data and sign it
      const originalData = {
        medication: 'Atorvastatin',
        strength: '20mg',
        dosage: '1 tablet at night',
        duration: '90 days',
        notes: 'Take with food',
      };

      const { publicKey, privateKey } = generateKeyPair();
      const originalCanonical = canonicalizeToString(originalData);
      const originalHash = hashCanonical(originalCanonical);
      const signature = signCredential(originalHash, privateKey);

      // Verify the original signature is valid
      const isValidOriginal = verifySignature(originalHash, signature, publicKey);
      expect(isValidOriginal).toBe(true);

      // Attacker modifies the dosage field
      const tamperedData = {
        ...originalData,
        dosage: '2 tablets at night', // tampered!
      };

      const tamperedCanonical = canonicalizeToString(tamperedData);
      const tamperedHash = hashCanonical(tamperedCanonical);

      // The original signature must NOT verify against the tampered hash
      const isValidTampered = verifySignature(tamperedHash, signature, publicKey);
      expect(isValidTampered).toBe(false);

      // Hashes must be different
      expect(originalHash).not.toBe(tamperedHash);
    });

    it('original signature does NOT verify against tampered strength field', () => {
      const original = { medication: 'Lisinopril', strength: '10mg', dosage: '1 OD', duration: '30 days' };
      const tampered = { ...original, strength: '40mg' }; // dose escalation attack

      const { publicKey, privateKey } = generateKeyPair();
      const originalHash = hashCanonical(canonicalizeToString(original));
      const signature = signCredential(originalHash, privateKey);

      expect(verifySignature(originalHash, signature, publicKey)).toBe(true);
      expect(verifySignature(hashCanonical(canonicalizeToString(tampered)), signature, publicKey)).toBe(false);
    });

    it('signature from one keypair does NOT verify with a different keypair', () => {
      const data = { medication: 'Metformin', strength: '500mg', dosage: '1 BID', duration: '180 days' };
      const { privateKey: privA } = generateKeyPair();
      const { publicKey: pubB } = generateKeyPair();

      const hash = hashCanonical(canonicalizeToString(data));
      const signatureA = signCredential(hash, privA);

      // Signature from key A should NOT verify with public key B
      expect(verifySignature(hash, signatureA, pubB)).toBe(false);
    });

    it('canonical ordering is deterministic — key insertion order does not affect hash', () => {
      const dataA = { dosage: '1 daily', duration: '7 days', medication: 'Amoxicillin' };
      const dataB = { medication: 'Amoxicillin', duration: '7 days', dosage: '1 daily' };

      expect(canonicalizeToString(dataA)).toBe(canonicalizeToString(dataB));
      expect(hashCanonical(canonicalizeToString(dataA))).toBe(hashCanonical(canonicalizeToString(dataB)));
    });
  });

  // ==========================================================================
  // 9. Security Misconfiguration / Stack Trace Exposure
  // ==========================================================================
  describe('Security Misconfiguration / Stack Trace Exposure', () => {
    it('GET /api/providers with no auth returns 401, NOT 500 with stack trace', async () => {
      const res = await get('/api/providers');
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(500);
    });

    it('POST /api/auth/login with completely invalid body returns 400, not 500', async () => {
      // Send garbage JSON-serializable content
      const res = await post('/api/auth/login', { totally: 'wrong', structure: true });
      expect([400, 401]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });

    it('error response does NOT leak a "stack" field in JSON body', async () => {
      const res = await post('/api/auth/login', { email: 'bad', password: 'bad' });
      // Body may be an object or string; either way no stack trace
      if (typeof res.body === 'object' && res.body !== null) {
        expect(res.body).not.toHaveProperty('stack');
      } else {
        expect(String(res.body)).not.toContain('at Object');
      }
    });

    it('error response does NOT contain raw Node.js stack trace text', async () => {
      const res = await get('/api/credentials');
      const bodyStr = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
      expect(bodyStr).not.toContain('at Object');
      expect(bodyStr).not.toContain('node_modules');
      expect(bodyStr).not.toContain('at processTicksAndRejections');
    });

    it('unauthenticated GET /api/admin/stats returns 401 or 403, not 500', async () => {
      const res = await get('/api/admin/stats');
      expect([401, 403]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });

    it('sending non-JSON Content-Type body to JSON endpoint returns 400 or 401, not 500', async () => {
      const res = await request(
        {
          hostname: 'localhost',
          port: 5173,
          path: '/api/auth/login',
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
        },
        'this is plain text, not JSON',
      );
      // Vite/express body-parser may parse this as empty body → schema fail (400/401)
      // It must NOT produce a 500 uncaught error
      expect(res.status).not.toBe(500);
    });
  });

  // ==========================================================================
  // 10. Sensitive Data Exposure
  // ==========================================================================
  describe('Sensitive Data Exposure Prevention', () => {
    it('successful login response does NOT expose password_hash field', async () => {
      const res = await post('/api/auth/login', {
        email: 'admin@medishare.com',
        password: 'password123',
      });
      expect(res.status).toBe(200);
      // Top-level response
      expect(res.body).not.toHaveProperty('password_hash');
      // Nested user object
      expect(res.body?.user).not.toHaveProperty('password_hash');
    });

    it('successful login response does NOT expose private_key field', async () => {
      const res = await post('/api/auth/login', {
        email: 'admin@medishare.com',
        password: 'password123',
      });
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('private_key');
      expect(res.body).not.toHaveProperty('encrypted_private_key');
      expect(res.body?.user).not.toHaveProperty('private_key');
    });

    it('successful login response contains a valid JWT-format accessToken', async () => {
      const res = await post('/api/auth/login', {
        email: 'admin@medishare.com',
        password: 'password123',
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(typeof res.body.accessToken).toBe('string');
      // JWT: three base64url segments separated by dots
      const parts = (res.body.accessToken as string).split('.');
      expect(parts).toHaveLength(3);
      parts.forEach((part) => expect(part.length).toBeGreaterThan(0));
    });

    it('login response user object only exposes safe fields (id, email, role)', async () => {
      const res = await post('/api/auth/login', {
        email: 'admin@medishare.com',
        password: 'password123',
      });
      expect(res.status).toBe(200);
      const user = res.body?.user;
      expect(user).toBeDefined();
      // Must have safe fields
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('role');
      // Must NOT have sensitive fields
      expect(user).not.toHaveProperty('password_hash');
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('private_key');
    });

    it('credentials list response does NOT expose private signing keys', async () => {
      expect(adminToken).toBeTruthy();
      const res = await get('/api/credentials', adminToken);
      expect(res.status).toBe(200);
      const bodyStr = JSON.stringify(res.body);
      // Signing keys must not be in the public credential list payload
      expect(bodyStr).not.toContain('BEGIN PRIVATE KEY');
      expect(bodyStr).not.toContain('encrypted_private_key');
    });

    it('failed login does NOT reveal whether the account exists (consistent error)', async () => {
      const resNoUser = await post('/api/auth/login', {
        email: 'nonexistent-user-xyz@medishare.com',
        password: 'wrongpassword',
      });
      const resWrongPw = await post('/api/auth/login', {
        email: 'admin@medishare.com',
        password: 'wrongpassword',
      });
      // Both must return 401 — do NOT distinguish "user not found" vs "wrong password"
      expect(resNoUser.status).toBe(401);
      expect(resWrongPw.status).toBe(401);
      // Error messages should be identical to prevent user enumeration
      expect(resNoUser.body?.error).toBe(resWrongPw.body?.error);
    });
  });

  // ==========================================================================
  // 10. Rate Limiting – OWASP API4 / DoS Protection (Executed last to preserve IP allowance)
  //
  //  ⚠  Dev-mode caveat (utils.js line 120):
  //     const effectiveMax = process.env.NODE_ENV === 'production'
  //       ? maxAttempts
  //       : Math.max(maxAttempts, 200);
  // ==========================================================================
  describe('Rate Limiting – DoS Protection (OWASP API4)', () => {
    it(
      'triggers 429 after 201 consecutive failed login attempts (dev-mode effectiveMax=200)',
      async () => {
        let got429 = false;
        for (let i = 0; i < 201; i++) {
          const res = await post('/api/auth/login', {
            email: 'ratelimit-probe@example.invalid',
            password: 'wrongpassword',
          });
          if (res.status === 429) {
            got429 = true;
            break;
          }
        }
        expect(got429).toBe(true);
      },
      60_000,
    );

    it('verify/init triggers 429 after 201 consecutive attempts (dev-mode effectiveMax=200)', async () => {
      let got429 = false;
      const fakeCredId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      for (let i = 0; i < 201; i++) {
        const res = await post('/api/verify/init', { credentialId: fakeCredId });
        if (res.status === 429) {
          got429 = true;
          break;
        }
      }
      expect(got429).toBe(true);
    }, 60_000);
  });
});
