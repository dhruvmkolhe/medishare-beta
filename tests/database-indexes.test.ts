import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoClient } from 'mongodb';
import { createIndexes } from '../scripts/setup-indexes.js';

describe('MongoDB Database Indexes & Integrity Constraints Suite', () => {
  let client: MongoClient;
  let db: any;

  beforeAll(async () => {
    client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
    await client.connect();
    db = client.db(process.env.MONGODB_DB_NAME || 'medishare');
    await createIndexes(db);
  });

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  describe('Index Existence Verification', () => {
    it('verifies unique index on users.email exists', async () => {
      const indexes = await db.collection('users').indexes();
      const emailIdx = indexes.find((i: any) => i.name === 'uniq_user_email' || (i.key && i.key.email === 1));
      expect(emailIdx).toBeDefined();
      expect(emailIdx.unique).toBe(true);
    });

    it('verifies unique index on credentials.credential_id exists', async () => {
      const indexes = await db.collection('credentials').indexes();
      const credIdx = indexes.find((i: any) => i.name === 'uniq_credential_uuid' || (i.key && i.key.credential_id === 1));
      expect(credIdx).toBeDefined();
      expect(credIdx.unique).toBe(true);
    });

    it('verifies performance indexes on prescriptions collection', async () => {
      const indexes = await db.collection('prescriptions').indexes();
      const patientIdx = indexes.find((i: any) => i.key && i.key.patient_id === 1);
      const providerIdx = indexes.find((i: any) => i.key && i.key.provider_id === 1);
      const createdIdx = indexes.find((i: any) => i.key && i.key.created_at === -1);

      expect(patientIdx).toBeDefined();
      expect(providerIdx).toBeDefined();
      expect(createdIdx).toBeDefined();
    });

    it('verifies performance index on audit_logs.created_at exists', async () => {
      const indexes = await db.collection('audit_logs').indexes();
      const auditCreatedIdx = indexes.find((i: any) => i.key && i.key.created_at === -1);
      expect(auditCreatedIdx).toBeDefined();
    });
  });

  describe('Integrity & Duplicate Rejection Enforcement', () => {
    it('rejects duplicate email insertions at database level with Mongo E11000', async () => {
      const testEmail = `duplicate.test.${Date.now()}@example.com`;

      // First insertion succeeds
      const insert1 = await db.collection('users').insertOne({
        email: testEmail,
        role: 'PATIENT',
        created_at: new Date().toISOString()
      });
      expect(insert1.insertedId).toBeDefined();

      // Second insertion with identical email must throw code 11000
      let duplicateError: any = null;
      try {
        await db.collection('users').insertOne({
          email: testEmail,
          role: 'PATIENT',
          created_at: new Date().toISOString()
        });
      } catch (err: any) {
        duplicateError = err;
      }

      // Cleanup
      await db.collection('users').deleteOne({ _id: insert1.insertedId });

      expect(duplicateError).not.toBeNull();
      expect(duplicateError.code).toBe(11000);
    });

    it('rejects duplicate credential_id UUID at database level with Mongo E11000', async () => {
      const testUuid = `test-uuid-${Date.now()}`;

      // First insertion succeeds
      const insert1 = await db.collection('credentials').insertOne({
        credential_id: testUuid,
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      });
      expect(insert1.insertedId).toBeDefined();

      // Second insertion with identical credential_id must throw code 11000
      let duplicateError: any = null;
      try {
        await db.collection('credentials').insertOne({
          credential_id: testUuid,
          status: 'ACTIVE',
          created_at: new Date().toISOString()
        });
      } catch (err: any) {
        duplicateError = err;
      }

      // Cleanup
      await db.collection('credentials').deleteOne({ _id: insert1.insertedId });

      expect(duplicateError).not.toBeNull();
      expect(duplicateError.code).toBe(11000);
    });
  });
});
