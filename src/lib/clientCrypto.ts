/**
 * Client-Side Non-Custodial Cryptography Module
 *
 * Implements client-side Ed25519 key generation and prescription signing
 * using the W3C Web Cryptography API (`crypto.subtle`).
 *
 * Security Architecture:
 *   - The doctor's private key is generated directly in the browser.
 *   - The private key NEVER leaves the client device.
 *   - Only the public key is transmitted to and registered with MediShare.
 *   - Signing occurs locally on the doctor's device, achieving true non-custodial
 *     non-repudiation.
 */

export interface ClientKeyPair {
  publicKeyPem: string;
  privateKey: CryptoKey;
  keyId: string;
}

/**
 * Detects whether the current browser supports Ed25519 in Web Crypto API.
 * Modern Chromium (113+), Firefox (130+), and Safari (17+) support 'Ed25519'.
 */
export async function isEd25519Supported(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return false;
  try {
    const key = await window.crypto.subtle.generateKey(
      { name: 'Ed25519' },
      false, // non-extractable private key
      ['sign', 'verify']
    );
    return !!key;
  } catch {
    return false;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function formatAsSpkiPem(spkiBase64: string): string {
  const lines = spkiBase64.match(/.{1,64}/g) || [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}

/**
 * Generate an Ed25519 key pair on the doctor's device.
 * The private key is non-extractable by default.
 */
export async function generateClientKeyPair(extractable = false): Promise<ClientKeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: 'Ed25519' },
    extractable,
    ['sign', 'verify']
  ) as CryptoKeyPair;

  const spkiBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const spkiBase64 = arrayBufferToBase64(spkiBuffer);
  const publicKeyPem = formatAsSpkiPem(spkiBase64);
  const keyId = crypto.randomUUID();

  return {
    publicKeyPem,
    privateKey: keyPair.privateKey,
    keyId,
  };
}

/**
 * Sign prescription canonical data hash using client-side private key.
 */
export async function signWithClientKey(
  privateKey: CryptoKey,
  canonicalDataHash: string
): Promise<string> {
  const dataBytes = new TextEncoder().encode(canonicalDataHash);
  const signatureBuffer = await window.crypto.subtle.sign(
    { name: 'Ed25519' },
    privateKey,
    dataBytes
  );
  return arrayBufferToBase64(signatureBuffer);
}

// ---------------------------------------------------------------------------
// IndexedDB Non-Custodial Key Storage
// Stores the CryptoKey securely within the browser origin's isolated storage.
// ---------------------------------------------------------------------------

const DB_NAME = 'medishare_keyring';
const STORE_NAME = 'keys';

function openKeyringDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'keyId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeClientPrivateKey(keyId: string, privateKey: CryptoKey, publicKeyPem: string): Promise<void> {
  const db = await openKeyringDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ keyId, privateKey, publicKeyPem, createdAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadClientPrivateKey(keyId: string): Promise<CryptoKey | null> {
  const db = await openKeyringDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(keyId);
    request.onsuccess = () => resolve(request.result ? request.result.privateKey : null);
    request.onerror = () => reject(request.error);
  });
}
