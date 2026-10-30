/**
 * Client-side Selective Disclosure utilities
 * Mirrors backend Merkle tree scheme for browser use.
 * Allows a patient to generate a cryptographic proof containing only
 * the fields they choose to share, without revealing unselected medical data.
 */

export interface Commitment {
  fieldName: string;
  fieldValue: unknown;
  salt: string;
  commitment: string;
  itemIndex?: number;
}

export interface MerkleProofStep {
  sibling: string;
  position: 'left' | 'right';
}

export interface ProofEntry {
  fieldName: string;
  leafIndex: number;
  merkleProof: MerkleProofStep[];
}

export interface DisclosureProof {
  disclosedFields: Array<{
    fieldName: string;
    fieldValue: unknown;
    salt: string;
    commitment: string;
  }>;
  proofs: ProofEntry[];
  merkleRoot: string;
}

// SHA-256 using Web Crypto API
async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashNodes(left: string, right: string): Promise<string> {
  const [a, b] = left <= right ? [left, right] : [right, left];
  return sha256(a + b);
}

async function buildMerkleTree(leaves: string[]): Promise<string[][]> {
  if (leaves.length === 0) return [['']];
  const levels: string[][] = [leaves.slice()];
  let current = leaves.slice();
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        next.push(await hashNodes(current[i], current[i + 1]));
      } else {
        next.push(current[i]);
      }
    }
    levels.push(next);
    current = next;
  }
  return levels;
}

async function getMerkleProof(leaves: string[], leafIndex: number): Promise<MerkleProofStep[]> {
  const levels = await buildMerkleTree(leaves);
  const proof: MerkleProofStep[] = [];
  let idx = leafIndex;
  for (let lvl = 0; lvl < levels.length - 1; lvl++) {
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    if (siblingIdx < levels[lvl].length) {
      proof.push({ sibling: levels[lvl][siblingIdx], position: isRight ? 'left' : 'right' });
    }
    idx = Math.floor(idx / 2);
  }
  return proof;
}

/**
 * Generate a selective disclosure proof for chosen field names.
 */
export async function generateDisclosureProof(
  commitments: Commitment[],
  revealedFieldNames: string[]
): Promise<DisclosureProof> {
  const leaves = commitments.map(c => c.commitment);
  const tree = await buildMerkleTree(leaves);
  const merkleRoot = tree[tree.length - 1][0];

  const disclosedFields: DisclosureProof['disclosedFields'] = [];
  const proofs: ProofEntry[] = [];

  for (const name of revealedFieldNames) {
    const idx = commitments.findIndex(c => c.fieldName === name);
    if (idx === -1) continue;
    const c = commitments[idx];
    const proof = await getMerkleProof(leaves, idx);
    disclosedFields.push({
      fieldName: c.fieldName,
      fieldValue: c.fieldValue,
      salt: c.salt,
      commitment: c.commitment,
    });
    proofs.push({ fieldName: c.fieldName, leafIndex: idx, merkleProof: proof });
  }

  return { disclosedFields, proofs, merkleRoot };
}
