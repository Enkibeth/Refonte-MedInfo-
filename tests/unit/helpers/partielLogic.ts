/**
 * Extraction du moteur pur de `public/partiel.html`.
 *
 * L'outil est livré comme page autonome (traitement 100 % client) : pour le tester
 * sans dupliquer le code, on extrait le bloc délimité par `@partiel-logic:start/end`
 * et on l'exécute dans un contexte `vm` Node — ce sont donc les fonctions
 * RÉELLEMENT livrées à l'étudiant qui sont vérifiées.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(here, '../../../public/partiel.html'), 'utf-8');

const startMarker = html.indexOf('@partiel-logic:start');
const endComment = html.indexOf('/* @partiel-logic:end');
if (startMarker < 0 || endComment < 0) {
  throw new Error('Bloc @partiel-logic introuvable dans partiel.html');
}
// Le bloc s'ouvre par `/* @partiel-logic:start ... */` : on prend le code APRÈS la
// fermeture de ce commentaire et AVANT le commentaire de fin.
const codeStart = html.indexOf('*/', startMarker) + 2;
const code = html.slice(codeStart, endComment);

// `TextDecoder` est un global du navigateur (et de Node) : le contexte `vm` est
// vierge, on l'y expose pour que `decodeText` s'exécute comme en production.
const sandbox: { module: { exports: Record<string, any> }; TextDecoder: typeof TextDecoder } = {
  module: { exports: {} },
  TextDecoder,
};
vm.runInNewContext(code, sandbox);

/** Le moteur pur tel que livré dans la page. */
export const L = sandbox.module.exports;
