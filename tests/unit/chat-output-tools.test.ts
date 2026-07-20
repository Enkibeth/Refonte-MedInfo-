import { describe, it, expect } from 'vitest';

import {
  CHAT_OUTPUT_TOOLS,
  buildOutputToolsSection,
  coerceChatOutputTools,
} from '@/ai/chat/outputTools';

describe('outputTools — coercion', () => {
  it('ne garde que les outils connus, dédoublonnés et en ordre canonique', () => {
    expect(coerceChatOutputTools(['comparison', 'diagram', 'diagram'])).toEqual([
      'diagram',
      'comparison',
    ]);
  });

  it('ignore les valeurs inconnues et non-tableaux', () => {
    expect(coerceChatOutputTools(['diagram', 'nope', 5])).toEqual(['diagram']);
    expect(coerceChatOutputTools('diagram')).toEqual([]);
    expect(coerceChatOutputTools(null)).toEqual([]);
    expect(coerceChatOutputTools(undefined)).toEqual([]);
  });

  it('tous les outils du catalogue sont coercibles', () => {
    expect(coerceChatOutputTools(CHAT_OUTPUT_TOOLS)).toEqual(CHAT_OUTPUT_TOOLS);
  });
});

describe('buildOutputToolsSection — consigne système', () => {
  it('vide si aucun outil', () => {
    expect(buildOutputToolsSection([])).toBe('');
  });

  it('décrit le format exact du bloc diagramme quand demandé', () => {
    const section = buildOutputToolsSection(['diagram']);
    expect(section).toContain('medinfo-diagram');
    expect(section).toContain('DIAGRAMME');
    // Conditionnel : jamais forcer hors-sujet.
    expect(section.toLowerCase()).toContain('pertinent');
  });

  it('n’inclut que les sections des outils demandés', () => {
    const section = buildOutputToolsSection(['keypoints']);
    expect(section).toContain('POINTS CLÉS');
    expect(section).not.toContain('medinfo-diagram');
    expect(section).not.toContain('TABLEAU COMPARATIF');
  });
});
