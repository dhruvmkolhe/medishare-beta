# MediShare Threat Model

> **Methodology:** Microsoft STRIDE  
> **Version:** 1.0  
> **Date:** 2026-10-31  
> **Scope:** MediShare v1 — React SPA + Node.js API-routes + MongoDB + Ed25519 cryptography  
> **Status:** Living document — update whenever a new feature changes the attack surface

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Sensitive Assets](#2-sensitive-assets)
3. [Trust Boundaries](#3-trust-boundaries)
4. [Attack Surfaces](#4-attack-surfaces)
5. [STRIDE Threat Analysis](#5-stride-threat-analysis)
   - [S — Spoofing](#s--spoofing)
   - [T — Tampering](#t--tampering)
   - [R — Repudiation](#r--repudiation)
   - [I — Information Disclosure](#i--information-disclosure)
   - [D — Denial of Service](#d--denial-of-service)
   - [E — Elevation of Privilege](#e--elevation-of-privilege)
6. [Security Assumptions](#6-security-assumptions)
7. [Known Residual Risks](#7-known-residual-risks)
8. [Incident Response Recommendations](#8-incident-response-recommendations)

---

## 1. System Overview

MediShare is a healthcare credentialing platform built on:

| Layer | Technology | Role |
|---|---|---|
| **Frontend** | React 19 SPA (Vite) | Patient wallet, provider dashboard, pharmacist verifier, admin console |
| **API** | Node.js serverless route handlers | Business logic, auth, crypto operations |
| **Database** | MongoDB 7.0 | Persistent storage of users, prescriptions, credentials, keys, audit logs |
| **Cryptography** | Ed25519 (Node.js `crypto`) + AES-256-GCM + SHA-256 | Key generation, signing, encryption, hashing |
| **Auth** | JWT HS256 (15 min access) + HttpOnly refresh cookie (7 days) | Session management |

The platform has **four roles**: `PATIENT`, `PROVIDER` (doctor), `PHARMACIST`, and `ADMIN`. The pharmacist verification endpoint (`/api/verify/*`) is **publicly accessible without authentication**, by design.

```
┌─────────────────────┐         ┌──────────────────────────────┐
│     Browser / SPA   │  HTTPS  │    Node.js API Route Handlers │
│  (React 19, Vite)   │◄───────►│  auth / verify / credentials │
└─────────────────────┘         │  dispensations / audit        │
                                └───────────┬──────────────────┘
                                            │ MongoDB Driver
                                ┌───────────▼──────────────────┐
                                │        MongoDB 7.0            │
                                │  users, prescriptions,        │
                                │  credentials, issuer_keys,    │
                                │  audit_logs, revocations      │
                                └──────────────────────────────┘
```

---

## 2. Sensitive Assets

| Asset | Classification | Storage Location | Value to Attacker |
|---|---|---|---|
| **Patient PHI** (name, patient_reference, medications, dosage) | Critical | MongoDB `patients`, `prescriptions`, `prescription_items` | Identity theft, insurance fraud, targeted drug theft |
| **Provider Ed25519 Private Keys** | Critical | MongoDB `issuer_keys` (AES-256-GCM encrypted) | Forge prescriptions for any controlled substance |
| **KEY_ENCRYPTION_KEY (KEK)** | Critical | Environment variable | Decrypt all private keys in the database |
| **JWT_SECRET / REFRESH_SECRET** | Critical | Environment variable | Mint arbitrary tokens for any user with any role |
| **Refresh Token Cookie** | High | Browser HttpOnly cookie | Account takeover without password |
| **Prescription Credentials** | High | MongoDB `credentials` | Fraudulent dispensation of controlled substances |
| **Audit Logs** | High | MongoDB `audit_logs` | Evidence destruction / covering tracks |
| **Pickup PINs** | Medium | MongoDB `credentials.pickup_pin` (plaintext) | Bypassing pharmacist counter pickup verification |
| **User Passwords** | Medium | MongoDB `users.password_hash` (bcrypt cost-12) | Account takeover if bcrypt is cracked |
| **Verification Nonces** | Medium | In-memory `verificationSessions` Map | Replay of verification sessions |

> [!CAUTION]
> **Pickup PINs** are stored in plaintext in the `credentials` collection. A database breach directly exposes all pickup PINs, enabling physical theft of dispensed medications.

---

## 3. Trust Boundaries

```
┌──────────────────────────────────────────────────────────────┐
│  BOUNDARY 1: Public Internet / Browser                        │
│  Untrusted. Any user, scanner, or automated tool.            │
│  Endpoints: /api/verify/*, /api/auth/*                        │
└────────────────────────────┬─────────────────────────────────┘
                             │ HTTP(S) — JWT Bearer or Cookie
┌────────────────────────────▼─────────────────────────────────┐
│  BOUNDARY 2: API Route Handlers (Node.js)                     │
│  Semi-trusted. Validates JWTs, enforces RBAC, runs Zod.      │
│  Trusts: X-Forwarded-For header (IP spoofable behind proxy)   │
│  Does NOT trust: request body, query params, path segments   │
└────────────────────────────┬─────────────────────────────────┘
                             │ MongoDB Driver (no network TLS enforced in code)
┌────────────────────────────▼─────────────────────────────────┐
│  BOUNDARY 3: MongoDB                                          │
│  Trusted. Assumed not internet-exposed (see §6).             │
│  Stores encrypted private keys, plaintext pickup PINs,        │
│  bcrypt password hashes, audit logs                          │
└──────────────────────────────────────────────────────────────┘
```

> [!NOTE]
> There is **no network-level TLS enforcement** in the MongoDB driver connection string in code; this is delegated entirely to the deployment environment.

---

## 4. Attack Surfaces

### 4.1 Unauthenticated / Public Endpoints

| Endpoint | Method | Risk Notes |
|---|---|---|
| `POST /api/auth/register` | Public | No invite-code, CAPTCHA, or email verification — open registration for any role including `ADMIN` |
| `POST /api/auth/login` | Public | Rate-limited (5/60s per IP), brute-forceable with IP rotation |
| `POST /api/auth/refresh` | Public (cookie) | Accepts any valid refresh cookie |
| `POST /api/verify/init` | Public | Rate-limited (10/60s per IP) |
| `POST /api/verify/exchange` | Public | Rate-limited (10/60s per IP); returns full prescription data |
| `GET /api/verify/:id` | Public | **No auth, no rate limit** — returns `contentHash`, `dispensations`, `status`, `issuedAt` |
| `GET /api/dispensations/:id` | Public-ish | No auth check; returns first dispensation record |

> [!CAUTION]
> `GET /api/verify/:id` and `GET /api/dispensations/:id` have **no authentication and no rate limiting** in the route code. An attacker can enumerate credential IDs.

### 4.2 Authenticated Endpoints (All Roles)

`GET /api/credentials`, `GET /api/credentials/:id`, `GET /api/credentials/:id/qr`, `/export/vc`, `/export/fhir`  
Access checks implemented via `requireRole` + ownership checks.

### 4.3 Privileged Endpoints

| Endpoint | Required Role | Notes |
|---|---|---|
| `POST /api/prescriptions` | PROVIDER | Signing keys decrypted in-process |
| `POST /api/credentials/:id/revoke` | PROVIDER / ADMIN / PATIENT | Patient can self-revoke |
| `GET /api/credentials/:id/compare` | PROVIDER / ADMIN | |
| `POST /api/providers/:id/approve` | ADMIN | No re-authentication required |
| `GET /api/admin/stats` | ADMIN | |
| `GET /api/audit` | PROVIDER / ADMIN | Provider sees own logs only |
| `POST /api/dispensations` | PHARMACIST / ADMIN | Auth added in Phase 1 |

---

## 5. STRIDE Threat Analysis

---

### S — Spoofing

> Threats where an attacker impersonates a legitimate entity.

| # | Threat | Affected Component | Attack Scenario | Mitigation Implemented | Status | Severity | Residual Risk |
|---|---|---|---|---|---|---|---|
| S-1 | Impersonate a doctor via JWT theft | `/api/prescriptions`, `/api/credentials` | Attacker XSS-steals or network-intercepts a provider's 15-minute access token, signs a fraudulent opioid prescription before expiry | Short JWT TTL (15 min); `HttpOnly` refresh cookie prevents JS access to refresh token; `SameSite=Strict` on cookie | ⚠️ PARTIAL | **Critical** | Access token is a Bearer token in memory/localStorage — XSS or MITM can expose it; no token binding; no MFA |
| S-2 | Impersonate a patient (BOLA) | `GET /api/credentials/:id` | Authenticated patient A modifies the credential UUID in the request to access patient B's prescription | Ownership check implemented: patient's `_id` must match `prescription.patient_id` | ✅ IMPLEMENTED | High | BOLA check is present in individual credential fetch but `GET /api/credentials` list endpoint fetches all then filters in-memory — a timing side-channel or logic error could leak data |
| S-3 | Impersonate a pharmacist for dispensation | `POST /api/dispensations` | Unauthenticated attacker posts to `/api/dispensations` to mark prescriptions as dispensed | `requireRole(['PHARMACIST', 'ADMIN'])` guard added | ✅ IMPLEMENTED | **Critical** | Pickup PIN stored in plaintext; PIN is transmitted in cleartext request body |
| S-4 | Impersonate any user by forging JWT | All authenticated endpoints | Attacker learns `JWT_SECRET` (via env leak, source code, or default value) and mints tokens for any `userId`/`role` | `JWT_SECRET` loaded from env; env-check warns if missing; `jose` library used for HS256 | ⚠️ PARTIAL | **Critical** | Code falls back to a hardcoded default secret (`medishare-jwt-secret-change-in-production-32bytes`) if env is not set; STRICT_ENV_CHECK is not enabled by default |
| S-5 | Open registration as ADMIN role | `POST /api/auth/register` | Attacker self-registers with `role: "ADMIN"`, gaining full platform control | No mitigation — `registerSchema` accepts `ADMIN` as a valid role | ❌ NOT IMPLEMENTED | **Critical** | Any attacker with API access can create an admin account |

---

### T — Tampering

> Threats where an attacker modifies data in transit or at rest.

| # | Threat | Affected Component | Attack Scenario | Mitigation Implemented | Status | Severity | Residual Risk |
|---|---|---|---|---|---|---|---|
| T-1 | Modify prescription dosage in DB after signing | `POST /api/verify/exchange`, `/compare` | DB admin or compromised MongoDB changes `5 mg` → `50 mg` in `prescription_items`; pharmacist verifies | Ed25519 signature + SHA-256 content hash checked at verification time; `detectTamper()` compares stored vs. recomputed hash; `/compare` endpoint shows visual diff | ✅ IMPLEMENTED | High | Hash covers items at time of signing; if the credential doc's `content_hash` field is also altered in MongoDB, both stored and recomputed hashes match the tampered version — no external anchor |
| T-2 | Modify audit log entries | `audit_logs` collection | DB-level attacker deletes or alters `CREDENTIAL_DISPENSED` entries to remove dispensation evidence | Basic audit collection exists with `created_at` timestamps | ❌ NOT IMPLEMENTED | High | No hash chain, no WORM storage, no external log shipping; MongoDB admin can freely alter or delete log entries |
| T-3 | Tamper with QR code payload in transit | QR → pharmacist browser | Attacker performs MITM on HTTP traffic and replaces the `credentialId` in the QR URL | `Secure` flag on refresh cookie; verification uses server-side nonce; HTTPS assumed in production | ⚠️ PARTIAL | Medium | No HSTS header set in code; HTTP is used in development with no redirect enforcement; the `proto` detected from `x-forwarded-proto` (spoofable) |
| T-4 | Tamper with `pickup_pin` before dispensation | `POST /api/dispensations` | Attacker with DB write access changes the stored pickup PIN to a known value | Pickup PIN verified before dispensation | ✅ IMPLEMENTED | Medium | PIN stored in plaintext; bcrypt or hash-then-verify not used for PINs |

---

### R — Repudiation

> Threats where an actor denies having performed an action.

| # | Threat | Affected Component | Attack Scenario | Mitigation Implemented | Status | Severity | Residual Risk |
|---|---|---|---|---|---|---|---|
| R-1 | Doctor denies issuing a prescription | `audit_logs`, `credentials` | Doctor claims they never signed a prescription; logs are challenged as fabricated | `logAudit()` records `actor_id` for every prescription/credential action; Ed25519 signature mathematically binds prescription to doctor's key | ✅ IMPLEMENTED | High | Audit logs are mutable in MongoDB; no external timestamp authority (RFC 3161); signature key is server-generated (custodial) — provider could claim key was stolen from server |
| R-2 | Admin denies approving a provider license | `audit_logs` | Admin approves a bad actor's provider license then denies doing so | `logAudit()` called on approval actions (visible in audit trail) | ✅ IMPLEMENTED | High | Same mutability caveat as R-1 |
| R-3 | Pharmacist denies dispensation | `audit_logs`, `credentials.dispensations` | Pharmacist disputes dispensing a controlled substance | Dispensation records embedded in `credentials.dispensations` with `dispensed_by` (user ID), `dispensed_at`, `pharmacy_name`; audit log entry created | ✅ IMPLEMENTED | High | `dispensed_by` is a user ID — no pharmacist signature on dispensation; user ID could be repudiated if account was shared/compromised |

---

### I — Information Disclosure

> Threats where sensitive data is exposed to unauthorized parties.

| # | Threat | Affected Component | Attack Scenario | Mitigation Implemented | Status | Severity | Residual Risk |
|---|---|---|---|---|---|---|---|
| I-1 | Patient PHI exposure via verbose API errors | All route handlers | Unhandled exception leaks MongoDB document contents, stack traces, or query details in 500 response | `catch` blocks return `err.message` directly to client | ❌ NOT IMPLEMENTED | High | Every route has `res.status(500).json({ error: err.message })` — MongoDB error messages can contain field names, query operators, or partial document contents |
| I-2 | Provider private key leakage via DB breach | `issuer_keys` collection | Attacker dumps MongoDB; obtains `encrypted_private_key`, `iv`, `auth_tag`; uses the KEK (also likely compromised) to decrypt | AES-256-GCM encryption at rest with random IV and authentication tag | ⚠️ PARTIAL | **Critical** | Key security is entirely dependent on the KEK; server-side custodial model means the platform has full access to all private keys at all times; no HSM or key vault used |
| I-3 | JWT_SECRET / KEK exposure via environment | Server runtime | Process env dump (SSRF → `/proc/self/environ`, cloud metadata API, mis-deployed config) leaks secrets; hardcoded fallback in source | Env validation warns on missing secrets | ⚠️ PARTIAL | **Critical** | Fallback secrets hardcoded in `utils.js` and `crypto-utils.js` source; `STRICT_ENV_CHECK` defaults to off; `REFRESH_SECRET` not explicitly validated by `env-check.js` |
| I-4 | Full prescription PHI in verification response | `POST /api/verify/exchange` | Unauthenticated pharmacist scan receives full medication list, notes, patient reference, refill history, pharmacy names | Verification endpoint is intentionally public | ⚠️ PARTIAL | Medium | By design, but patient name / DOB not returned; `patient_reference` (pseudonym) is returned; no selective disclosure / ZKP support; response includes all dispensation pharmacy names |
| I-5 | MongoDB injection leaking data | Any endpoint with user-supplied query params | Attacker sends `{"$gt": ""}` as email to bypass user lookup in login | Zod schema validates `email` as `.string().email()` — must be a valid email string; MongoDB queries use driver-level parameterization | ✅ IMPLEMENTED | High | Zod prevents operator injection for validated fields; unvalidated `search` query param in credentials list passed through string comparison (no direct MongoDB query injection risk given in-memory filtering) |
| I-6 | Content hash and dispensation data exposed publicly | `GET /api/verify/:id` | Any unauthenticated party enumerates credential IDs and collects `contentHash`, `dispensations`, `status`, timing metadata | No mitigation — endpoint has no auth and no rate limit in code | ❌ NOT IMPLEMENTED | Medium | UUIDs are not secret; `contentHash` exposure allows offline preimage analysis attempts |
| I-7 | Pickup PIN exposure in DB breach | `credentials.pickup_pin` | DB breach reveals plaintext 6-digit PINs for all active credentials | No mitigation — PINs stored as plaintext strings | ❌ NOT IMPLEMENTED | Medium | 6-digit PIN has only 900,000 values; brute-force at pharmacy counter possible without lockout |

---

### D — Denial of Service

> Threats that make the system unavailable or degrade service.

| # | Threat | Affected Component | Attack Scenario | Mitigation Implemented | Status | Severity | Residual Risk |
|---|---|---|---|---|---|---|---|
| D-1 | Brute-force auth endpoint | `POST /api/auth/login` | Attacker cycles through password list against known email addresses; 5 attempts/minute per IP | Sliding-window in-memory rate limiter: 5 attempts per 60s per IP | ⚠️ PARTIAL | High | Rate limiter is in-memory, resets on process restart; does not scale across multiple instances; IP-based limit is bypassable with IP rotation / proxies; no CAPTCHA or account lockout after N failures |
| D-2 | Verification endpoint flood | `POST /api/verify/init`, `POST /api/verify/exchange` | Attacker floods verification with random UUIDs, causing DB hammering and in-memory session accumulation | Rate limit: 10 attempts/60s per IP; max 3 active sessions per credential; 60s session TTL with cleanup | ⚠️ PARTIAL | High | Same in-memory limitations as D-1; `verificationSessions` Map grows unbounded during an attack until cleanup runs (every 60s); no global session count limit |
| D-3 | Credential creation flood with large payloads | `POST /api/prescriptions` | Authenticated provider sends prescriptions with very large `notes` strings or hundreds of items | Zod schema validates items as array with `.min(1)` but no `.max()` limit; `notes` is `z.string()` with no max length | ❌ NOT IMPLEMENTED | Medium | No maximum payload size enforced at schema level; large prescription payloads increase DB storage and canonicalization CPU cost |
| D-4 | Public credential/dispensation endpoint enumeration | `GET /api/verify/:id`, `GET /api/dispensations/:id` | Attacker floods these unauthenticated endpoints with UUIDs; no rate limiting present in route code | No rate limiting on these GET endpoints | ❌ NOT IMPLEMENTED | Medium | MongoDB queries on every request; no caching layer; could exhaust DB connection pool |

---

### E — Elevation of Privilege

> Threats where an actor gains capabilities beyond what they are authorized for.

| # | Threat | Affected Component | Attack Scenario | Mitigation Implemented | Status | Severity | Residual Risk |
|---|---|---|---|---|---|---|---|
| E-1 | Self-register as ADMIN | `POST /api/auth/register` | Attacker calls `/api/auth/register` with `{"role": "ADMIN", ...}` | No mitigation — `registerSchema` accepts all four roles including `ADMIN` | ❌ NOT IMPLEMENTED | **Critical** | Any attacker with network access to the API can gain full admin privileges |
| E-2 | Patient accessing provider/admin endpoints | All role-guarded routes | Patient JWT is used to call `POST /api/prescriptions` | `requireRole(['PROVIDER', 'ADMIN'])` checked server-side on all privileged routes | ✅ IMPLEMENTED | High | Role is embedded in JWT; if JWT_SECRET is known, attacker can mint a token with any role |
| E-3 | Unauthenticated access to patient data | `GET /api/credentials`, `GET /api/patients` | Unauthenticated request to patient list endpoint | `requireRole` called at top of each handler; returns 401 if no valid JWT | ✅ IMPLEMENTED | High | Only protected if JWT_SECRET is strong; fallback default secret renders this ineffective |
| E-4 | Provider accessing another provider's credentials | `GET /api/credentials/:id`, `POST /api/prescriptions` | Provider A's token used to view Provider B's credential or revoke it | Ownership check: provider's `_id` must match `prescription.provider_id` | ✅ IMPLEMENTED | High | Correctly implemented for individual credential access; less clear for list endpoint which filters in-memory post-fetch |
| E-5 | Provider accessing admin routes | `GET /api/admin/stats`, `POST /api/providers/:id/approve` | Provider JWT used against admin endpoints | `requireRole(['ADMIN'])` enforced on admin-only routes | ✅ IMPLEMENTED | High | Valid as long as JWT_SECRET is not compromised |
| E-6 | PHARMACIST role not restricted from non-dispensation endpoints | Various authenticated routes | Pharmacist JWT used against provider endpoints | Pharmacist role not in `requireRole` allowlists for provider/admin endpoints | ✅ IMPLEMENTED | Medium | Pharmacist can access `GET /api/credentials` (requires `ADMIN|PROVIDER|PATIENT` — pharmacist is excluded), but edge cases in role schema could be exploited |

---

## 6. Security Assumptions

The following assumptions are **required** for the threat model to hold. If any assumption is violated, the residual risk of several threats escalates to **Critical**.

1. **MongoDB is not directly internet-exposed.** It listens on `localhost` or a private network only. No MongoDB auth is enforced in the codebase; if the DB is reachable, anyone can connect.
2. **TLS (HTTPS) is enforced in production by the hosting platform** (e.g., Vercel, Nginx proxy). The application code does not enforce HTTPS redirects or set HSTS headers.
3. **The server environment is not directly accessible to users.** Environment variables (`JWT_SECRET`, `REFRESH_SECRET`, `KEY_ENCRYPTION_KEY`) are protected by the hosting environment.
4. **The `KEY_ENCRYPTION_KEY` is generated independently of the database content.** A combined DB + KEK breach would defeat all private key encryption.
5. **Node.js `crypto.randomBytes` is seeded by a cryptographically secure PRNG.** This is a standard Node.js guarantee on supported platforms.
6. **The `x-forwarded-for` header reflects the true client IP** when behind a reverse proxy. If the proxy is misconfigured or absent, IP-based rate limiting is bypassable.
7. **bcrypt at cost factor 12 is computationally infeasible to reverse** for strong passwords. Weak passwords (e.g., `password123` used in demo accounts) remain vulnerable to dictionary attacks.
8. **Ed25519 key pairs generated by Node.js `crypto.generateKeyPairSync`** produce cryptographically secure keys. This is a standard library guarantee.

---

## 7. Known Residual Risks

The following risks are **confirmed unmitigated** as of the current codebase and should be prioritized:

> [!CAUTION]
> These are concrete, exploitable gaps — not theoretical concerns.

| Priority | Risk | STRIDE Category | Recommended Fix |
|---|---|---|---|
| 🔴 **P0** | Any unauthenticated user can self-register as `ADMIN` | E, S | Remove `ADMIN` from `registerSchema.role` enum; admin accounts must be seeded or promoted via existing admin |
| 🔴 **P0** | Hardcoded fallback JWT/REFRESH/KEK secrets in source code | I, S | Remove all hardcoded defaults; fail fast if not set (extend `STRICT_ENV_CHECK` to cover `REFRESH_SECRET`) |
| 🔴 **P1** | `err.message` returned verbatim in 500 responses | I | Use generic error messages in production; log full errors server-side only |
| 🟠 **P1** | `GET /api/verify/:id` and `GET /api/dispensations/:id` have no auth and no rate limit | D, I | Add rate limiting; consider requiring nonce even for quick-lookup |
| 🟠 **P1** | Pickup PINs stored in plaintext | I | Hash PINs with bcrypt before storage; compare with `bcrypt.compare` |
| 🟠 **P2** | In-memory rate limiter resets on restart and is bypassable with IP rotation | D | Replace with Redis-backed rate limiter (e.g., `rate-limiter-flexible`) |
| 🟡 **P2** | Audit logs are mutable in MongoDB | R, T | Forward logs to append-only external sink (e.g., S3, syslog, Loki) |
| 🟡 **P2** | No maximum prescription payload size | D | Add `.max()` limits to Zod schemas for `items` array and `notes` string |
| 🟡 **P3** | No account lockout after repeated failed logins | D, S | Implement progressive delay or hard lockout after 10 failures |
| 🟡 **P3** | CORS set to `*` | I, S | Restrict to known frontend origin(s) in production |
| 🟡 **P3** | No HSTS header | T | Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` |
| 🟡 **P3** | `REFRESH_SECRET` not validated by `env-check.js` | I | Add `REFRESH_SECRET` length check alongside `JWT_SECRET` |

---

## 8. Incident Response Recommendations

### 8.1 JWT Secret Compromise

1. **Immediately** rotate `JWT_SECRET` and `REFRESH_SECRET` in the deployment environment.
2. Restart all API instances — all existing tokens are immediately invalidated.
3. Force all users to re-authenticate.
4. Audit logs for abnormal role usage or privilege escalation in the hours before detection.

### 8.2 MongoDB Breach

1. **Assume all private keys are compromised** — the KEK is likely also exposed.
2. Immediately rotate `KEY_ENCRYPTION_KEY` and re-encrypt all provider keys.
3. Revoke all credentials signed by any provider key that may have been extracted.
4. Notify all affected providers and patients per applicable breach notification laws (HIPAA, etc.).
5. Regenerate Ed25519 key pairs for all providers.
6. Review and export audit logs before DB access is cut off.

### 8.3 Unauthorized Admin Account Detected

1. Immediately disable the account (`DELETE /users` or MongoDB update `{ active: false }`).
2. Audit all actions performed under that account ID in `audit_logs`.
3. Check for newly approved providers — they may need to be de-activated.
4. Deploy the fix to remove `ADMIN` from the public registration schema.

### 8.4 Private Key Used to Forge Prescriptions

1. Identify the compromised provider from the `issuer_keys` collection.
2. Mark the key as `is_active: false` in `issuer_keys`.
3. Revoke all credentials signed with that key.
4. Generate a new Ed25519 key pair for the provider.
5. Notify affected pharmacies and patients.

### 8.5 Monitoring Recommendations

- Alert on: >10 `LOGIN_FAILED` events for a single `actor_id` in 5 minutes.
- Alert on: Any `USER_REGISTERED` with `role: ADMIN`.
- Alert on: `CREDENTIAL_DISPENSED` events outside normal business hours.
- Alert on: Any 500-series errors in the auth route.
- Alert on: MongoDB connection errors (potential DB tampering/outage).
