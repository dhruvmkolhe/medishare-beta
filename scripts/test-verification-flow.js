import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testVerificationFlow() {
  console.log('=== TESTING VERIFICATION FLOW ===\n');

  // Get credential
  const { data: credential } = await supabase.from('credentials').select('*').single();
  console.log('Credential ID:', credential.credential_id);

  // Test tamper detection
  console.log('\n--- Test 1: Valid credential (happy path) ---');
  const { data: prescription } = await supabase.from('prescriptions').select('*').eq('id', credential.prescription_id).single();
  const credentialData = {
    medication: prescription.medication,
    strength: prescription.strength,
    dosage: prescription.dosage,
    duration: prescription.duration,
    notes: prescription.notes,
  };
  const sortedKeys = Object.keys(credentialData).sort();
  const canonical = {};
  for (const k of sortedKeys) {
    canonical[k] = typeof credentialData[k] === 'string' ? credentialData[k].trim() : credentialData[k];
  }
  const canonicalStr = JSON.stringify(canonical);
  const hash = crypto.createHash('sha256').update(canonicalStr, 'utf8').digest('hex');
  const isActive = credential.status === 'ACTIVE';
  const notExpired = new Date(credential.expires_at) > new Date();

  console.log('Canonical JSON:', canonicalStr);
  console.log('Hash match:', hash === credential.content_hash ? '✓ PASS' : '✗ FAIL');
  console.log('Status active:', isActive ? '✓ PASS' : '✗ FAIL');
  console.log('Not expired:', notExpired ? '✓ PASS' : '✗ FAIL');
  console.log('Expected result: ✓ VERIFIED (all 5 checks pass)');

  // Test 2: Tamper detection
  console.log('\n--- Test 2: Tamper detection (strength changed to 1000mg) ---');
  const tamperedData = { ...credentialData, strength: '1000 mg' };
  const tamperedCanonical = {};
  for (const k of Object.keys(tamperedData).sort()) {
    tamperedCanonical[k] = typeof tamperedData[k] === 'string' ? tamperedData[k].trim() : tamperedData[k];
  }
  const tamperedStr = JSON.stringify(tamperedCanonical);
  const tamperedHash = crypto.createHash('sha256').update(tamperedStr, 'utf8').digest('hex');
  console.log('Tampered canonical:', tamperedStr);
  console.log('Tampered hash:', tamperedHash);
  console.log('Hash mismatch:', tamperedHash !== credential.content_hash ? '✓ DETECTED' : '✗ NOT DETECTED');
  console.log('Expected result: ✕ DATA INTEGRITY FAILED, ✕ SIGNATURE INVALID');

  // Test 3: After restore (original data)
  console.log('\n--- Test 3: After restoring original data ---');
  console.log('Hash match:', hash === credential.content_hash ? '✓ PASS' : '✗ FAIL');
  console.log('Expected result: ✓ VERIFIED (all checks pass again)');

  // Test 4: After revocation
  console.log('\n--- Test 4: After revocation ---');
  // We won't actually revoke here, but we simulate the check
  const wouldBeRevoked = credential.status === 'REVOKED';
  console.log('Currently revoked:', wouldBeRevoked ? 'Yes' : 'No');
  console.log('Expected after revocation: ✕ CREDENTIAL REVOKED');

  console.log('\n=== VERIFICATION FLOW TESTS COMPLETE ===');
}

testVerificationFlow().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
