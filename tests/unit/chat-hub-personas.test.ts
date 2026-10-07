/**
 * Matrice par état de compte (ADR-0044) : visiteur, grand public, étudiant, professionnel,
 * admin. Ce que chacun peut ouvrir depuis le chat (cartes, commandes « / »), ce que le modèle
 * reçoit comme consigne, et le registre des textes affichés. Une seule règle de visibilité
 * (`isFeatureVisible`) : la navigation, les cartes et les commandes ne divergent jamais.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', async () => await import('react-native-web'));

import {
  MODULE_ACTION_TOOLS,
  buildModuleActionsSection,
  moduleActionCard,
  moduleActionToolsFor,
  type ModuleActionAudience,
} from '@/ai/chat/moduleActions';
import { slashCommandsFor, slashExamples } from '@/ai/chat/slashCommands';
import { visibleFeatures } from '@/ai/routing/featureVisibility';
import { gradeCardMessage } from '@/ui/chat/GradeFileCard';

const ACCOUNTS: Record<string, { audience: ModuleActionAudience; tools: string[] }> = {
  visiteur: { audience: { persona: null, isGuest: true }, tools: [] },
  'grand public': { audience: { persona: 'public' }, tools: ['document'] },
  étudiant: {
    audience: { persona: 'student' },
    tools: ['partiel', 'ecos', 'scores', 'revision', 'presentation', 'article', 'cv-builder'],
  },
  professionnel: {
    audience: { persona: 'professional' },
    tools: ['scores', 'presentation', 'article', 'cv-builder', 'audio'],
  },
  admin: { audience: { persona: 'public', isAdmin: true }, tools: [...MODULE_ACTION_TOOLS] },
};

describe.each(Object.entries(ACCOUNTS))('compte %s', (_name, { audience, tools }) => {
  const allowed = moduleActionToolsFor(audience);

  it('outils ouvrables depuis le chat = outils de sa navigation', () => {
    expect([...allowed].sort()).toEqual([...tools].sort());
    if (!audience.isGuest) {
      const nav = visibleFeatures(audience.persona, { isAdmin: audience.isAdmin })
        .map((f) => f.id)
        .filter((id) => id !== 'chat');
      expect([...allowed].sort()).toEqual([...nav].sort());
    }
  });

  it('commandes « / » : exactement les mêmes outils', () => {
    expect(slashCommandsFor(allowed).map((c) => c.tool).sort()).toEqual([...tools].sort());
    expect(slashExamples(allowed).length).toBe(Math.min(2, tools.length));
  });

  it('consigne du modèle : ses outils seulement, rien pour un visiteur', () => {
    const section = buildModuleActionsSection(allowed);
    if (tools.length === 0) {
      expect(section).toBe('');
      return;
    }
    for (const tool of MODULE_ACTION_TOOLS) {
      expect(section.includes(`- ${tool} :`), tool).toBe(tools.includes(tool));
    }
  });
});

describe('registre des textes', () => {
  it('cartes neutres : ni tutoiement ni vouvoiement (même carte dans les 3 chats)', () => {
    for (const tool of MODULE_ACTION_TOOLS) {
      for (const param of [null, 'X']) {
        const card = moduleActionCard({ tool, param });
        const text = `${card.title} ${card.description}`;
        expect(text, tool).not.toMatch(/\b(tu|ton|ta|tes|toi|vous|votre|vos)\b/i);
      }
    }
  });

  it('relevé de notes : tutoiement quand Partiels est ouvert (étudiant), vouvoiement sinon (pro)', () => {
    expect(gradeCardMessage('grade-table', 'a.csv', 20, true)).toMatch(/ton appareil/);
    const pro = gradeCardMessage('grade-table', 'a.csv', 20, false);
    expect(pro).toMatch(/Collez/);
    expect(pro).not.toMatch(/\b(tu|ton|ta|tes)\b/);
  });
});
