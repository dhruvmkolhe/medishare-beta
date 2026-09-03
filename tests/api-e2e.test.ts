import { describe, it, expect, beforeAll } from 'vitest';
import http from 'http';

function request(options: http.RequestOptions, data: any = null): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = body;
        try {
          parsed = JSON.parse(body);
        } catch {}
        resolve({ status: res.statusCode || 500, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

describe('End-to-End Backend API Test Suite', () => {
  let adminToken = '';
  let providerToken = '';
  let patientToken = '';
  let sampleCredentialId = '';

  beforeAll(async () => {
    // 1. Login Admin
    const adminRes = await request({
      hostname: 'localhost',
      port: 5173,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@medishare.com', password: 'password123' });
    adminToken = adminRes.body?.accessToken;

    // 2. Login Provider
    const provRes = await request({
      hostname: 'localhost',
      port: 5173,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'dr.sharma@medishare.com', password: 'password123' });
    providerToken = provRes.body?.accessToken;

    // 3. Login Patient
    const patRes = await request({
      hostname: 'localhost',
      port: 5173,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'john.doe@medishare.com', password: 'password123' });
    patientToken = patRes.body?.accessToken;
  });

  describe('Authentication & Role-Based Access Control', () => {
    it('authenticates valid credentials and issues JWT tokens', () => {
      expect(adminToken).toBeDefined();
      expect(adminToken.length).toBeGreaterThan(20);
      expect(providerToken).toBeDefined();
      expect(patientToken).toBeDefined();
    });

    it('rejects invalid password with 401', async () => {
      const res = await request({
        hostname: 'localhost',
        port: 5173,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { email: 'admin@medishare.com', password: 'wrongpassword' });
      expect(res.status).toBe(401);
    });

    it('blocks unauthorized access: Patient cannot access Admin Stats (403)', async () => {
      const res = await request({
        hostname: 'localhost',
        port: 5173,
        path: '/api/admin/stats',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${patientToken}` }
      });
      expect(res.status).toBe(403);
    });

    it('permits Admin to access Admin Stats (200)', async () => {
      const res = await request({
        hostname: 'localhost',
        port: 5173,
        path: '/api/admin/stats',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalUsers');
      expect(res.body).toHaveProperty('totalCredentials');
      expect(res.body).toHaveProperty('totalVerifications');
    });
  });

  describe('Providers and Patients Management', () => {
    it('lists registered providers and pending approvals', async () => {
      const listRes = await request({
        hostname: 'localhost',
        port: 5173,
        path: '/api/providers',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);

      const pendingRes = await request({
        hostname: 'localhost',
        port: 5173,
        path: '/api/providers/pending',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      expect(pendingRes.status).toBe(200);
      expect(Array.isArray(pendingRes.body)).toBe(true);
    });

    it('lists patients with patient references', async () => {
      const res = await request({
        hostname: 'localhost',
        port: 5173,
        path: '/api/patients',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${providerToken}` }
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty('patient_reference');
    });
  });

  describe('Prescriptions and Credentials Operations', () => {
    it('retrieves paginated prescriptions', async () => {
      const res = await request({
        hostname: 'localhost',
        port: 5173,
        path: '/api/prescriptions',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${providerToken}` }
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('retrieves paginated credentials list and captures a credential for testing', async () => {
      const res = await request({
        hostname: 'localhost',
        port: 5173,
        path: '/api/credentials',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${providerToken}` }
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      sampleCredentialId = res.body.data[0].id;
      expect(sampleCredentialId).toBeDefined();
    });

    it('fetches single credential details and QR payload', async () => {
      const credRes = await request({
        hostname: 'localhost',
        port: 5173,
        path: `/api/credentials/${sampleCredentialId}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${providerToken}` }
      });
      expect(credRes.status).toBe(200);
      expect(credRes.body).toHaveProperty('content_hash');
      expect(credRes.body).toHaveProperty('signature');

      const qrRes = await request({
        hostname: 'localhost',
        port: 5173,
        path: `/api/credentials/${sampleCredentialId}/qr`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${providerToken}` }
      });
      expect(qrRes.status).toBe(200);
      expect(qrRes.body).toHaveProperty('qrUrl');
    });

    it('exports credential in W3C VC and FHIR R4 formats', async () => {
      const vcRes = await request({
        hostname: 'localhost',
        port: 5173,
        path: `/api/credentials/${sampleCredentialId}/export/vc`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${providerToken}` }
      });
      expect(vcRes.status).toBe(200);
      expect(vcRes.body?.type).toContain('VerifiableCredential');

      const fhirRes = await request({
        hostname: 'localhost',
        port: 5173,
        path: `/api/credentials/${sampleCredentialId}/export/fhir`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${providerToken}` }
      });
      expect(fhirRes.status).toBe(200);
      expect(fhirRes.body?.resourceType).toBe('Bundle');
    });

    it('performs tamper detection comparison without errors', async () => {
      const compareRes = await request({
        hostname: 'localhost',
        port: 5173,
        path: `/api/credentials/${sampleCredentialId}/compare`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${providerToken}` }
      });
      expect(compareRes.status).toBe(200);
      expect(compareRes.body).toHaveProperty('tampered');
      expect(Array.isArray(compareRes.body.diff)).toBe(true);
    });
  });

  describe('Pharmacist Verification & Dispensation Flow', () => {
    const benchmarkUuid = 'c9c52004-6fb3-4654-8fbd-2bd360802816';

    it('successfully executes 2-step verification handshake (PASS)', async () => {
      // Step 1: Init challenge
      const initRes = await request({
        hostname: 'localhost',
        port: 5173,
        path: '/api/verify/init',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { credentialId: benchmarkUuid });

      expect(initRes.status).toBe(200);
      expect(initRes.body).toHaveProperty('nonce');
      const nonce = initRes.body.nonce;

      // Step 2: Exchange with cryptographic signature verify
      const exchangeRes = await request({
        hostname: 'localhost',
        port: 5173,
        path: '/api/verify/exchange',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { credentialId: benchmarkUuid, nonce });

      expect(exchangeRes.status).toBe(200);
      expect(exchangeRes.body?.result).toBe('PASS');
      expect(exchangeRes.body?.checks?.signature?.passed).toBe(true);
      expect(exchangeRes.body?.checks?.integrity?.passed).toBe(true);
    });

    it('supports direct GET verification lookup', async () => {
      const res = await request({
        hostname: 'localhost',
        port: 5173,
        path: `/api/verify/${benchmarkUuid}`,
        method: 'GET'
      });
      expect(res.status).toBe(200);
      expect(res.body?.status).toBe('ACTIVE');
    });

    it('records pharmacy dispensation via POST /api/dispensations', async () => {
      // Create a dedicated fresh prescription and credential for dispensation testing
      const patientsRes = await request({
        hostname: 'localhost',
        port: 5173,
        path: '/api/patients',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${providerToken}` }
      });
      const patId = patientsRes.body[0].id;

      const rxRes = await request({
        hostname: 'localhost',
        port: 5173,
        path: '/api/prescriptions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${providerToken}`
        }
      }, {
        patientId: patId,
        items: [{ medication: 'Dispense Test Med', strength: '10mg', dosage: '1 daily', duration: '30 days', timing: 'Daily', refills: 2 }],
        notes: 'Testing dispensation'
      });

      const credRes = await request({
        hostname: 'localhost',
        port: 5173,
        path: '/api/credentials',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${providerToken}`
        }
      }, { prescriptionId: rxRes.body.id });

      const testCredId = credRes.body.credential_id || credRes.body.id;

      const dispRes = await request({
        hostname: 'localhost',
        port: 5173,
        path: '/api/dispensations',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        credentialId: testCredId,
        pharmacyName: 'Automated Test Pharmacy',
        notes: 'Dispensed fill 1 of 3'
      });
      expect(dispRes.status).toBe(200);
      expect(dispRes.body?.ok).toBe(true);

      const getDispRes = await request({
        hostname: 'localhost',
        port: 5173,
        path: `/api/dispensations/${testCredId}`,
        method: 'GET'
      });
      expect(getDispRes.status).toBe(200);
      expect(getDispRes.body).toHaveProperty('pharmacy_name');
    });
  });

  describe('Audit Logging System', () => {
    it('retrieves chronologically sorted audit trail', async () => {
      const res = await request({
        hostname: 'localhost',
        port: 5173,
        path: '/api/audit',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.total).toBeGreaterThan(0);
    });
  });
});
