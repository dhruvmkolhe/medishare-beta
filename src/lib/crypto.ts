export function canonicalize<T = any>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize) as unknown as T;

  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    const value = record[key];
    if (value === undefined) continue;
    if (typeof value === 'string') {
      result[key] = value.trim();
    } else if (typeof value === 'object' && value !== null) {
      result[key] = canonicalize(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

export function canonicalizeToString(obj: any): string {
  const canonical = canonicalize(obj);
  return JSON.stringify(canonical, (key, value) => {
    if (value === undefined) return null;
    return value;
  });
}

export async function hashCanonical(canonicalString: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function detectTamper(storedHash: string, recomputedHash: string): boolean {
  return storedHash !== recomputedHash;
}
