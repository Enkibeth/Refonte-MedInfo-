/**
 * Golden set de l'ancienne safe-box (500 messages étiquetés, récupéré à ea616fc),
 * rejoué contre la NOUVELLE politique (ADR-0029) :
 *  - rappel urgences / symptômes personnels : le regex seul doit tout capter ;
 *  - zéro sur-refus sur general_info et out_of_scope (la cause de l'ADR-0023) ;
 *  - les ambigus passent (ils vont au LLM principal, prompt v3 = filet).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { runInputGuard } from '@/ai/chat/guard';

type Row = { message: string; expected: string; adversarial: boolean };

const rows: Row[] = readFileSync(new URL('./golden/golden-set.fr.jsonl', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line) as Row);

describe('garde d’entrée — golden set (regex seul, pire cas sans étage 2)', () => {
  it('charge bien les 500 cas', () => {
    expect(rows.length).toBe(500);
  });

  it('rappel urgences = 100 % et symptômes personnels = 100 %', async () => {
    const missed: string[] = [];
    for (const row of rows) {
      if (row.expected !== 'emergency' && row.expected !== 'personal_symptoms') continue;
      const verdict = await runInputGuard(row.message);
      if (!verdict.blocked) missed.push(`${row.expected}: ${row.message}`);
    }
    expect(missed, missed.join('\n')).toHaveLength(0);
  });

  it('zéro refus sur general_info et out_of_scope (anti ADR-0023)', async () => {
    const overRefused: string[] = [];
    for (const row of rows) {
      if (row.expected !== 'general_info' && row.expected !== 'out_of_scope') continue;
      const verdict = await runInputGuard(row.message);
      if (verdict.blocked) overRefused.push(`${row.expected}: ${row.message}`);
    }
    expect(overRefused, overRefused.join('\n')).toHaveLength(0);
  });
});
