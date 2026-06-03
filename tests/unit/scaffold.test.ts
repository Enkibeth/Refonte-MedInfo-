import { describe, expect, it } from 'vitest';

import { CANONICAL_REFUSAL, INTENDED_PURPOSE } from '@/compliance/disclosures';

describe('scaffold compliance constants', () => {
  it('keeps intended purpose non-MDSW wording available in code', () => {
    expect(INTENDED_PURPOSE).toContain("information et de référence éducative");
    expect(INTENDED_PURPOSE).toContain("aucune recommandation diagnostique");
  });

  it('keeps one canonical refusal message available in code', () => {
    expect(CANONICAL_REFUSAL).toContain('ne peut pas analyser une situation personnelle');
    expect(CANONICAL_REFUSAL).toContain('15 (SAMU)');
    expect(CANONICAL_REFUSAL).toContain('112');
  });
});
