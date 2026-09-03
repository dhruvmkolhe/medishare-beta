import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'bg-green-100 text-green-800 border-green-200';
    case 'REVOKED': return 'bg-red-100 text-red-800 border-red-200';
    case 'EXPIRED': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'SUPERSEDED': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'DISPENSED': return 'bg-purple-100 text-purple-800 border-purple-200';
    default: return 'bg-slate-100 text-slate-800 border-slate-200';
  }
}

export function getVerificationColor(result: 'PASS' | 'FAIL'): string {
  return result === 'PASS'
    ? 'bg-green-50 border-green-200 text-green-800'
    : 'bg-red-50 border-red-200 text-red-800';
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    PATIENT: 'Patient',
    PROVIDER: 'Healthcare Provider',
    PHARMACIST: 'Pharmacist',
    ADMIN: 'Administrator',
  };
  return labels[role] || role;
}

export function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    USER_REGISTERED: 'User Registered',
    LOGIN_SUCCESS: 'Login Success',
    LOGIN_FAILED: 'Login Failed',
    PRESCRIPTION_CREATED: 'Prescription Created',
    CREDENTIAL_SIGNED: 'Credential Signed',
    CREDENTIAL_REVOKED: 'Credential Revoked',
    VERIFICATION_ATTEMPTED: 'Verification Attempted',
    PROVIDER_APPROVED: 'Provider Approved',
    KEY_ROTATED: 'Key Rotated',
    USER_ROLE_CHANGED: 'Role Changed',
    CREDENTIAL_DISPENSED: 'Credential Dispensed',
  };
  return labels[action] || action.replace(/_/g, ' ');
}
