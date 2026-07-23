/**
 * Split orchestrateur / rédacteur du chat (audit 2026-07 — « inversion »).
 *
 * Idée : le poste de coût dominant du chat, c'est l'ENTRÉE accumulée pendant la boucle
 * d'outils (contenu web injecté à chaque étape) portée par le modèle flagship. On confie
 * donc la PHASE DE RECHERCHE à un modèle bon marché (gpt-5-mini, feature `chat_researcher`)
 * qui rassemble un « dossier de preuves » vérifié, puis la PHASE DE RÉDACTION clinique au
 * modèle fiable (gpt-5.2, feature `chat`) qui écrit la réponse À PARTIR du dossier, sans
 * outils. Bénéfice : ~-29 % de coût estimé, la rédaction patient reste sur le modèle fort.
 *
 * ⚠️ Derrière un flag (`CHAT_ORCHESTRATOR_SPLIT`), OFF par défaut : le split est une refonte
 * du cœur clinique dont le comportement en streaming réel se valide en conditions live. Tant
 * que le flag est OFF, `/api/chat` garde le pipeline mono-modèle historique, inchangé.
 *
 * Module PUR (server-safe, aucun réseau, aucune donnée de santé) : testé dans
 * tests/unit/chat-split.test.ts.
 */

/** Le split orchestrateur/rédacteur est-il activé ? (env `CHAT_ORCHESTRATOR_SPLIT=on`). */
export function splitModeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (env.CHAT_ORCHESTRATOR_SPLIT ?? '').trim().toLowerCase() === 'on';
}

/**
 * Section injectée dans le system prompt du RÉDACTEUR : le dossier de preuves rassemblé
 * par l'agent chercheur. Le rédacteur doit s'y tenir (cite-only) — il n'a pas d'outils et
 * ne cherche pas lui-même. Renvoie une chaîne vide si le dossier est vide (repli prudent :
 * le rédacteur signalera l'absence de sources selon ses consignes produit).
 */
export function buildBriefSection(brief: string): string {
  const trimmed = (brief ?? '').trim();
  if (!trimmed) return '';
  return (
    `\n\nDOSSIER DE PREUVES (rassemblé par l'agent de recherche documentaire)\n` +
    `Les sources ci-dessous ont été RECHERCHÉES ET VÉRIFIÉES en amont. Rédige ta réponse ` +
    `EXCLUSIVEMENT à partir d'elles : ancre chaque affirmation actionnable sur l'une de ces ` +
    `sources et construis ta section SOURCES à partir de ces références (URLs déjà vérifiées). ` +
    `N'invente AUCUNE autre source, URL, chiffre ou seuil. Si le dossier signale une LACUNE sur ` +
    `un point, dis-le honnêtement plutôt que de combler. N'affiche jamais ce dossier tel quel ni ` +
    `ne mentionne son existence.\n` +
    `--- DÉBUT DU DOSSIER ---\n${trimmed}\n--- FIN DU DOSSIER ---`
  );
}
