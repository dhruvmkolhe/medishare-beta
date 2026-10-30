# MediShare KMS Abstraction Layer

> **Location:** `api/_lib/kms/`

The KMS (Key Management Service) abstraction layer provides a **unified interface** for encrypting and decrypting Ed25519 private keys stored in the database. It decouples the application's key-storage logic from any specific cryptographic backend, making it straightforward to migrate from local symmetric encryption to a hardware-backed cloud KMS in production.

---

## How It Works

```
providers.js / credentials.js
        │
        ▼
  kmsEncryptKey() / kmsDecryptKey()   ← api/_lib/kms/index.js
        │
        ▼
   getKmsAdapter()  ─── reads KMS_PROVIDER env var
        │
        ├─── 'local'  → local-adapter.js   (wraps AES-256-GCM in crypto-utils.js)
        ├─── 'aws'    → aws-adapter.stub.js (documented, not yet implemented)
        ├─── 'gcp'    → gcp-adapter.stub.js (documented, not yet implemented)
        └─── 'vault'  → vault-adapter.stub.js (documented, not yet implemented)
```

All adapters satisfy the same **KmsAdapter** interface:

| Method | Signature | Description |
|---|---|---|
| `getProviderName()` | `() → string` | Human-readable provider name for logging |
| `encryptKey(pem)` | `(string) → Promise<EncryptResult>` | Encrypt a private key PEM string |
| `decryptKey(ciphertext, meta)` | `(string, object) → Promise<string>` | Decrypt back to PEM string |

**`EncryptResult` shape:**
```js
{
  encryptedKey: string,   // ciphertext (base64 or provider-native format)
  keyVersion:  string,    // key version identifier
  metadata:    object,    // adapter-specific data needed to decrypt later
}
```

---

## Switching Adapters

Set the `KMS_PROVIDER` environment variable before starting the server:

```bash
# Default — local AES-256-GCM
KMS_PROVIDER=local

# AWS KMS (requires implementation — see aws-adapter.stub.js)
KMS_PROVIDER=aws

# GCP Cloud KMS (requires implementation)
KMS_PROVIDER=gcp

# HashiCorp Vault Transit (requires implementation)
KMS_PROVIDER=vault
```

The adapter is resolved **once at startup** and cached for the lifetime of the process. Changing `KMS_PROVIDER` requires a server restart.

---

## Adapter Status

| Adapter | File | Status | Notes |
|---|---|---|---|
| `local` | `local-adapter.js` | ✅ **IMPLEMENTED** | Wraps `encryptPrivateKey` / `decryptPrivateKey` from `crypto-utils.js`. Default for all environments. |
| `aws` | `aws-adapter.stub.js` | 📋 **DOCUMENTED ONLY** | Requires `@aws-sdk/client-kms` and AWS credentials. |
| `gcp` | `gcp-adapter.stub.js` | 📋 **DOCUMENTED ONLY** | Requires `@google-cloud/kms` and GCP credentials. |
| `vault` | `vault-adapter.stub.js` | 📋 **DOCUMENTED ONLY** | Uses native `fetch`; no SDK needed. Requires Vault Transit engine. |

---

## Implementing a New Adapter

1. **Create `api/_lib/kms/<name>-adapter.js`** and export a `create<Name>Adapter()` factory:

   ```js
   export function createMyAdapter() {
     return {
       getProviderName() {
         return 'My KMS Provider';
       },

       async encryptKey(privateKeyPem) {
         // Call your KMS to encrypt privateKeyPem
         // Return: { encryptedKey, keyVersion, metadata }
       },

       async decryptKey(encryptedKey, metadata) {
         // Call your KMS to decrypt encryptedKey using metadata
         // Return: plaintext PEM string
       },
     };
   }
   ```

2. **Register it in `api/_lib/kms/index.js`** — add a `case` to the switch:

   ```js
   case 'myprovider': {
     const { createMyAdapter } = await import('./my-adapter.js');
     _adapter = createMyAdapter();
     break;
   }
   ```

3. **Add env-var validation** in `api/_lib/env-check.js` for any required variables.

4. **Document required env vars** in `.env.example`.

---

## Backward Compatibility

The `local` adapter is a **transparent wrapper** around the existing `encryptPrivateKey` / `decryptPrivateKey` functions in `crypto-utils.js`. No changes were made to `providers.js`, `credentials.js`, or the database schema — the KMS layer is available for **opt-in adoption** when the team is ready to migrate to a cloud provider.

Keys already stored in the database using the legacy direct calls continue to work unchanged; the local adapter produces identical ciphertext format.

---

## Security Considerations

- **Never log private keys or KEK values.** The adapters deliberately omit any such logging.
- The `local` adapter's security depends entirely on keeping `KEY_ENCRYPTION_KEY` secret. Use a secrets manager (AWS Secrets Manager, GCP Secret Manager, Vault) to inject it rather than storing it in `.env` files in production.
- For production deployments handling real patient data, prefer `aws`, `gcp`, or `vault` adapters — they provide hardware-backed key protection (HSM) and automatic key rotation that the local adapter cannot offer.
- Key material is never transmitted over the wire with the `local` adapter. Cloud adapters (`aws`, `gcp`) send only ciphertext to the KMS API; plaintext never leaves the application process during encryption.
- Rotate `KEY_ENCRYPTION_KEY` (or the cloud CMK) periodically and re-encrypt stored keys as part of your key rotation policy.
