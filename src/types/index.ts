export interface User {
  id: string;
  email: string;
  role: 'PATIENT' | 'PROVIDER' | 'PHARMACIST' | 'ADMIN';
  created_at: string;
}

export interface Provider {
  id: string;
  user_id: string;
  name: string;
  license_number: string;
  approved_at: string | null;
  approved_by: string | null;
  users?: { email: string };
}

export interface Patient {
  id: string;
  user_id: string;
  patient_reference: string;
  display_name: string;
  users?: { email: string };
}

export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  medication: string;
  strength: string;
  dosage: string;
  duration: string;
  timing: string;
  refills: number;
  sort_order: number;
}

export interface Prescription {
  id: string;
  provider_id: string;
  patient_id: string;
  medication: string;
  strength: string;
  dosage: string;
  duration: string;
  notes: string;
  created_at: string;
  items?: PrescriptionItem[];
  providers?: { name: string };
  patients?: { display_name: string; patient_reference: string };
}

export interface Credential {
  id: string;
  credential_id: string;
  prescription_id: string;
  issuer_key_id: string;
  content_hash: string;
  signature: string;
  issued_at: string;
  expires_at: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'SUPERSEDED' | 'DISPENSED';
  created_at: string;
  updated_at: string;
  pickup_pin?: string;
  prescriptions?: Prescription;
}

export interface VerificationCheck {
  passed: boolean;
  label: string;
}

export interface VerificationResult {
  result: 'PASS' | 'FAIL';
  checks: Record<string, VerificationCheck>;
  credential: {
    medication: string;
    strength: string;
    dosage: string;
    duration: string;
    items?: PrescriptionItem[];
    issued_at: string;
    expires_at: string;
    provider_name: string;
    status: string;
    dispensation?: {
      dispensed_at: string;
      pharmacy_name: string;
    } | null;
    refills_total?: number;
    refills_remaining?: number;
    dispensation_count?: number;
    max_dispensations?: number;
    has_pickup_pin?: boolean;
  };
  failureReason: string | null;
  eventId: string;
}

export interface Dispensation {
  id: string;
  credential_id: string;
  dispensed_by: string | null;
  pharmacy_name: string;
  notes: string;
  dispensed_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface FieldDiff {
  field: string;
  original: string;
  current: string;
  changed: boolean;
}
