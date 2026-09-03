import { describe, it, expect } from 'vitest';

describe('Prescription Refill & Dispensation Business Logic', () => {
  function calculateMaxDispensations(items: { refills?: number }[]): number {
    const maxRefills = items.length > 0 ? Math.max(...items.map(i => i.refills || 0)) : 0;
    return 1 + maxRefills;
  }

  function simulateDispensation(currentCount: number, maxDisp: number, currentStatus: string) {
    if (['DISPENSED', 'REVOKED', 'EXPIRED'].includes(currentStatus)) {
      return { error: `Credential is ${currentStatus.toLowerCase()} and cannot be dispensed` };
    }
    if (currentCount >= maxDisp) {
      return { error: 'All authorized dispensations have been used' };
    }

    const newCount = currentCount + 1;
    const remaining = maxDisp - newCount;
    const newStatus = newCount >= maxDisp ? 'DISPENSED' : 'ACTIVE';

    return {
      success: true,
      dispensationNumber: newCount,
      remaining,
      totalAuthorized: maxDisp,
      newStatus
    };
  }

  it('calculates max dispensations correctly for single and multi-medication items', () => {
    // 0 refills => 1 fill total
    expect(calculateMaxDispensations([{ refills: 0 }])).toBe(1);

    // 2 refills => 3 fills total
    expect(calculateMaxDispensations([{ refills: 2 }])).toBe(3);

    // Multi-medication with different refill counts takes the maximum
    expect(calculateMaxDispensations([
      { refills: 1 },
      { refills: 3 },
      { refills: 0 }
    ])).toBe(4);
  });

  it('transitions status to DISPENSED when final fill is exhausted', () => {
    const maxFills = 2; // 1 initial fill + 1 refill

    // First fill: 1 remaining, status ACTIVE
    const fill1 = simulateDispensation(0, maxFills, 'ACTIVE');
    expect(fill1.success).toBe(true);
    expect(fill1.dispensationNumber).toBe(1);
    expect(fill1.remaining).toBe(1);
    expect(fill1.newStatus).toBe('ACTIVE');

    // Second fill: 0 remaining, status transitions to DISPENSED
    const fill2 = simulateDispensation(1, maxFills, 'ACTIVE');
    expect(fill2.success).toBe(true);
    expect(fill2.dispensationNumber).toBe(2);
    expect(fill2.remaining).toBe(0);
    expect(fill2.newStatus).toBe('DISPENSED');

    // Attempting fill 3 should fail
    const fill3 = simulateDispensation(2, maxFills, 'DISPENSED');
    expect(fill3.error).toBeDefined();
    expect(fill3.error).toContain('cannot be dispensed');
  });

  it('blocks dispensation for REVOKED and EXPIRED credentials', () => {
    const revoked = simulateDispensation(0, 3, 'REVOKED');
    expect(revoked.error).toContain('revoked');

    const expired = simulateDispensation(0, 3, 'EXPIRED');
    expect(expired.error).toContain('expired');
  });
});
