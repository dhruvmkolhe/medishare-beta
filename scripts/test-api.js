import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const JWT_SECRET = new TextEncoder().encode('medishare-jwt-secret-change-in-production-32bytes');

async function createToken(userId, email, role) {
  return new SignJWT({ sub: userId, email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET);
}

async function test() {
  console.log('=== MEDI SHARE TEST SUITE ===\n');

  // 1. Check users
  const { data: users } = await supabase.from('users').select('*');
  console.log('1. USERS TABLE:');
  console.log('   Total users:', users?.length);
  users?.forEach(u => console.log(`   - ${u.email} (${u.role})`));

  // 2. Check providers
  const { data: providers } = await supabase.from('providers').select('*');
  console.log('\n2. PROVIDERS TABLE:');
  console.log('   Total providers:', providers?.length);
  providers?.forEach(p => console.log(`   - ${p.name} (License: ${p.license_number}, Approved: ${p.approved_at ? 'Yes' : 'No'})`));

  // 3. Check patients
  const { data: patients } = await supabase.from('patients').select('*');
  console.log('\n3. PATIENTS TABLE:');
  console.log('   Total patients:', patients?.length);
  patients?.forEach(p => console.log(`   - ${p.display_name} (${p.patient_reference})`));

  // 4. Check issuer keys
  const { data: keys } = await supabase.from('issuer_keys').select('*');
  console.log('\n4. ISSUER KEYS TABLE:');
  console.log('   Total keys:', keys?.length);
  keys?.forEach(k => {
    console.log(`   - Key ID ${k.id}: Provider ${k.provider_id}, Active: ${k.is_active}`);
    console.log(`     Has public key: ${!!k.public_key}, Has encrypted private key: ${!!k.encrypted_private_key}`);
    console.log(`     IV length: ${k.iv?.length}, Auth tag length: ${k.auth_tag?.length}`);
  });

  // 5. Check prescriptions
  const { data: prescriptions } = await supabase.from('prescriptions').select('*');
  console.log('\n5. PRESCRIPTIONS TABLE:');
  console.log('   Total prescriptions:', prescriptions?.length);
  prescriptions?.forEach(p => {
    console.log(`   - Prescription ${p.id}: ${p.medication} ${p.strength}, ${p.dosage}, ${p.duration}`);
  });

  // 6. Check credentials
  const { data: credentials } = await supabase.from('credentials').select('*');
  console.log('\n6. CREDENTIALS TABLE:');
  console.log('   Total credentials:', credentials?.length);
  credentials?.forEach(c => {
    console.log(`   - Credential ${c.credential_id}`);
    console.log(`     Status: ${c.status}`);
    console.log(`     Content hash: ${c.content_hash}`);
    console.log(`     Signature: ${c.signature?.slice(0, 40)}...`);
    console.log(`     Issued: ${c.issued_at}, Expires: ${c.expires_at}`);
  });

  // 7. Check audit logs
  const { data: auditLogs } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: true });
  console.log('\n7. AUDIT LOGS TABLE:');
  console.log('   Total logs:', auditLogs?.length);
  auditLogs?.forEach(log => {
    console.log(`   - ${log.action} (${log.target_type} #${log.target_id})`);
  });

  // 8. Check revocations
  const { data: revocations } = await supabase.from('revocations').select('*');
  console.log('\n8. REVOCATIONS TABLE:');
  console.log('   Total revocations:', revocations?.length || 0);

  // 9. Check verification events
  const { data: verifications } = await supabase.from('verification_events').select('*');
  console.log('\n9. VERIFICATION EVENTS TABLE:');
  console.log('   Total verifications:', verifications?.length || 0);

  // 10. Verify cryptographic correctness
  console.log('\n10. CRYPTOGRAPHIC VERIFICATION:');
  if (credentials && credentials[0]) {
    const cred = credentials[0];
    const { data: prescription } = await supabase.from('prescriptions').select('*').eq('id', cred.prescription_id).single();
    const { data: key } = await supabase.from('issuer_keys').select('*').eq('id', cred.issuer_key_id).single();

    // Reconstruct canonical data
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

    console.log('   Canonical JSON:', canonicalStr);
    console.log('   Recomputed hash:', hash);
    console.log('   Stored hash:', cred.content_hash);
    console.log('   Hash match:', hash === cred.content_hash ? '✓ PASS' : '✗ FAIL');

    // Verify signature
    const verify = crypto.verify(null, Buffer.from(cred.content_hash, 'utf8'), key.public_key, Buffer.from(cred.signature, 'base64'));
    console.log('   Signature verification:', verify ? '✓ PASS' : '✗ FAIL');
  }

  // 11. Test authentication
  console.log('\n11. AUTHENTICATION TEST:');
  const providerUser = users?.find(u => u.role === 'PROVIDER');
  if (providerUser) {
    const valid = await bcrypt.compare('password123', providerUser.password_hash);
    console.log('   Provider password hash valid:', valid ? '✓ PASS' : '✗ FAIL');

    const token = await createToken(providerUser.id, providerUser.email, providerUser.role);
    console.log('   JWT token generated:', token ? '✓ PASS' : '✗ FAIL');
    console.log('   Token preview:', token.slice(0, 50) + '...');
  }

  // 12. Check credential is ACTIVE for viva
  console.log('\n12. VIVA READINESS CHECK:');
  if (credentials && credentials[0]) {
    const c = credentials[0];
    const isActive = c.status === 'ACTIVE';
    const notExpired = new Date(c.expires_at) > new Date();
    console.log('   Credential status ACTIVE:', isActive ? '✓ PASS' : '✗ FAIL');
    console.log('   Credential not expired:', notExpired ? '✓ PASS' : '✗ FAIL');
    console.log('   Credential ID for viva:', c.credential_id);
  }

  console.log('\n=== ALL CHECKS COMPLETE ===');
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
