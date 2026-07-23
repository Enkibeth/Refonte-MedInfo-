import { describe, it, expect } from 'vitest';

import { splitModeEnabled, buildBriefSection } from '@/ai/chat/split';

describe('splitModeEnabled — flag serveur (OFF par défaut)', () => {
  it('activé uniquement par CHAT_ORCHESTRATOR_SPLIT=on (insensible à la casse/espaces)', () => {
    expect(splitModeEnabled({ CHAT_ORCHESTRATOR_SPLIT: 'on' })).toBe(true);
    expect(splitModeEnabled({ CHAT_ORCHESTRATOR_SPLIT: 'ON' })).toBe(true);
    expect(splitModeEnabled({ CHAT_ORCHESTRATOR_SPLIT: '  On  ' })).toBe(true);
  });

  it('désactivé par défaut et pour toute autre valeur', () => {
    expect(splitModeEnabled({})).toBe(false);
    expect(splitModeEnabled({ CHAT_ORCHESTRATOR_SPLIT: '' })).toBe(false);
    expect(splitModeEnabled({ CHAT_ORCHESTRATOR_SPLIT: 'off' })).toBe(false);
    expect(splitModeEnabled({ CHAT_ORCHESTRATOR_SPLIT: 'true' })).toBe(false);
    expect(splitModeEnabled({ CHAT_ORCHESTRATOR_SPLIT: '1' })).toBe(false);
  });
});

describe('buildBriefSection — injection du dossier de preuves dans le rédacteur', () => {
  it('dossier vide → chaîne vide (repli prudent)', () => {
    expect(buildBriefSection('')).toBe('');
    expect(buildBriefSection('   ')).toBe('');
    expect(buildBriefSection(undefined as unknown as string)).toBe('');
  });

  it('dossier non vide → section balisée contenant le dossier et la consigne cite-only', () => {
    const brief = 'OFFICIEL :: HAS :: HTA 2024 :: https://has-sante.fr/x :: cible < 140/90';
    const section = buildBriefSection(brief);
    expect(section).toContain('DOSSIER DE PREUVES');
    expect(section).toContain(brief);
    expect(section).toContain('--- DÉBUT DU DOSSIER ---');
    expect(section).toContain('--- FIN DU DOSSIER ---');
    // Consigne anti-hallucination transmise au rédacteur.
    expect(section).toContain("N'invente AUCUNE autre source");
  });
});
