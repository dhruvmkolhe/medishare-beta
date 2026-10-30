/**
 * AWS KMS Adapter — Implementation Guide (NOT YET IMPLEMENTED)
 *
 * This file documents how to implement AWS KMS integration.
 * The actual implementation requires:
 *   1. npm install @aws-sdk/client-kms
 *   2. AWS credentials (IAM role or environment variables)
 *   3. An existing AWS KMS Customer Master Key (CMK)
 *
 * Required environment variables (when KMS_PROVIDER=aws):
 *   AWS_KMS_KEY_ID    — KMS key ARN or alias (e.g., arn:aws:kms:us-east-1:123:key/abc)
 *   AWS_REGION        — AWS region (e.g., us-east-1)
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY — OR use IAM instance roles
 *
 * Implementation sketch (requires @aws-sdk/client-kms):
 *
 * import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
 *
 * export function createAwsAdapter() {
 *   const client = new KMSClient({ region: process.env.AWS_REGION });
 *   const keyId = process.env.AWS_KMS_KEY_ID;
 *   if (!keyId) throw new Error('AWS_KMS_KEY_ID environment variable is required');
 *
 *   return {
 *     getProviderName() { return 'AWS KMS'; },
 *
 *     async encryptKey(privateKeyPem) {
 *       const cmd = new EncryptCommand({
 *         KeyId: keyId,
 *         Plaintext: Buffer.from(privateKeyPem, 'utf8'),
 *       });
 *       const response = await client.send(cmd);
 *       return {
 *         encryptedKey: Buffer.from(response.CiphertextBlob).toString('base64'),
 *         keyVersion: response.KeyId,
 *         metadata: { adapter: 'aws', keyId },
 *       };
 *     },
 *
 *     async decryptKey(encryptedKey, metadata) {
 *       const cmd = new DecryptCommand({
 *         CiphertextBlob: Buffer.from(encryptedKey, 'base64'),
 *         KeyId: keyId,
 *       });
 *       const response = await client.send(cmd);
 *       return Buffer.from(response.Plaintext).toString('utf8');
 *     },
 *   };
 * }
 */

// This file is documentation only. Activate by:
// 1. npm install @aws-sdk/client-kms
// 2. Uncomment the implementation above
// 3. Export createAwsAdapter
// 4. Register in api/_lib/kms/index.js case 'aws': block

export {}; // Placeholder export
