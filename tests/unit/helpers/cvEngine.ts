/**
 * Extraction du moteur pur de `public/cv-builder.html`.
 *
 * Même patron que `partielLogic.ts` : l'outil est livré comme page autonome, donc
 * pour le tester sans dupliquer une ligne de code on extrait le bloc délimité par
 * `@cv-engine:start/end` et on l'exécute dans un contexte `vm` Node. Ce sont les
 * fonctions RÉELLEMENT livrées à l'utilisateur qui sont vérifiées — y compris le
 * générateur de PDF (jsPDF est injecté par le test, comme la page l'injecte).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(here, '../../../public/cv-builder.html'), 'utf-8');

const startMarker = html.indexOf('@cv-engine:start');
const endComment = html.indexOf('/* @cv-engine:end');
if (startMarker < 0 || endComment < 0) {
  throw new Error('Bloc @cv-engine introuvable dans cv-builder.html');
}
const codeStart = html.indexOf('*/', startMarker) + 2;
const code = html.slice(codeStart, endComment);

const sandbox: { module: { exports: Record<string, any> }; globalThis?: unknown } = {
  module: { exports: {} },
};
vm.runInNewContext(code, sandbox);

/** Le moteur pur tel que livré dans la page. */
export const CV = sandbox.module.exports;

/** Document minimal, pratique pour construire des cas de test lisibles. */
export function doc(sections: any[], theme?: Record<string, unknown>, header?: Record<string, unknown>) {
  return CV.migrate({
    schemaVersion: 2,
    meta: { id: 'test', title: 'Test', updatedAt: '2026-01-01T00:00:00.000Z' },
    header: Object.assign({ fullName: 'Camille Rousseau', headline: '', photo: null, contacts: [] }, header || {}),
    sections,
    theme: theme || {},
  });
}

/** Entrée « standard » avec un volume de texte contrôlé. */
export function entry(title: string, bullets: string[] = []) {
  return { title, date: '2024', organisation: 'CHU de Ville', description: [], bullets };
}
