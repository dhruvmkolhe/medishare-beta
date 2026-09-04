import { describe, it, expect } from 'vitest';
import {
  canonicalize,
  canonicalizeToString,
  hashCanonical,
  generateKeyPair,
  encryptPrivateKey,
  decryptPrivateKey,
  signCredential,
  verifySignature,
  detectTamper,
  generateCredentialId,
  generateNonce,
  generateVerificationUrl
} from '../api/_lib/crypto-utils.js';

describe('Cryptographic Utilities Suite', () => {
  describe('Canonicalization', () => {
    it('sorts object keys alphabetically and trims string values', () => {
      const input = {
        zeta: '  value Z ',
        alpha: 'value A',
        beta: {
          two: ' 2 ',
          one: 1,
        }
      };
      const result = canonicalize(input);
      expect(Object.keys(result)).toEqual(['alpha', 'beta', 'zeta']);
      expect(result.zeta).toBe('value Z');
      expect(Object.keys(result.beta)).toEqual(['one', 'two']);
      expect(result.beta.two).toBe('2');
    });

    it('handles arrays and nulls cleanly', () => {
      expect(canonicalize(null)).toBeNull();
      expect(canonicalize(undefined)).toBeNull();
      const arr = [{ b: 'b', a: 'a' }];
      const canonicalArr = canonicalize(arr);
      expect(Object.keys(canonicalArr[0])).toEqual(['a', 'b']);
    });

    it('canonicalizeToString produces deterministic string regardless of key insertion order', () => {
      const obj1 = { medication: 'Amoxicillin', dosage: '500mg', duration: '7 days' };
      const obj2 = { duration: '7 days', dosage: '500mg', medication: 'Amoxicillin' };
      expect(canonicalizeToString(obj1)).toBe(canonicalizeToString(obj2));
    });
  });

  describe('Hashing & Tamper Detection', () => {
    it('produces valid 64-character SHA-256 hex hashes', () => {
      const canonical = canonicalizeToString({ test: 'hello' });
      const hash = hashCanonical(canonical);
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });

    it('detectTamper accurately identifies altered data hashes', () => {
      const originalHash = hashCanonical(canonicalizeToString({ dosage: '500mg' }));
      const alteredHash = hashCanonical(canonicalizeToString({ dosage: '1000mg' }));
      const sameHash = hashCanonical(canonicalizeToString({ dosage: '500mg' }));

      expect(detectTamper(originalHash, alteredHash)).toBe(true);
      expect(detectTamper(originalHash, sameHash)).toBe(false);
    });
  });

  describe('Key Generation, AES Encryption, and Ed25519 Signing', () => {
    it('generates valid Ed25519 keypairs', () => {
      const { publicKey, privateKey } = generateKeyPair();
      expect(publicKey).toContain('BEGIN PUBLIC KEY');
      expect(privateKey).toContain('BEGIN PRIVATE KEY');
    });

    it('encrypts and decrypts private keys using AES-256-GCM', () => {
      const { privateKey } = generateKeyPair();
      const encrypted = encryptPrivateKey(privateKey);

      expect(encrypted).toHaveProperty('encrypted_private_key');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('auth_tag');

      const decrypted = decryptPrivateKey(
        encrypted.encrypted_private_key,
        encrypted.iv,
        encrypted.auth_tag
      );
      expect(decrypted).toBe(privateKey);
    });

    it('successfully signs and verifies digital signatures', () => {
      const { publicKey, privateKey } = generateKeyPair();
      const dataHash = hashCanonical(canonicalizeToString({ medication: 'Atorvastatin', strength: '20mg' }));
      const signature = signCredential(dataHash, privateKey);

      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(20);

      // Verify valid signature
      const isValid = verifySignature(dataHash, signature, publicKey);
      expect(isValid).toBe(true);

      // Verify invalid signature on modified data
      const tamperedHash = hashCanonical(canonicalizeToString({ medication: 'Atorvastatin', strength: '40mg' }));
      const isTamperedValid = verifySignature(tamperedHash, signature, publicKey);
      expect(isTamperedValid).toBe(false);

      // Verify invalid signature with different key
      const otherPair = generateKeyPair();
      const isOtherKeyValid = verifySignature(dataHash, signature, otherPair.publicKey);
      expect(isOtherKeyValid).toBe(false);
    });
  });

  describe('Session Nonce & Verification URL', () => {
    it('generates random UUIDs and nonces', () => {
      const uuid = generateCredentialId();
      expect(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)).toBe(true);

      const nonce = generateNonce();
      expect(nonce.length).toBeGreaterThan(20);
    });

    it('constructs properly formatted verification URLs', () => {
      const id = 'c9c52004-6fb3-4654-8fbd-2bd360802816';
      const url = generateVerificationUrl(id, 'medishare.org', 'https');
      expect(url).toBe('https://medishare.org/verify/c9c52004-6fb3-4654-8fbd-2bd360802816');
    });
  });
});
