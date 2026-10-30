/**
 * Local KMS Adapter — Development/Self-Hosted Mode
 *
 * Uses AES-256-GCM with a Key Encryption Key (KEK) from the KEY_ENCRYPTION_KEY
 * environment variable. This is the default adapter and is used automatically
 * unless KMS_PROVIDER is set.
 *
 * Security Level: Suitable for development and self-hosted deployments with
 * proper secret management. For production, consider using AWS KMS, GCP KMS,
 * or HashiCorp Vault for hardware-backed key protection.
 *
 * Required environment variables:
 *   KEY_ENCRYPTION_KEY — 32-character master encryption key (AES-256)
 */

import { encryptPrivateKey, decryptPrivateKey } from '../crypto-utils.js';

export function createLocalAdapter() {
  return {
    getProviderName() {
      return 'Local AES-256-GCM (KEY_ENCRYPTION_KEY)';
    },

    async encryptKey(privateKeyPem) {
      // encryptPrivateKey returns { encrypted_private_key, iv, auth_tag }
      const result = encryptPrivateKey(privateKeyPem);
      return {
        encryptedKey: result.encrypted_private_key,
        keyVersion: '1',
        metadata: {
          iv: result.iv,
          auth_tag: result.auth_tag,
          algorithm: 'aes-256-gcm',
          adapter: 'local',
        },
      };
    },

    async decryptKey(encryptedKey, metadata) {
      if (!metadata?.iv || !metadata?.auth_tag) {
        throw new Error('Missing required metadata fields (iv, auth_tag) for local KMS decryption');
      }
      return decryptPrivateKey(encryptedKey, metadata.iv, metadata.auth_tag);
    },
  };
}
