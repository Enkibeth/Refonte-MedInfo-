/**
 * Écriture du site (2026-10, demande Hugo : « éviter les — qui font très IA ») : aucun tiret
 * cadratin employé comme incise ou liaison dans un texte AFFICHÉ (littéraux de chaîne et texte
 * JSX ; les commentaires et les prompts envoyés aux modèles ne sont pas concernés). Un « — »
 * isolé reste permis comme valeur vide dans un tableau.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOTS = ['app', 'src/ui', 'src/seo', 'src/scores', 'src/dashboard', 'src/ai/routing', 'src/billing', 'src/compliance/legal.ts', 'src/deploy', 'src/chat', 'src/audio', 'src/document'];

function files(path: string): string[] {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).flatMap((name) => files(join(path, name)));
}

function visibleDashes(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  if (!source.includes('—')) return [];
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const hits: string[] = [];
  const visit = (node: ts.Node) => {
    let text: string | null = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) text = node.text;
    else if (ts.isJsxText(node)) text = node.text;
    if (text && text.includes('—') && text.trim() !== '—') {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      hits.push(`${file}:${line + 1} « ${text.trim().slice(0, 80)} »`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

describe('écriture du site sans tics d’écriture générée', () => {
  it('aucun tiret cadratin dans les textes affichés de l’application', () => {
    // Les routes API (app/api) ne rendent pas d'interface : leurs consignes vont aux modèles.
    const all = ROOTS.flatMap(files).filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith(join('app', 'api')));
    expect(all.length).toBeGreaterThan(100);
    expect(all.flatMap(visibleDashes)).toEqual([]);
  });

  it('titres de page : séparateur de marque neutre, jamais « — MedInfo AI »', () => {
    const meta = readFileSync('src/seo/meta.ts', 'utf8');
    expect(meta).toContain('`${t} | ${SITE_NAME}`');
    for (const file of ['public/article.html', 'public/cv-builder.html', 'public/partiel.html', 'public/presentation.html']) {
      expect(readFileSync(file, 'utf8'), file).toMatch(/<title>[^<—]+\| MedInfo AI<\/title>/);
    }
  });
});
