import { describe, it, expect } from 'vitest';
import { canonicalize, canonicalizeToString, hashCanonical, detectTamper } from './crypto';

describe('Crypto Utilities', () => {
  describe('canonicalize', () => {
    it('returns deterministic output regardless of field ordering', () => {
      const obj1 = { b: '2', a: '1' };
      const obj2 = { a: '1', b: '2' };
      expect(JSON.stringify(canonicalize(obj1))).toBe(JSON.stringify(canonicalize(obj2)));
    });

    it('trims string values', () => {
      const obj = { a: '  hello  ' };
      expect(canonicalize(obj)).toEqual({ a: 'hello' });
    });

    it('handles nested objects', () => {
      const obj = { z: { b: '2', a: '1' }, a: '1' };
      const canonical = canonicalize(obj);
      expect(Object.keys(canonical)).toEqual(['a', 'z']);
      expect(Object.keys(canonical.z)).toEqual(['a', 'b']);
    });

    it('handles arrays', () => {
      const obj = { arr: ['c', 'a', 'b'] };
      expect(canonicalize(obj)).toEqual({ arr: ['c', 'a', 'b'] });
    });

    it('excludes undefined values', () => {
      const obj = { a: '1', b: undefined };
      expect(canonicalize(obj)).toEqual({ a: '1' });
    });
  });

  describe('canonicalizeToString', () => {
    it('produces identical strings for equivalent objects with different key order', () => {
      const obj1 = { medication: 'Amoxicillin', strength: '500 mg' };
      const obj2 = { strength: '500 mg', medication: 'Amoxicillin' };
      expect(canonicalizeToString(obj1)).toBe(canonicalizeToString(obj2));
    });
  });

  describe('hashCanonical', () => {
    it('produces consistent SHA-256 hex for identical inputs', async () => {
      const input = canonicalizeToString({ a: '1', b: '2' });
      const hash1 = await hashCanonical(input);
      const hash2 = await hashCanonical(input);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces different hashes for different inputs', async () => {
      const hash1 = await hashCanonical(canonicalizeToString({ a: '1' }));
      const hash2 = await hashCanonical(canonicalizeToString({ a: '2' }));
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('detectTamper', () => {
    it('correctly flags mismatch', () => {
      expect(detectTamper('abc', 'def')).toBe(true);
    });

    it('correctly passes match', () => {
      expect(detectTamper('abc', 'abc')).toBe(false);
    });
  });

  describe('Prescription canonicalization', () => {
    it('matches expected canonical form for viva prescription', async () => {
      const prescription = {
        medication: 'Amoxicillin',
        strength: '500 mg',
        dosage: '3× daily',
        duration: '7 days',
        notes: '',
      };
      const canonical = canonicalizeToString(prescription);
      expect(canonical).toBe('{"dosage":"3× daily","duration":"7 days","medication":"Amoxicillin","notes":"","strength":"500 mg"}');
      const hash = await hashCanonical(canonical);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
