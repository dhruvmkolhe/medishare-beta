/**
 * HashiCorp Vault KMS Adapter — Implementation Guide (NOT YET IMPLEMENTED)
 *
 * Uses Vault's Transit Secrets Engine for encryption/decryption.
 * No additional SDK is required — uses native fetch against the Vault HTTP API.
 *
 * Required environment variables (when KMS_PROVIDER=vault):
 *   VAULT_ADDR           — Vault server address (e.g., https://vault.example.com:8200)
 *   VAULT_TOKEN          — Vault token with transit read/write permissions
 *   VAULT_KMS_KEY_NAME   — Transit key name (e.g., medishare-provider-keys)
 *
 * Implementation uses Vault Transit API:
 *   POST /v1/transit/encrypt/:key_name  — encrypt
 *   POST /v1/transit/decrypt/:key_name  — decrypt
 *
 * See: https://developer.hashicorp.com/vault/api-docs/secret/transit
 *
 * Implementation sketch (no SDK required, uses native fetch):
 *
 * export function createVaultAdapter() {
 *   const vaultAddr = process.env.VAULT_ADDR;
 *   const vaultToken = process.env.VAULT_TOKEN;
 *   const keyName = process.env.VAULT_KMS_KEY_NAME || 'medishare-provider-keys';
 *   if (!vaultAddr) throw new Error('VAULT_ADDR environment variable is required');
 *   if (!vaultToken) throw new Error('VAULT_TOKEN environment variable is required');
 *
 *   const headers = {
 *     'X-Vault-Token': vaultToken,
 *     'Content-Type': 'application/json',
 *   };
 *
 *   return {
 *     getProviderName() { return 'HashiCorp Vault Transit'; },
 *
 *     async encryptKey(privateKeyPem) {
 *       const plaintext = Buffer.from(privateKeyPem, 'utf8').toString('base64');
 *       const res = await fetch(`${vaultAddr}/v1/transit/encrypt/${keyName}`, {
 *         method: 'POST',
 *         headers,
 *         body: JSON.stringify({ plaintext }),
 *       });
 *       if (!res.ok) throw new Error(`Vault encrypt failed: ${res.status} ${await res.text()}`);
 *       const { data } = await res.json();
 *       return {
 *         encryptedKey: data.ciphertext,
 *         keyVersion: String(data.key_version),
 *         metadata: { adapter: 'vault', keyName, keyVersion: data.key_version },
 *       };
 *     },
 *
 *     async decryptKey(encryptedKey, metadata) {
 *       const res = await fetch(`${vaultAddr}/v1/transit/decrypt/${keyName}`, {
 *         method: 'POST',
 *         headers,
 *         body: JSON.stringify({ ciphertext: encryptedKey }),
 *       });
 *       if (!res.ok) throw new Error(`Vault decrypt failed: ${res.status} ${await res.text()}`);
 *       const { data } = await res.json();
 *       return Buffer.from(data.plaintext, 'base64').toString('utf8');
 *     },
 *   };
 * }
 */

// This file is documentation only. Activate by:
// 1. Uncomment the implementation above and add `export` to createVaultAdapter
// 2. Register in api/_lib/kms/index.js case 'vault': block
// 3. Set VAULT_ADDR, VAULT_TOKEN, and VAULT_KMS_KEY_NAME in your environment

export {}; // Placeholder export
