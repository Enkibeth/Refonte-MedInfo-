import { describe, expect, it } from 'vitest';

import { calcScoreIds, withoutCalcDuplicates } from '@/chat/cardDedupe';

describe('puce CALC et carte Scores sur le même score', () => {
  it('la carte Scores qui doublonne une puce disparaît, les autres restent', () => {
    const covered = calcScoreIds(['curb65', 'grace']);
    expect([...covered]).toEqual(['curb-65']);
    const actions = [
      { tool: 'scores' as const, param: 'CURB-65' },
      { tool: 'scores' as const, param: 'HAS-BLED' },
      { tool: 'ecos' as const, param: 'Pneumologie' },
    ];
    expect(withoutCalcDuplicates(actions, covered)).toEqual(actions.slice(1));
  });

  it('sans puce : rien n’est retiré', () => {
    const actions = [{ tool: 'scores' as const, param: 'CURB-65' }];
    expect(withoutCalcDuplicates(actions, new Set())).toBe(actions);
  });
});
