/**
 * Version de l'app servie (2026-10, ADR-0044) — empreinte du bundle d'entrée de l'export web.
 *
 * Un onglet ouvert AVANT un déploiement garde l'ancien code client pendant que le serveur
 * est déjà à jour : c'est ainsi que des marqueurs `<!--OUTIL:…-->` se sont affichés en clair
 * sur un iPhone. Le serveur annonce donc, sur ses réponses d'API, l'empreinte du bundle qu'il
 * sert (`X-MedInfo-Build`) ; le client la compare à celle du bundle qu'il exécute et propose
 * de recharger (src/chat/appVersion.ts). L'empreinte ne change que si le code client change.
 */
import fs from 'node:fs';
import path from 'node:path';

/** En-tête HTTP qui porte la version servie. */
export const BUILD_HEADER = 'X-MedInfo-Build';

const ENTRY_RE = /^entry-([0-9a-f]{8,64})\.js$/;

/** Empreinte du bundle d'entrée parmi des noms de fichiers, ou null (export absent, dev). */
export function entryBundleHash(fileNames) {
  const hashes = (fileNames ?? [])
    .map((name) => ENTRY_RE.exec(name)?.[1])
    .filter(Boolean)
    .sort();
  // Un seul bundle d'entrée par export ; s'il y en avait plusieurs (copie partielle), on ne
  // peut pas savoir lequel est servi : pas de version plutôt qu'une version fausse.
  return hashes.length === 1 ? hashes[0] : null;
}

/** Lit l'empreinte dans `dist/client/_expo/static/js/web`, ou null. */
export function readBuildId(clientDir) {
  try {
    return entryBundleHash(fs.readdirSync(path.join(clientDir, '_expo', 'static', 'js', 'web')));
  } catch {
    return null;
  }
}
