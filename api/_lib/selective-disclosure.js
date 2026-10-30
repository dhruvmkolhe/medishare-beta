/**
 * Selective Disclosure Module — Merkle Tree Commitment Scheme
 *
 * Architecture:
 *   1. Doctor creates prescription with Merkle-committed fields
 *   2. Patient selects fields to disclose
 *   3. Patient generates a disclosure proof (revealed leaves + Merkle paths)
 *   4. Pharmacist verifies proof without seeing undisclosed fields
 *
 * This is a simplified binary Merkle tree implementation using SHA-256.
 * Each leaf = SHA-256(salt + ":" + fieldName + ":" + fieldValue)
 * Salt prevents dictionary attacks on known medication names.
 */

import crypto from 'crypto';

// Generate a random salt for each field commitment
export function generateFieldSalt() {
  return crypto.randomBytes(16).toString('hex');
}

// Commit a single field: H(salt + ":" + name + ":" + value)
export function commitField(salt, fieldName, fieldValue) {
  const input = `${salt}:${fieldName}:${JSON.stringify(fieldValue)}`;
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

// Hash two nodes together (for Merkle tree construction)
function hashNodes(left, right) {
  // Sort to make tree deterministic regardless of order
  const [a, b] = left <= right ? [left, right] : [right, left];
  return crypto.createHash('sha256').update(a + b, 'utf8').digest('hex');
}

// Build a Merkle tree from leaf hashes
// Returns array of levels: levels[0] = leaves, levels[last] = [root]
export function buildMerkleTree(leaves) {
  if (leaves.length === 0) return [['']];
  const levels = [leaves.slice()];
  let current = leaves.slice();
  while (current.length > 1) {
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        next.push(hashNodes(current[i], current[i + 1]));
      } else {
        next.push(current[i]); // Odd leaf bubbles up
      }
    }
    levels.push(next);
    current = next;
  }
  return levels;
}

// Get the Merkle root from leaf hashes
export function getMerkleRoot(leaves) {
  const levels = buildMerkleTree(leaves);
  return levels[levels.length - 1][0];
}

// Generate Merkle proof (sibling path) for a leaf at index
export function getMerkleProof(leaves, leafIndex) {
  const levels = buildMerkleTree(leaves);
  const proof = [];
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

// Verify a Merkle proof for a leaf
export function verifyMerkleProof(leafHash, proof, expectedRoot) {
  let current = leafHash;
  for (const step of proof) {
    if (step.position === 'left') {
      current = hashNodes(step.sibling, current);
    } else {
      current = hashNodes(current, step.sibling);
    }
  }
  return current === expectedRoot;
}

/**
 * Create field commitments for prescription items.
 * Returns an array of { fieldName, fieldValue, salt, commitment } objects.
 * The salts are stored with the credential for later disclosure.
 */
export function createPrescriptionCommitments(items, notes) {
  const commitments = [];

  // Commit each medication item separately
  items.forEach((item, i) => {
    const fields = ['medication', 'strength', 'dosage', 'duration', 'timing', 'refills'];
    fields.forEach(field => {
      if (item[field] !== undefined && item[field] !== '') {
        const salt = generateFieldSalt();
        const commitment = commitField(salt, `item${i}.${field}`, item[field]);
        commitments.push({
          fieldName: `item${i}.${field}`,
          fieldValue: item[field],
          salt,
          commitment,
          itemIndex: i,
        });
      }
    });
  });

  // Commit notes
  if (notes) {
    const salt = generateFieldSalt();
    commitments.push({
      fieldName: 'notes',
      fieldValue: notes,
      salt,
      commitment: commitField(salt, 'notes', notes),
    });
  }

  return commitments;
}

/**
 * Build Merkle root from commitments array.
 */
export function buildCommitmentRoot(commitments) {
  const leaves = commitments.map(c => c.commitment);
  return getMerkleRoot(leaves);
}

/**
 * Generate a selective disclosure proof.
 * revealedFieldNames: array of fieldName strings to disclose (e.g., ['item0.medication', 'item0.strength'])
 * Returns { disclosedFields, proofs, merkleRoot } — enough for a verifier to verify without seeing hidden fields.
 */
export function generateDisclosureProof(commitments, revealedFieldNames) {
  const leaves = commitments.map(c => c.commitment);
  const merkleRoot = getMerkleRoot(leaves);

  const disclosedFields = [];
  const proofs = [];

  revealedFieldNames.forEach(name => {
    const idx = commitments.findIndex(c => c.fieldName === name);
    if (idx === -1) return;
    const c = commitments[idx];
    const proof = getMerkleProof(leaves, idx);
    disclosedFields.push({
      fieldName: c.fieldName,
      fieldValue: c.fieldValue,
      salt: c.salt,
      commitment: c.commitment,
    });
    proofs.push({ fieldName: c.fieldName, leafIndex: idx, merkleProof: proof });
  });

  return { disclosedFields, proofs, merkleRoot };
}

/**
 * Verify a selective disclosure proof.
 * Returns { valid: boolean, verifiedFields: string[], errors: string[] }
 */
export function verifyDisclosureProof(disclosedFields, proofs, merkleRoot) {
  const errors = [];
  const verifiedFields = [];

  for (const disclosed of disclosedFields) {
    // Recompute leaf commitment from revealed field
    const recomputed = commitField(disclosed.salt, disclosed.fieldName, disclosed.fieldValue);
    if (recomputed !== disclosed.commitment) {
      errors.push(`Commitment mismatch for field: ${disclosed.fieldName}`);
      continue;
    }
    // Find matching proof
    const proofEntry = proofs.find(p => p.fieldName === disclosed.fieldName);
    if (!proofEntry) {
      errors.push(`Missing Merkle proof for field: ${disclosed.fieldName}`);
      continue;
    }
    // Verify Merkle proof
    if (!verifyMerkleProof(recomputed, proofEntry.merkleProof, merkleRoot)) {
      errors.push(`Merkle proof failed for field: ${disclosed.fieldName}`);
      continue;
    }
    verifiedFields.push(disclosed.fieldName);
  }

  return { valid: errors.length === 0, verifiedFields, errors };
}
