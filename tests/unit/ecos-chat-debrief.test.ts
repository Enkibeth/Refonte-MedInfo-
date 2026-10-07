import { describe, expect, it } from 'vitest';

import { DEBRIEF_EVALUATION_MAX_CHARS, ecosDebriefMessage } from '@/ecos/chatDebrief';

describe('passerelle ECOS → chat', () => {
  it('reprend la station, la note et l’évaluation, puis demande un débriefing actif', () => {
    const text = ecosDebriefMessage({
      title: 'Douleur thoracique',
      specialty: 'Cardiologie · Urgences',
      score: 12.5,
      evaluation: '**Note : 12,5/20**\n- ECG non demandé',
    })!;
    expect(text).toContain('« Douleur thoracique » (Cardiologie · Urgences, cas fictif). Ma note : 12,5/20.');
    expect(text).toContain('- ECG non demandé');
    expect(text).toMatch(/3 questions pour vérifier/);
  });

  it('sans note ni spécialité : message toujours lisible', () => {
    const text = ecosDebriefMessage({ title: 'Cas', evaluation: 'Feedback' })!;
    expect(text).toContain('(cas fictif). Voici');
    expect(text).not.toContain('Ma note');
  });

  it('évaluation vide : rien à transmettre ; longue : tronquée et signalée', () => {
    expect(ecosDebriefMessage({ title: 'Cas', evaluation: '   ' })).toBeNull();
    const long = ecosDebriefMessage({ title: 'Cas', evaluation: 'x'.repeat(DEBRIEF_EVALUATION_MAX_CHARS + 500) })!;
    expect(long).toContain('[…]');
    expect(long.length).toBeLessThan(DEBRIEF_EVALUATION_MAX_CHARS + 1000);
  });

  it('aucun tiret cadratin dans le message', () => {
    expect(ecosDebriefMessage({ title: 'Cas', specialty: 'Gériatrie', score: 15, evaluation: 'ok' })).not.toContain('—');
  });
});
