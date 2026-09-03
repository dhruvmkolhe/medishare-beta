import http from 'http';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = body;
        try {
          parsed = JSON.parse(body);
        } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🚀 TESTING ALL MEDISHARE API ROUTES...\n');
  const results = [];

  function record(name, passed, detail) {
    results.push({ name, passed, detail });
    console.log(`${passed ? '✅ PASS' : '❌ FAIL'}: ${name} ${detail ? `(${detail})` : ''}`);
  }

  // 1. Auth Login Admin
  const adminLogin = await request({
    hostname: 'localhost',
    port: 5173,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@medishare.com', password: 'password123' });

  const adminToken = adminLogin.body?.accessToken;
  record('POST /api/auth/login (Admin)', adminLogin.status === 200 && !!adminToken, `status: ${adminLogin.status}`);

  // 2. Auth Login Provider
  const doctorLogin = await request({
    hostname: 'localhost',
    port: 5173,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'dr.sharma@medishare.com', password: 'password123' });

  const doctorToken = doctorLogin.body?.accessToken;
  record('POST /api/auth/login (Provider)', doctorLogin.status === 200 && !!doctorToken, `status: ${doctorLogin.status}`);

  // 3. Admin Stats
  const adminStats = await request({
    hostname: 'localhost',
    port: 5173,
    path: '/api/admin/stats',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  record('GET /api/admin/stats', adminStats.status === 200 && adminStats.body?.totalCredentials > 0, `totalCredentials: ${adminStats.body?.totalCredentials}`);

  // 4. Providers List & Pending
  const providersList = await request({
    hostname: 'localhost',
    port: 5173,
    path: '/api/providers',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  record('GET /api/providers', providersList.status === 200 && Array.isArray(providersList.body), `count: ${providersList.body?.length}`);

  const pendingProviders = await request({
    hostname: 'localhost',
    port: 5173,
    path: '/api/providers/pending',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  record('GET /api/providers/pending', pendingProviders.status === 200 && Array.isArray(pendingProviders.body), `pending: ${pendingProviders.body?.length}`);

  // 5. Patients List
  const patientsList = await request({
    hostname: 'localhost',
    port: 5173,
    path: '/api/patients',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${doctorToken}` }
  });
  record('GET /api/patients', patientsList.status === 200 && Array.isArray(patientsList.body), `count: ${patientsList.body?.length}`);

  // 6. Prescriptions List
  const rxList = await request({
    hostname: 'localhost',
    port: 5173,
    path: '/api/prescriptions',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${doctorToken}` }
  });
  record('GET /api/prescriptions', rxList.status === 200 && Array.isArray(rxList.body?.data), `count: ${rxList.body?.data?.length}`);

  // 7. Credentials List
  const credsList = await request({
    hostname: 'localhost',
    port: 5173,
    path: '/api/credentials',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${doctorToken}` }
  });
  const firstCred = credsList.body?.data?.[0];
  record('GET /api/credentials', credsList.status === 200 && Array.isArray(credsList.body?.data), `total: ${credsList.body?.total}`);

  if (firstCred) {
    const credId = firstCred.id;

    // 8. Single Credential GET
    const singleCred = await request({
      hostname: 'localhost',
      port: 5173,
      path: `/api/credentials/${credId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });
    record('GET /api/credentials/:id', singleCred.status === 200, `status: ${singleCred.status}`);

    // 9. QR Route
    const qrRes = await request({
      hostname: 'localhost',
      port: 5173,
      path: `/api/credentials/${credId}/qr`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });
    record('GET /api/credentials/:id/qr', qrRes.status === 200 && !!qrRes.body?.qrUrl, `status: ${qrRes.status}`);

    // 10. Export W3C VC
    const exportVc = await request({
      hostname: 'localhost',
      port: 5173,
      path: `/api/credentials/${credId}/export/vc`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });
    record('GET /api/credentials/:id/export/vc', exportVc.status === 200 && exportVc.body?.type?.includes('VerifiableCredential'), `status: ${exportVc.status}`);

    // 11. Export FHIR
    const exportFhir = await request({
      hostname: 'localhost',
      port: 5173,
      path: `/api/credentials/${credId}/export/fhir`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });
    record('GET /api/credentials/:id/export/fhir', exportFhir.status === 200 && exportFhir.body?.resourceType === 'Bundle', `resourceType: ${exportFhir.body?.resourceType}`);

    // 12. Compare / Tamper Detection
    const compareRes = await request({
      hostname: 'localhost',
      port: 5173,
      path: `/api/credentials/${credId}/compare`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${doctorToken}` }
    });
    record('GET /api/credentials/:id/compare', compareRes.status === 200 && Array.isArray(compareRes.body?.diff), `tampered: ${compareRes.body?.tampered}`);
  }

  // 13. Verify Init & Exchange Benchmark Sample
  const benchmarkUuid = 'c9c52004-6fb3-4654-8fbd-2bd360802816';
  const verifyInit = await request({
    hostname: 'localhost',
    port: 5173,
    path: '/api/verify/init',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { credentialId: benchmarkUuid });

  const nonce = verifyInit.body?.nonce;
  record('POST /api/verify/init', verifyInit.status === 200 && !!nonce, `status: ${verifyInit.status}`);

  if (nonce) {
    const verifyExchange = await request({
      hostname: 'localhost',
      port: 5173,
      path: '/api/verify/exchange',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { credentialId: benchmarkUuid, nonce });
    record('POST /api/verify/exchange', verifyExchange.status === 200 && verifyExchange.body?.result === 'PASS', `result: ${verifyExchange.body?.result}`);
  }

  // 14. Direct GET /api/verify/:credentialId
  const getVerify = await request({
    hostname: 'localhost',
    port: 5173,
    path: `/api/verify/${benchmarkUuid}`,
    method: 'GET'
  });
  record('GET /api/verify/:credentialId', getVerify.status === 200 && getVerify.body?.status === 'ACTIVE', `status: ${getVerify.status}`);

  // 15. Create New Prescription (POST)
  const patientId = patientsList.body?.[0]?.id;
  const newRx = await request({
    hostname: 'localhost',
    port: 5173,
    path: '/api/prescriptions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${doctorToken}`
    }
  }, {
    patientId: patientId,
    items: [
      { medication: 'Test Amoxicillin', strength: '500 mg', dosage: '1 cap 3x daily', duration: '7 days', timing: 'Morning, Noon, Night', refills: 1 }
    ],
    notes: 'End-to-end API test prescription'
  });
  record('POST /api/prescriptions', newRx.status === 201 && !!newRx.body?.id, `status: ${newRx.status}`);

  // 16. Issue New Credential (POST)
  let issuedCredId = null;
  if (newRx.body?.id) {
    const issueRes = await request({
      hostname: 'localhost',
      port: 5173,
      path: '/api/credentials',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doctorToken}`
      }
    }, { prescriptionId: newRx.body.id });
    issuedCredId = issueRes.body?.credential_id || issueRes.body?.id;
    record('POST /api/credentials', issueRes.status === 201 && !!issuedCredId, `status: ${issueRes.status}`);
  }

  // 17. Dispense Credential (POST & GET)
  if (issuedCredId) {
    const dispRes = await request({
      hostname: 'localhost',
      port: 5173,
      path: '/api/dispensations',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      credentialId: issuedCredId,
      pharmacyName: 'API Test Pharmacy',
      notes: 'Test dispensation via automated suite'
    });
    record('POST /api/dispensations', dispRes.status === 200 && dispRes.body?.ok === true, `status: ${dispRes.status}`);

    const getDisp = await request({
      hostname: 'localhost',
      port: 5173,
      path: `/api/dispensations/${issuedCredId}`,
      method: 'GET'
    });
    record('GET /api/dispensations/:id', getDisp.status === 200 && getDisp.body?.pharmacy_name === 'API Test Pharmacy', `pharmacy: ${getDisp.body?.pharmacy_name}`);

    // 18. Revoke Credential (POST)
    const revokeRes = await request({
      hostname: 'localhost',
      port: 5173,
      path: `/api/credentials/${issuedCredId}/revoke`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doctorToken}`
      }
    }, { reason: 'Test completed - automated cleanup' });
    record('POST /api/credentials/:id/revoke', revokeRes.status === 200 && revokeRes.body?.status === 'REVOKED', `status: ${revokeRes.status}`);
  }

  // 19. Audit Logs
  const auditRes = await request({
    hostname: 'localhost',
    port: 5173,
    path: '/api/audit',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  record('GET /api/audit', auditRes.status === 200 && Array.isArray(auditRes.body?.data), `total: ${auditRes.body?.total}`);

  // Summary
  const passedCount = results.filter(r => r.passed).length;
  console.log(`\n=============================================`);
  console.log(`TEST RESULTS: ${passedCount}/${results.length} ROUTES VERIFIED PASS!`);
  console.log(`=============================================`);
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
