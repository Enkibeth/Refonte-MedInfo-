import { describe, expect, it } from 'vitest';

import { CANONICAL_REFUSAL } from '@/compliance/disclosures';

describe('refusal regression scaffold', () => {
  it('uses the canonical refusal text before classifier implementation', () => {
    expect(CANONICAL_REFUSAL).toMatchInlineSnapshot(`"MedInfo AI fournit de l'information médicale générale et ne peut pas analyser une situation personnelle ni orienter un diagnostic individuel. Si vous ressentez des symptômes ou une inquiétude qui vous concerne, vous ou un proche, consultez un professionnel de santé. En cas d'urgence, composez le 15 (SAMU) ou le 112. En cas de détresse psychologique ou d'idées suicidaires, composez le 3114. Pour un besoin de soins non programmés, le 116 117 peut orienter selon votre territoire ; pour une pharmacie de garde, le 3237 peut être utile selon disponibilité locale."`);
  });
});
