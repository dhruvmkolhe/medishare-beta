/**
 * MediShare Key Management Service (KMS) Abstraction Layer
 *
 * Provides a unified interface for cryptographic key operations.
 * Swap adapters by setting the KMS_PROVIDER environment variable.
 *
 * Supported adapters:
 *   local    — Default. Uses AES-256-GCM with KEY_ENCRYPTION_KEY env var (current behavior).
 *   aws      — AWS KMS (requires AWS_KMS_KEY_ID, AWS credentials).
 *   gcp      — Google Cloud KMS (requires GCP_KMS_KEY_NAME, GCP credentials).
 *   vault    — HashiCorp Vault (requires VAULT_ADDR, VAULT_TOKEN, VAULT_KMS_KEY_NAME).
 *
 * All adapters implement the KmsAdapter interface:
 *   - encryptKey(privateKeyPem: string): Promise<{ encryptedKey: string, keyVersion: string, metadata: object }>
 *   - decryptKey(encryptedKey: string, metadata: object): Promise<string>
 *   - getProviderName(): string
 */

import { createLocalAdapter } from './local-adapter.js';

let _adapter = null;

export function getKmsAdapter() {
  if (_adapter) return _adapter;

  const provider = process.env.KMS_PROVIDER || 'local';

  switch (provider.toLowerCase()) {
    case 'local':
      _adapter = createLocalAdapter();
      break;
    case 'aws':
      // Import lazily to avoid errors when AWS SDK is not installed
      throw new Error(
        'AWS KMS adapter is not implemented yet. ' +
        'Set KMS_PROVIDER=local for development. ' +
        'See api/_lib/kms/aws-adapter.stub.js for implementation guide.'
      );
    case 'gcp':
      throw new Error(
        'GCP KMS adapter is not implemented yet. ' +
        'Set KMS_PROVIDER=local for development. ' +
        'See api/_lib/kms/gcp-adapter.stub.js for implementation guide.'
      );
    case 'vault':
      throw new Error(
        'HashiCorp Vault KMS adapter is not implemented yet. ' +
        'Set KMS_PROVIDER=local for development. ' +
        'See api/_lib/kms/vault-adapter.stub.js for implementation guide.'
      );
    default:
      console.warn(`Unknown KMS_PROVIDER="${provider}", falling back to local adapter.`);
      _adapter = createLocalAdapter();
  }

  console.log(`[KMS] Using ${_adapter.getProviderName()} key management adapter`);
  return _adapter;
}

// Convenience functions that use the configured adapter
export async function kmsEncryptKey(privateKeyPem) {
  const adapter = getKmsAdapter();
  return adapter.encryptKey(privateKeyPem);
}

export async function kmsDecryptKey(encryptedKey, metadata) {
  const adapter = getKmsAdapter();
  return adapter.decryptKey(encryptedKey, metadata);
}
