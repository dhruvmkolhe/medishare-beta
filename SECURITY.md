# MediShare Security Policy

> **Version:** 1.0  
> **Last Updated:** 2026-10-31  
> **Applies To:** MediShare v1 — all production deployments

---

## Table of Contents

1. [Supported Versions](#1-supported-versions)
2. [Security Controls Summary](#2-security-controls-summary)
3. [Known Security Limitations](#3-known-security-limitations)
4. [Reporting a Vulnerability](#4-reporting-a-vulnerability)
5. [Environment Variable Security](#5-environment-variable-security)
6. [Deployment Security Checklist](#6-deployment-security-checklist)
7. [Security Architecture Diagram](#7-security-architecture-diagram)

---

## 1. Supported Versions

| Version | Supported | Notes |
|---|---|---|
| `1.x` (current) | ✅ Yes | Active development; security patches applied |
| `< 1.0` | ❌ No | Pre-release; not supported |

Security patches are applied to the **latest `1.x` release** only. Older minor versions do not receive backported fixes.

---

## 2. Security Controls Summary

The following controls are **confirmed implemented** in the codebase. Only controls verifiable in source code are listed here.

### 2.1 Cryptographic Controls

- **Ed25519 Asymmetric Signing** — Provider key pairs generated via Node.js `crypto.generateKeyPairSync('ed25519')`. Prescriptions are signed with the provider's Ed25519 private key. Verification uses the corresponding public key stored in `issuer_keys`. Source: [`crypto-utils.js`](api/_lib/crypto-utils.js)

- **AES-256-GCM Private Key Encryption at Rest** — Provider Ed25519 private keys are encrypted with AES-256-GCM before being written to MongoDB. Each encryption uses a cryptographically random 16-byte IV (`crypto.randomBytes(16)`) and GCM authentication tag. The Key Encryption Key (KEK) is loaded from the `KEY_ENCRYPTION_KEY` environment variable. Source: [`crypto-utils.js`](api/_lib/crypto-utils.js)

- **SHA-256 Content Digests** — Every credential's signed payload is hashed with SHA-256 before signing and stored as `content_hash`. This hash is recomputed and compared at verification time to detect tampering. Source: [`crypto-utils.js`](api/_lib/crypto-utils.js)

- **RFC 8785-like JSON Canonicalization** — Prescription data is canonicalized (sorted keys, trimmed string values, consistent serialization) before hashing and signing, ensuring deterministic digests regardless of field insertion order. Source: [`crypto-utils.js`](api/_lib/crypto-utils.js)

- **Cryptographically Secure Nonce Generation** — 32-byte random nonces generated via `crypto.randomBytes(32).toString('base64url')` are used for verification challenge-response sessions. Source: [`crypto-utils.js`](api/_lib/crypto-utils.js)

- **Cryptographically Secure UUID Generation** — Credential IDs are generated via `crypto.randomUUID()`. Source: [`crypto-utils.js`](api/_lib/crypto-utils.js)

### 2.2 Authentication & Session Controls

- **bcrypt Password Hashing (cost factor 12)** — All user passwords are hashed with bcrypt at cost 12 before storage. Plaintext passwords are never stored. Source: [`utils.js`](api/_lib/utils.js)

- **JWT HS256 Access Tokens (15-minute TTL)** — Short-lived access tokens signed with HS256 using the `JWT_SECRET`. Tokens include `sub` (userId), `email`, and `role` claims. Issued via the `jose` library. Source: [`utils.js`](api/_lib/utils.js)

- **HttpOnly + Secure + SameSite=Strict Refresh Cookies** — Refresh tokens (7-day TTL) are delivered as `HttpOnly; Secure; SameSite=Strict` cookies scoped to `Path=/api/auth/refresh`, preventing JavaScript access and CSRF-based theft. Source: [`utils.js`](api/_lib/utils.js)

- **Nonce-Based Challenge-Response Verification Protocol** — The pharmacist verification flow uses a two-step init/exchange protocol. A one-time-use nonce (60s TTL) must be presented with the credential ID; the nonce is marked `used: true` after exchange to prevent replay. Source: [`verify.js`](api/_routes/verify.js)

- **6-Point Cryptographic Verification Pipeline** — Credential verification checks: (1) issuer key resolution, (2) Ed25519 signature validity, (3) SHA-256 data integrity, (4) credential status (not revoked), (5) expiration date, (6) dispensation count vs. authorized maximum. Source: [`verify.js`](api/_routes/verify.js)

### 2.3 Authorization Controls

- **Server-Side RBAC with Role Guards** — All privileged endpoints call `requireRole(req, allowedRoles)` which verifies the JWT and checks the `role` claim against an allowlist. Unauthenticated requests return `401`; wrong-role requests return `401`. Source: [`utils.js`](api/_lib/utils.js)

- **Resource Ownership Enforcement** — Individual credential, prescription, and revocation endpoints check that the requesting user's provider or patient ID matches the resource's `provider_id` / `patient_id` before granting access. Source: [`credentials.js`](api/_routes/credentials.js)

- **Provider-Scoped Audit Log Access** — Providers can only query their own audit log entries (`query.actor_id = payload.sub`). Admins see all entries. Source: [`audit.js`](api/_routes/audit.js)

- **Anti-Theft Pickup PIN Verification** — Before dispensation is recorded, the submitted `pickupPin` is compared against the credential's stored PIN, rejecting mismatches. Source: [`dispensations.js`](api/_routes/dispensations.js)

### 2.4 Input Validation

- **Zod Schema Validation on All API Inputs** — Every mutation endpoint validates request bodies against a Zod schema before processing. Validation failures return `400` with structured error details. Schemas include: `loginSchema`, `registerSchema`, `prescriptionSchema`, `dispensationSchema`, `credentialRevokeSchema`, `verifyInitSchema`, `verifyExchangeSchema`. Source: [`utils.js`](api/_lib/utils.js), [`verify.js`](api/_routes/verify.js)

### 2.5 Rate Limiting

- **Sliding-Window In-Memory Rate Limiting** — A `Map`-backed sliding-window rate limiter is applied to the login endpoint (5 req/60s per IP) and verification endpoints (10 req/60s per IP). Stale entries are cleaned up every 10 minutes. In production (`NODE_ENV=production`), limits are enforced at the configured values; in development, limits are relaxed to ≥ 200. Source: [`utils.js`](api/_lib/utils.js)

- **Per-Credential Session Limit** — Maximum of 3 simultaneous active verification sessions per credential ID, preventing session flooding against a specific prescription. Source: [`verify.js`](api/_routes/verify.js)

### 2.6 HTTP Security Headers

The following headers are set on every API response via `corsHeaders()`:

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking via `<iframe>` |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter (modern browsers ignore) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |

Source: [`utils.js`](api/_lib/utils.js)

### 2.7 Audit Trail

- **Immutable Audit Logging** — Key actions are written to the `audit_logs` MongoDB collection via `logAudit()`: `USER_REGISTERED`, `LOGIN_SUCCESS`, `LOGIN_FAILED`, `VERIFICATION_ATTEMPTED`, `CREDENTIAL_REVOKED`, `CREDENTIAL_DISPENSED`, and provider approval actions. Each entry records `actor_id`, `action`, `target_type`, `target_id`, `metadata`, and `created_at`. Source: [`utils.js`](api/_lib/utils.js)

### 2.8 Environment Validation

- **Startup Environment Diagnostics** — `validateEnvironment()` checks for the presence of `MONGODB_URI`, `JWT_SECRET`, and `KEY_ENCRYPTION_KEY` at startup. In production, missing critical variables are logged as fatal errors. With `STRICT_ENV_CHECK=true`, the process exits on fatal configuration errors. Source: [`env-check.js`](api/_lib/env-check.js)

---

## 3. Known Security Limitations

> [!WARNING]
> The following limitations are **confirmed gaps** in the current implementation. They are documented here to ensure operators make informed deployment decisions.

### 3.1 In-Memory Rate Limiting (Does Not Scale)

The rate limiter uses a process-local JavaScript `Map`. It **resets on every process restart** and **is not shared across multiple Node.js instances**. In a horizontally scaled or serverless deployment, each instance maintains independent rate limit counters.

**Impact:** Brute-force attacks are effectively unmitigated in multi-instance or frequently restarting deployments.  
**Recommended Fix:** Replace with a Redis-backed rate limiter (e.g., `rate-limiter-flexible` with `ioredis`).

### 3.2 CORS Set to `*` (Wildcard)

```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
```

All API responses allow requests from any origin. This means any website can make credentialed-free cross-origin requests to the API.

**Impact:** While `SameSite=Strict` cookies mitigate CSRF for state-changing operations that require the refresh cookie, wildcard CORS weakens the defense-in-depth posture.  
**Recommended Fix:** Set `Access-Control-Allow-Origin` to the specific frontend origin in production (e.g., `https://medishare.yourdomain.com`).

### 3.3 Verification Sessions Are In-Memory Only

The `verificationSessions` Map in [`verify.js`](api/_routes/verify.js) is process-local. Sessions are **lost on restart** and **not shared across instances**.

**Impact:** In serverless or multi-instance environments, a nonce issued by instance A cannot be exchanged on instance B, breaking the verification flow.  
**Recommended Fix:** Store verification sessions in Redis or MongoDB with a TTL index.

### 3.4 Server-Side (Custodial) Key Generation

Ed25519 key pairs are generated server-side and stored in MongoDB (private key AES-256-GCM encrypted). The server platform holds the KEK and therefore has the ability to decrypt any provider's private key.

**Impact:** This is not a zero-knowledge or truly non-custodial system. A compromised server or rogue insider could extract all signing keys. The "doctor's digital signature" is only as trustworthy as the platform operator.  
**Recommended Fix:** For higher assurance, generate keys client-side (WebCrypto API) and use hardware-backed key storage (WebAuthn/passkeys). This is architecturally significant.

### 3.5 Audit Logs Are Mutable

Audit entries are standard MongoDB documents with no hash chain, no external anchoring, and no WORM (write-once read-many) enforcement. A MongoDB administrator can alter or delete any log entry.

**Impact:** Audit logs provide accountability for normal operations but cannot be relied upon as tamper-proof forensic evidence. A sophisticated insider could cover their tracks.  
**Recommended Fix:** Forward audit logs to an append-only external sink (cloud logging, S3 with object lock, syslog to a separate server). Hash-chain linking of entries would also improve tamper evidence.

### 3.6 No Multi-Factor Authentication

The platform currently supports only password-based authentication. No TOTP, WebAuthn/passkey, or SMS OTP is implemented.

**Impact:** Account takeover via phishing, credential stuffing, or password breach is not prevented by a second factor.  
**Recommended Fix:** Add TOTP (e.g., `otplib`) or WebAuthn as a second factor, especially for `PROVIDER` and `ADMIN` roles.

### 3.7 Pickup PINs Stored in Plaintext

The 6-digit pickup PIN in `credentials.pickup_pin` is stored as a plaintext string. A database breach exposes all active PINs.

**Impact:** Attacker can impersonate patients at pharmacy counters.  
**Recommended Fix:** Hash PINs with bcrypt before storage; compare using `bcrypt.compare()` at dispensation time.

### 3.8 Open Admin Self-Registration

The `POST /api/auth/register` endpoint accepts `ADMIN` as a valid role value. Any unauthenticated user can register as an administrator.

**Impact:** Complete platform compromise by any attacker with API access.  
**Recommended Fix:** Remove `ADMIN` (and potentially `PHARMACIST`) from the public registration schema. Admin accounts should be seeded or promoted by an existing admin.

### 3.9 Verbose 500 Error Messages

All route handlers return `err.message` directly in HTTP 500 responses. MongoDB error messages can contain collection names, field paths, and operator details.

**Impact:** Aids attacker reconnaissance and may leak sensitive schema information.  
**Recommended Fix:** In production, return a generic `"Internal server error"` message and log full details server-side only.

### 3.10 No HSTS Header

The `Strict-Transport-Security` header is not set in code. HTTPS enforcement is delegated entirely to the deployment platform.

**Impact:** First-visit downgrade attacks (if platform does not enforce HTTPS) and cookie exposure over HTTP.  
**Recommended Fix:** Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` in `corsHeaders()`.

---

## 4. Reporting a Vulnerability

> [!IMPORTANT]
> MediShare handles patient health information. Please follow responsible disclosure to avoid real-world harm to patients.

### Responsible Disclosure Policy

If you discover a security vulnerability in MediShare:

1. **Do not open a public GitHub issue.** Public disclosure before a fix is available puts users at risk.

2. **Email the security team** at `security@medishare.example` with:
   - A clear description of the vulnerability.
   - Steps to reproduce (include request/response samples where applicable, with PII redacted).
   - The potential impact and affected component.
   - Whether you have a suggested fix or patch.

3. **Do not access, modify, or exfiltrate real patient data.** Test only against your own deployment or the publicly available demo environment.

4. **Expected response timeline:**
   - Acknowledgement within **48 hours**
   - Severity assessment within **5 business days**
   - Fix timeline communicated within **10 business days**
   - Credit offered in release notes for responsibly disclosed issues

5. **Scope:** All endpoints listed in the API reference, the React SPA, and the cryptographic pipeline are in scope. Third-party dependencies with known CVEs should be reported upstream to the respective maintainer.

6. **Out of scope:** Social engineering of staff, physical access attacks, DoS attacks against the demo instance.

### PGP Key

A PGP key for encrypted communications will be published at `https://medishare.example/.well-known/security.txt` and on the GitHub repository security page.

---

## 5. Environment Variable Security

> [!CAUTION]
> Never commit `.env` files to version control. Never use the default example values in production.

All secrets must be generated using a cryptographically secure random source (e.g., `openssl rand -base64 32`).

| Variable | Required | Security Requirements | Notes |
|---|---|---|---|
| `JWT_SECRET` | **Yes** | Minimum 32 characters; cryptographically random; never reuse across projects | Signs and verifies all access tokens. Compromise allows minting tokens for any user with any role. Checked by `env-check.js`. |
| `REFRESH_SECRET` | **Yes** | Minimum 32 characters; cryptographically random; different from `JWT_SECRET` | Signs and verifies refresh tokens (7-day TTL). **Not currently validated by `env-check.js`** — ensure it is set. |
| `KEY_ENCRYPTION_KEY` | **Yes** | Exactly 32 characters (256 bits); cryptographically random | AES-256 key used to encrypt/decrypt all provider Ed25519 private keys in MongoDB. Compromise allows decrypting every signing key. Checked by `env-check.js`. Code pads/truncates to 32 bytes — use exactly 32 for safety. |
| `MONGODB_URI` | **Yes** | Must include credentials in production (e.g., `mongodb://user:pass@host:27017/db?authSource=admin`) | Do not use `mongodb://127.0.0.1:27017` without authentication in production. Checked by `env-check.js`. |
| `MONGODB_DB_NAME` | **Yes** | Any valid MongoDB database name | Isolates collections from other databases on the same cluster. |
| `NODE_ENV` | **Yes** | Must be `production` in production deployments | Controls rate limiter enforcement levels and env-check error severity. Setting to `development` relaxes security controls. |
| `STRICT_ENV_CHECK` | Recommended | Set to `true` in production | When `true`, the process exits immediately if required secrets are missing or invalid, preventing startup with insecure defaults. |

### Generating Secrets

```bash
# Generate JWT_SECRET (32+ random bytes, base64-encoded)
openssl rand -base64 32

# Generate REFRESH_SECRET
openssl rand -base64 32

# Generate KEY_ENCRYPTION_KEY (exactly 32 printable ASCII chars)
openssl rand -base64 24 | tr -d '=+/' | head -c 32
```

> [!WARNING]
> The source code contains **hardcoded fallback values** for `JWT_SECRET`, `REFRESH_SECRET`, and `KEY_ENCRYPTION_KEY` that are used when environment variables are not set. These defaults are publicly visible in the repository and provide **zero security**. Always set all three variables before any deployment, including staging and test environments that use real data.

---

## 6. Deployment Security Checklist

Use this checklist before every production deployment.

### Secrets & Configuration

- [ ] `JWT_SECRET` is set to a cryptographically random value of ≥ 32 characters
- [ ] `REFRESH_SECRET` is set to a cryptographically random value of ≥ 32 characters (different from `JWT_SECRET`)
- [ ] `KEY_ENCRYPTION_KEY` is set to exactly 32 cryptographically random characters
- [ ] `MONGODB_URI` includes authentication credentials
- [ ] `NODE_ENV=production` is set
- [ ] `STRICT_ENV_CHECK=true` is set so the process fails fast on misconfiguration
- [ ] `.env` file is excluded from version control (`.gitignore` contains `.env`)
- [ ] Secrets are stored in a secrets manager (e.g., AWS Secrets Manager, Vault, Vercel Environment Variables) — not in `docker-compose.yml` or CI config files

### Network & Infrastructure

- [ ] MongoDB is **not** directly reachable from the public internet (firewall / VPC)
- [ ] MongoDB has authentication enabled (`--auth` flag or Atlas built-in)
- [ ] HTTPS is enforced at the load balancer / CDN / platform level
- [ ] HTTP requests are redirected to HTTPS (platform-level)
- [ ] MongoDB connection uses TLS (`?tls=true` in URI for remote connections)

### Application Security

- [ ] Remove `ADMIN` from the `registerSchema.role` enum before going live with real users
- [ ] CORS origin restricted to the specific frontend domain (not `*`)
- [ ] `Strict-Transport-Security` header added to responses
- [ ] Production 500 errors return generic messages only (`err.message` removed from response)
- [ ] Pickup PINs hashed before storage (recommended remediation)

### Rate Limiting & DoS Protection

- [ ] Rate limiter backed by Redis (not in-memory) for multi-instance deployments
- [ ] Web Application Firewall (WAF) or DDoS protection in front of the API (e.g., Cloudflare, AWS Shield)
- [ ] Request body size limit configured at the HTTP server / platform level

### Monitoring & Incident Response

- [ ] Structured logging enabled; logs shipped to a centralized log aggregator
- [ ] Alerts configured for: repeated `LOGIN_FAILED`, `ADMIN` role registration, unusual dispensation patterns, MongoDB connection errors
- [ ] Audit log forwarding to append-only external storage
- [ ] Incident response plan documented and tested (see `THREAT_MODEL.md` §8)
- [ ] Security point of contact published in `/.well-known/security.txt`

### Dependency & Build

- [ ] `npm audit` run and all Critical/High vulnerabilities resolved
- [ ] Dependency lock file (`package-lock.json`) committed and used in CI/CD builds
- [ ] Docker base image updated to latest Node.js 22 LTS Alpine patch version
- [ ] Docker image vulnerability scanning run (e.g., `docker scout`, Trivy)

### Pre-Launch Testing

- [ ] All 51 Vitest tests pass (`npm test`)
- [ ] Security headers verified with `security-headers.test.ts`
- [ ] API route access control verified with `api-e2e.test.ts`
- [ ] Demo seed accounts removed or passwords changed from `password123`

---

## 7. Security Architecture Diagram

### System Trust Flow

```mermaid
flowchart TD
    Browser["Browser / SPA\n(React 19, Vite)"]
    PublicUser["Public User\n(Pharmacist, Anonymous)"]
    API["Node.js API Route Handlers"]
    MongoDB["MongoDB 7.0\n(Private Network)"]
    Env["Environment\n(JWT_SECRET, REFRESH_SECRET,\nKEY_ENCRYPTION_KEY)"]

    Browser -->|"HTTPS + Bearer JWT (15 min)\nHttpOnly Refresh Cookie (7 d)"| API
    PublicUser -->|"HTTPS — No Auth\n/api/verify/*, /api/auth/*"| API
    API -->|"MongoDB Driver\n(No internet exposure assumed)"| MongoDB
    Env -->|"Loaded at startup\nfail-fast if STRICT_ENV_CHECK=true"| API
```

### Prescription Signing Flow

```mermaid
flowchart LR
    RxData["Prescription Data\n(medications, dosage, notes)"]
    Canon["RFC 8785-like\nCanonicalization\nsorted keys, trimmed strings"]
    Hash["SHA-256\nContent Hash"]
    KEK["KEY_ENCRYPTION_KEY\nfrom env"]
    EncKey["Encrypted Ed25519\nPrivate Key\nAES-256-GCM in MongoDB"]
    PrivKey["Ed25519 Private Key\n(decrypted in memory)"]
    Sig["Ed25519 Signature\n(Base64, stored in credential)"]
    Cred["credentials collection\n content_hash + signature + status"]

    RxData --> Canon --> Hash
    KEK --> EncKey --> PrivKey
    Hash --> Sig
    PrivKey --> Sig
    Sig --> Cred
    Hash --> Cred
```

### 6-Point Verification Pipeline

```mermaid
flowchart LR
    QR["Pharmacist Scans QR"] --> Init["POST /api/verify/init\nIssue 60s nonce"]
    Init --> Exchange["POST /api/verify/exchange\nnonce + credentialId"]

    Exchange --> C1{"① Issuer Key\nResolved?"}
    C1 -->|Yes| C2{"② Ed25519\nSignature Valid?"}
    C1 -->|No| FAIL["FAIL"]
    C2 -->|Yes| C3{"③ Content Hash\nUnchanged?"}
    C2 -->|No| FAIL
    C3 -->|Yes| C4{"④ Status\nACTIVE or DISPENSED?"}
    C3 -->|No| FAIL
    C4 -->|Yes| C5{"⑤ Not\nExpired?"}
    C4 -->|No| FAIL
    C5 -->|Yes| C6{"⑥ Refills\nRemaining?"}
    C5 -->|No| FAIL
    C6 -->|Yes| PASS["✅ PASS\nReturn prescription details"]
    C6 -->|No| FAIL
```

### Data Classification Map

```mermaid
flowchart TD
    subgraph Critical ["🔴 Critical Sensitivity"]
        KEK2["KEY_ENCRYPTION_KEY"]
        JWT2["JWT_SECRET\nREFRESH_SECRET"]
        PrivKeys["Ed25519 Private Keys\n(encrypted in DB)"]
    end

    subgraph High ["🟠 High Sensitivity"]
        PHI["Patient PHI\n(name, medications, dosage)"]
        PasswordHash["bcrypt Password Hashes"]
        RefreshCookie["Refresh Token Cookie\n(HttpOnly)"]
        AuditLogs["Audit Logs"]
    end

    subgraph Medium ["🟡 Medium Sensitivity"]
        PubKeys["Ed25519 Public Keys\n(intentionally public)"]
        PickupPin["Pickup PINs\n(plaintext — remediation needed)"]
        Nonces["Verification Nonces\n(in-memory, 60s TTL)"]
    end

    subgraph Low ["🟢 Low Sensitivity"]
        CredStatus["Credential Status\n(ACTIVE/DISPENSED/REVOKED)"]
        ContentHash["Content Hashes\n(publicly returned)"]
    end
```
