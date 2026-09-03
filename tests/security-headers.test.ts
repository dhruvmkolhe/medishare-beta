import { describe, it, expect } from 'vitest';
import http from 'http';
import { validateEnvironment } from '../api/env-check.js';

describe('Security Hardening & Headers Suite', () => {
  describe('Environment Variable Integrity Validator', () => {
    it('validates environment and reports configuration status', () => {
      const result = validateEnvironment();
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('environment');
      expect(Array.isArray(result.issues)).toBe(true);
    });
  });

  describe('HTTP Security Headers on API Responses', () => {
    it('returns defense-in-depth security headers on all API routes', async () => {
      const headers = await new Promise<http.IncomingHttpHeaders>((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: 5173,
          path: '/api/providers',
          method: 'GET'
        }, (res) => {
          resolve(res.headers);
        });
        req.on('error', reject);
        req.end();
      });

      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['x-xss-protection']).toBe('1; mode=block');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });
  });
});
