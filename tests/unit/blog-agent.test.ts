/**
 * Tests des parseurs de l'agent éditorial hebdomadaire du blog
 * (src/blog/articleJson.ts) : article du rédacteur, sujet de la semaine,
 * verdict du relecteur, rapport du vérificateur de faits, insertion
 * d'illustration dans le corps.
 */
import { describe, expect, it } from 'vitest';
import {
  insertBodyImage,
  parseArticleJson,
  parseFactCheckJson,
  parseReviewJson,
  parseTopicJson,
  slugify,
} from '@/blog/articleJson';

describe('slugify', () => {
  it('normalise accents, espaces et ponctuation', () => {
    expect(slugify('Vaccins : idées reçues & réalités !')).toBe('vaccins-idees-recues-realites');
  });

  it('tronque à 60 caractères', () => {
    expect(slugify('a'.repeat(100)).length).toBeLessThanOrEqual(60);
  });
});

describe('parseArticleJson', () => {
  it('extrait un article complet (balises de code tolérées)', () => {
    const raw = '```json\n{"title":"Titre","summary":"Chapeau","category":"Prévention","content_md":"## Section","image_prompt":"flat illustration"}\n```';
    expect(parseArticleJson(raw)).toEqual({
      title: 'Titre',
      summary: 'Chapeau',
      category: 'Prévention',
      content_md: '## Section',
      image_prompt: 'flat illustration',
    });
  });

  it('retourne null sans title ou content_md', () => {
    expect(parseArticleJson('{"summary":"x"}')).toBeNull();
    expect(parseArticleJson('pas du JSON')).toBeNull();
  });

  it('extrait body_image_prompt quand il est fourni, sinon undefined', () => {
    const withPrompt = parseArticleJson(
      '{"title":"T","content_md":"## S","body_image_prompt":" flat body illustration "}',
    );
    expect(withPrompt?.body_image_prompt).toBe('flat body illustration');
    const without = parseArticleJson('{"title":"T","content_md":"## S","body_image_prompt":"  "}');
    expect(without?.body_image_prompt).toBeUndefined();
  });
});

describe('parseFactCheckJson', () => {
  it('extrait un rapport ok', () => {
    expect(parseFactCheckJson('{"status":"ok","issues":[],"notes":"Vérifié via HAS"}')).toEqual({
      status: 'ok',
      issues: [],
      notes: 'Vérifié via HAS',
    });
  });

  it('extrait les anomalies en filtrant les entrées invalides', () => {
    const report = parseFactCheckJson(
      '```json\n{"status":"issues","issues":[" Chiffre faux ", 42, ""],"notes":"n"}\n```',
    );
    expect(report).toEqual({ status: 'issues', issues: ['Chiffre faux'], notes: 'n' });
  });

  it('retourne null si le status est invalide ou absent', () => {
    expect(parseFactCheckJson('{"status":"maybe"}')).toBeNull();
    expect(parseFactCheckJson('{"issues":[]}')).toBeNull();
    expect(parseFactCheckJson('pas du JSON')).toBeNull();
  });
});

describe('insertBodyImage', () => {
  const article = '## Intro\ntexte\n\n## Deuxième\nsuite\n\n## Ce qu\'il faut retenir\n- a';

  it("insère l'image avant le deuxième titre « ## »", () => {
    const out = insertBodyImage(article, 'https://x.test/i.png', 'Illustration');
    expect(out).toBe(
      '## Intro\ntexte\n\n![Illustration](https://x.test/i.png)\n\n## Deuxième\nsuite\n\n## Ce qu\'il faut retenir\n- a',
    );
  });

  it("laisse l'article inchangé sans deuxième section ou sans URL", () => {
    expect(insertBodyImage('## Seule section\ntexte', 'https://x.test/i.png', 'A')).toBe(
      '## Seule section\ntexte',
    );
    expect(insertBodyImage(article, '', 'A')).toBe(article);
  });
});

describe('parseTopicJson', () => {
  it('extrait le sujet proposé', () => {
    const raw = 'Voici ma proposition :\n{"topic":"La vitamine D en hiver","angle":"Décrypter les idées reçues","category":"Prévention","rationale":"Saison"}';
    expect(parseTopicJson(raw)).toEqual({
      topic: 'La vitamine D en hiver',
      angle: 'Décrypter les idées reçues',
      category: 'Prévention',
      rationale: 'Saison',
    });
  });

  it('retourne null si topic absent ou vide', () => {
    expect(parseTopicJson('{"angle":"x"}')).toBeNull();
    expect(parseTopicJson('{"topic":"  "}')).toBeNull();
  });
});

describe('parseReviewJson', () => {
  it('extrait un verdict publish sans corrections', () => {
    const review = parseReviewJson('{"verdict":"publish","notes":"RAS"}');
    expect(review).toEqual({
      verdict: 'publish',
      title: undefined,
      summary: undefined,
      category: undefined,
      content_md: undefined,
      notes: 'RAS',
    });
  });

  it('extrait un verdict revise avec article corrigé', () => {
    const review = parseReviewJson(
      '{"verdict":"revise","content_md":"## Corrigé","notes":"Chiffre corrigé"}',
    );
    expect(review?.verdict).toBe('revise');
    expect(review?.content_md).toBe('## Corrigé');
  });

  it('retourne null si le verdict est invalide ou absent', () => {
    expect(parseReviewJson('{"verdict":"maybe"}')).toBeNull();
    expect(parseReviewJson('{"notes":"x"}')).toBeNull();
  });
});
