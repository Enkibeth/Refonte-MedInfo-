/**
 * Rendu RÉEL (react-native-web côté serveur) des cartes d'outil du chat et de la carte
 * « relevé de notes » du composeur (ADR-0044) : ce que les tests purs ne voient pas — la
 * carte n'apparaît que pour un outil ouvert au rôle, et aucun marqueur ne s'affiche jamais,
 * ni pendant le flux ni après.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', async () => await import('react-native-web'));

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ModuleActionTool } from '@/ai/chat/moduleActions';
import { AssistantBlocks, type ModuleActionsHandlers } from '@/ui/chat/AssistantBlocks';
import { GradeFileCard, gradeCardMessage, type GradeCardKind } from '@/ui/chat/GradeFileCard';

function handlers(allowed: ModuleActionTool[]): ModuleActionsHandlers {
  return { canOpen: (tool) => allowed.includes(tool), onOpen: () => {} };
}

function render(text: string, streaming: boolean, moduleActions?: ModuleActionsHandlers): string {
  return renderToStaticMarkup(
    createElement(AssistantBlocks, {
      text,
      streaming,
      disabled: false,
      onSend: () => {},
      onOpenSource: () => {},
      moduleActions,
    }),
  );
}

function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const ANSWER = [
  'Pour t’entraîner à l’examen clinique, rien ne vaut une station complète.',
  '',
  '<!--OUTIL:ecos|Cardiologie-->',
  '<!--OUTIL:audio-->',
  '',
  'SOURCES',
  'SRC1 :: [OFFICIEL] HAS :: HAS :: Titre :: 2024',
  'https://www.has-sante.fr/x',
].join('\n');

describe('cartes d’outil : rendu', () => {
  it('une carte par outil OUVERT au rôle, jamais pour un outil hors périmètre', () => {
    const html = render(ANSWER, false, handlers(['ecos']));
    const text = visibleText(html);
    expect(text).toContain('Station ECOS : Cardiologie');
    expect(text).toContain('Ouvrir');
    expect(text).not.toContain('Compte rendu de consultation');
    expect(html.match(/data-testid="module-action-card"/g)).toHaveLength(1);
  });

  it('sans gestionnaire (autre contexte que le chat) : aucune carte', () => {
    expect(render(ANSWER, false)).not.toContain('module-action-card');
  });

  it('aucun marqueur visible, à aucun moment du flux', () => {
    for (let n = 1; n <= ANSWER.length; n++) {
      const text = visibleText(render(ANSWER.slice(0, n), n < ANSWER.length, handlers(['ecos', 'audio'])));
      expect(text, `préfixe ${n}`).not.toMatch(/OUTIL|<!--|-->/);
    }
  });

  it('marqueur glissé en milieu de phrase, pendant le flux puis à la fin : jamais affiché, carte à la fin', () => {
    const inline = 'Ouvre l’outil dédié <!--OUTIL:partiel--> pour connaître ton rang.\n\nBon courage.';
    let last = '';
    for (let n = 1; n <= inline.length; n++) {
      last = render(inline.slice(0, n), n < inline.length, handlers(['partiel']));
      expect(visibleText(last), `préfixe ${n}`).not.toMatch(/OUTIL|<!--|-->/);
    }
    expect(visibleText(last)).toContain('Analyser mes partiels');
    expect(visibleText(last)).toContain('pour connaître ton rang');
  });

  it('marqueur glissé en milieu de phrase : retiré du texte, rendu en carte', () => {
    const text = visibleText(render('Ouvre l’outil <!--OUTIL:partiel--> pour ton rang.', false, handlers(['partiel'])));
    expect(text).toContain('Analyser mes partiels');
    expect(text).not.toContain('<!--');
  });
});

describe('puces CALC : lien vers le calculateur déterministe', () => {
  const calc = 'Évaluer le risque thromboembolique.\n\n<!--CALC:chads,grace-->\n';

  it('lien pour un score du catalogue, si l’outil Scores est ouvert au rôle', () => {
    const html = render(calc, false, handlers(['scores']));
    expect(html).toContain('dans l&#x27;outil Scores');
    expect(visibleText(html)).toContain('Calcul déterministe, sans IA');
    // GRACE n'est pas dans le catalogue : pas de lien pour lui.
    expect(html).not.toMatch(/Ouvrir GRACE dans/);
  });

  it('aucun lien sans accès à l’outil', () => {
    expect(visibleText(render(calc, false, handlers([])))).not.toContain('Calcul déterministe');
  });
});

describe('carte « relevé de notes » du composeur', () => {
  const kinds: GradeCardKind[] = ['grade-table', 'spreadsheet', 'grade-pdf-name', 'pasted'];

  it('explique sans tiret cadratin, pour chaque cas', () => {
    for (const kind of kinds) {
      for (const can of [true, false]) {
        const message = gradeCardMessage(kind, 'promo.csv', 40, can);
        expect(message).not.toContain('—');
        expect(message.length).toBeGreaterThan(40);
      }
    }
    expect(gradeCardMessage('grade-table', 'promo.csv', 40, true)).toContain('n’est pas envoyé à l’IA');
  });

  it('bouton Partiels seulement si l’outil est ouvert ; « Joindre quand même » pour le PDF suspect', () => {
    const base = { name: 'Resultats_S5.pdf', rows: null, onOpenPartiel: () => {}, onDismiss: () => {} };
    const withTool = visibleText(
      renderToStaticMarkup(createElement(GradeFileCard, { ...base, kind: 'grade-pdf-name', canUsePartiel: true, onAttachAnyway: () => {} })),
    );
    expect(withTool).toContain('Analyser dans Partiels');
    expect(withTool).toContain('Joindre quand même');
    const without = visibleText(
      renderToStaticMarkup(createElement(GradeFileCard, { ...base, kind: 'grade-table', canUsePartiel: false })),
    );
    expect(without).not.toContain('Analyser dans Partiels');
    expect(without).toContain('Collez seulement les informations utiles');
  });
});
