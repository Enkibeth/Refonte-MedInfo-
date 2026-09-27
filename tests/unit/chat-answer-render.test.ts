/**
 * Rendu RÉEL du composant de réponse (AssistantBlocks → MarkdownRenderer), servi par
 * react-native-web côté serveur : aucune dépendance de test ajoutée, aucun navigateur.
 *
 * Vérifie ce que les tests purs ne voient pas : la numérotation des liens est portée par
 * un registre PARTAGÉ entre tous les blocs du message (avant, chaque bloc de streaming et
 * chaque section relue recommençait à 1), et aucune syntaxe technique ne s'affiche en
 * clair à aucun moment du flux.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', async () => await import('react-native-web'));

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AssistantBlocks } from '@/ui/chat/AssistantBlocks';
import { CHAT_ANSWER_FIXTURES } from './helpers/chatAnswerFixtures';

function render(text: string, streaming: boolean): string {
  return renderToStaticMarkup(
    createElement(AssistantBlocks, {
      text,
      streaming,
      disabled: false,
      onSend: () => {},
      onOpenSource: () => {},
    }),
  );
}

/** Numéros des appels de note de liens, dans l'ordre du document. */
function linkNumbers(html: string): number[] {
  return [...html.matchAll(/aria-label="Source (\d+)"/g)].map((m) => Number(m[1]));
}

/** Texte visible (les attributs d'accessibilité ne comptent pas). */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const LINKS = [
  'RÉPONSE',
  '',
  'Premier paragraphe ([a](https://a.example/1)).',
  '',
  'Deuxième paragraphe ([b](https://b.example/2)).',
  '',
  'À RETENIR',
  '',
  '- Troisième lien ([c](https://c.example/3))',
  '- Premier lien répété ([a](https://a.example/1))',
].join('\n');

describe('numérotation des liens sur tout le message', () => {
  it('relecture : la numérotation continue d’une section à l’autre, un lien répété garde son numéro', () => {
    expect(linkNumbers(render(LINKS, false))).toEqual([1, 2, 3, 1]);
  });

  it('streaming : chaque bloc clos continue la numérotation au lieu de repartir à 1', () => {
    const partial = LINKS.slice(0, LINKS.indexOf('- Premier lien répété'));
    expect(linkNumbers(render(partial, true))).toEqual([1, 2, 3]);
  });
});

describe('aucune syntaxe technique affichée pendant le flux', () => {
  const FORBIDDEN = [/SRC\d/, /\[1\]\s*\+/, /<!--/, /\]\(https?:/, /\*\*/, /#{2,}\s/, /\|-{3}/, /```/];

  for (const [name, text] of Object.entries(CHAT_ANSWER_FIXTURES)) {
    it(name, () => {
      for (let n = 1; n <= text.length; n += 3) {
        const shown = visibleText(render(text.slice(0, n), true));
        for (const pattern of FORBIDDEN) {
          if (pattern.test(shown)) {
            throw new Error(`${pattern} affiché à ${n}/${text.length} : …${shown.slice(-160)}`);
          }
        }
      }
      const final = visibleText(render(text, false));
      for (const pattern of FORBIDDEN.filter((p) => p.source !== 'SRC\\d')) expect(final).not.toMatch(pattern);
    });
  }

  it('relances étudiantes : propositions à cocher une seule fois, jamais le marqueur', () => {
    const html = render(CHAT_ANSWER_FIXTURES.STUDENT_REAL_FORMAT, false);
    const shown = visibleText(html);
    expect(shown.match(/Première question de relance/g)).toHaveLength(1);
    expect((html.match(/role="checkbox"/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(shown).not.toMatch(/\[1\]\s*\+/);
  });
});
