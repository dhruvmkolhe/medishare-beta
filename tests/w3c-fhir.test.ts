import { describe, it, expect } from 'vitest';

describe('W3C Verifiable Credential & FHIR R4 Export Compliance', () => {
  function buildW3CCredential(params: {
    credentialId: string;
    providerId: string;
    providerName: string;
    patientRef: string;
    patientName: string;
    items: any[];
    notes: string;
    signature: string;
    keyId: string;
    status: string;
    issuedAt: string;
    expiresAt: string;
  }) {
    const statusMap: Record<string, string> = { ACTIVE: 'active', REVOKED: 'revoked', DISPENSED: 'dispensed', EXPIRED: 'expired' };

    return {
      '@context': [
        'https://www.w3.org/ns/credentials/v2',
        'https://w3id.org/security/suites/ed25519-2020/v1'
      ],
      id: `urn:uuid:${params.credentialId}`,
      type: ['VerifiableCredential', 'PrescriptionCredential'],
      issuer: {
        id: `did:web:medishare.example:provider:${params.providerId}`,
        name: params.providerName,
      },
      validFrom: params.issuedAt,
      validUntil: params.expiresAt,
      credentialSubject: {
        id: `did:web:medishare.example:patient:${params.patientRef}`,
        name: params.patientName,
        prescription: {
          medications: params.items,
          notes: params.notes || '',
        },
      },
      credentialStatus: {
        type: 'StatusList2021Entry',
        statusPurpose: 'revocation',
        currentStatus: statusMap[params.status] || params.status.toLowerCase(),
      },
      proof: {
        type: 'Ed25519Signature2020',
        created: params.issuedAt,
        verificationMethod: `did:web:medishare.example:provider:${params.providerId}#key-${params.keyId}`,
        proofPurpose: 'assertionMethod',
        proofValue: params.signature,
      },
    };
  }

  function buildFHIRBundle(params: {
    credentialId: string;
    issuedAt: string;
    expiresAt: string;
    status: string;
    patientName: string;
    patientRef: string;
    providerName: string;
    items: any[];
    notes: string;
  }) {
    const fhirStatusMap: Record<string, string> = { ACTIVE: 'active', REVOKED: 'cancelled', DISPENSED: 'completed', EXPIRED: 'stopped' };

    return {
      resourceType: 'Bundle',
      id: params.credentialId,
      type: 'document',
      timestamp: params.issuedAt,
      entry: params.items.map((med, index) => ({
        fullUrl: `urn:uuid:${params.credentialId}-med-${index}`,
        resource: {
          resourceType: 'MedicationRequest',
          id: `${params.credentialId}-med-${index}`,
          status: fhirStatusMap[params.status] || 'unknown',
          intent: 'order',
          medicationCodeableConcept: {
            text: `${med.medication} ${med.strength}`,
          },
          subject: {
            display: params.patientName,
            reference: `Patient/${params.patientRef}`,
          },
          requester: {
            display: params.providerName,
          },
          authoredOn: params.issuedAt,
          dosageInstruction: [{
            text: med.dosage,
            timing: { code: { text: med.timing || med.duration || '' } },
          }],
          dispenseRequest: {
            numberOfRepeatsAllowed: med.refills || 0,
            validityPeriod: {
              start: params.issuedAt,
              end: params.expiresAt,
            },
          },
          note: params.notes ? [{ text: params.notes }] : [],
        },
      })),
    };
  }

  const sampleData = {
    credentialId: 'c9c52004-6fb3-4654-8fbd-2bd360802816',
    providerId: '6a993e3f16b67b1770f76578',
    providerName: 'Dr. Rajesh Sharma, MD',
    patientRef: 'PAT-1001',
    patientName: 'John Doe',
    items: [
      { medication: 'Atorvastatin', strength: '40 mg', dosage: '1 tablet nightly', duration: '30 days', timing: 'Bedtime', refills: 2 }
    ],
    notes: 'Take with or without food',
    signature: 'mockSignatureBase64...',
    keyId: 'key-123',
    status: 'ACTIVE',
    issuedAt: '2026-09-01T10:00:00.000Z',
    expiresAt: '2026-10-01T10:00:00.000Z'
  };

  it('generates valid W3C Verifiable Credential standard compliant document', () => {
    const vc = buildW3CCredential(sampleData);

    expect(vc['@context']).toContain('https://www.w3.org/ns/credentials/v2');
    expect(vc.type).toContain('VerifiableCredential');
    expect(vc.id).toBe(`urn:uuid:${sampleData.credentialId}`);
    expect(vc.issuer.id).toContain('did:web:');
    expect(vc.issuer.name).toBe('Dr. Rajesh Sharma, MD');
    expect(vc.credentialSubject.prescription.medications).toHaveLength(1);
    expect(vc.proof.type).toBe('Ed25519Signature2020');
    expect(vc.proof.proofValue).toBe('mockSignatureBase64...');
    expect(vc.credentialStatus.currentStatus).toBe('active');
  });

  it('generates valid HL7 FHIR R4 Bundle with MedicationRequest resources', () => {
    const bundle = buildFHIRBundle(sampleData);

    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('document');
    expect(bundle.entry).toHaveLength(1);

    const medReq = bundle.entry[0].resource;
    expect(medReq.resourceType).toBe('MedicationRequest');
    expect(medReq.status).toBe('active');
    expect(medReq.intent).toBe('order');
    expect(medReq.medicationCodeableConcept.text).toBe('Atorvastatin 40 mg');
    expect(medReq.dispenseRequest.numberOfRepeatsAllowed).toBe(2);
    expect(medReq.subject.reference).toBe('Patient/PAT-1001');
    expect(medReq.requester.display).toBe('Dr. Rajesh Sharma, MD');
  });
});
