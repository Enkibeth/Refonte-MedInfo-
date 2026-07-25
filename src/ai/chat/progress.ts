/**
 * Progression du workflow agentique du chat — latence PERÇUE (audit 2026-07, item H).
 *
 * La boucle evidence-first (recherche → lecture des résumés → vérification des liens →
 * rédaction) peut prendre plusieurs dizaines de secondes AVANT que le premier mot de la
 * réponse n'arrive. Le client n'affichait qu'UNE ligne (le dernier outil en cours), ce qui
 * ressemble à un spinner figé. Ce module dérive, à partir des `parts` du message assistant
 * en cours, une TRACE ORDONNÉE des étapes déjà franchies (avec compteur) — l'utilisateur
 * voit la recherche avancer (« Littérature ✓ · Lecture des études (2) ✓ · Vérification… »).
 *
 * Module PUR (aucune dépendance UI/réseau), défensif sur la forme des parts (elle varie
 * selon la version de l'AI SDK, comme stepMetrics) : testé dans tests/unit/chat-progress.test.ts.
 */

/** Libellés courts (sans « … ») par nom d'outil du workflow. Partagé avec la bulle client. */
export const CHAT_PROGRESS_LABELS: Record<string, string> = {
  europe_pmc_search: 'Recherche dans la littérature',
  europe_pmc_article: 'Lecture des études',
  clinical_trials_search: 'Recherche d’essais cliniques',
  verify_source_links: 'Vérification des liens',
  pubmed_search: 'Recherche PubMed',
  web_search: 'Recherche web',
  google_search: 'Recherche web',
};

/**
 * Attente longue : au-delà de ce seuil, on rappelle à l'utilisateur qu'il peut quitter
 * l'app — la génération va au bout côté serveur et la réponse l'attend dans l'historique
 * (`keepAlive` côté route + reprise côté client). Sans ce message, une attente de 60 s+
 * ressemble à un plantage et l'utilisateur relance inutilement une génération.
 */
export const LONG_WAIT_MS = 25_000;

/** Compteur de secondes écoulées, borné et stable (jamais de décimale à l'écran). */
export function elapsedLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) return '';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const min = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${min} min` : `${min} min ${rest} s`;
}

export interface ChatProgressStep {
  /** Nom d'outil normalisé (clé de CHAT_PROGRESS_LABELS). */
  tool: string;
  /** Libellé lisible (repli sur le nom brut si outil inconnu). */
  label: string;
  /** Nombre d'appels de cet outil dans le message (lectures multiples, recherches multiples). */
  count: number;
}

interface PartLike {
  type?: unknown;
  toolName?: unknown;
}

/** Nom d'outil d'une part de message (`tool-<name>` ou `dynamic-tool` + `toolName`), sinon null. */
export function toolNameOfPart(part: PartLike): string | null {
  const type = typeof part.type === 'string' ? part.type : '';
  if (type === 'dynamic-tool') {
    return typeof part.toolName === 'string' && part.toolName ? part.toolName : null;
  }
  if (type.startsWith('tool-')) {
    const name = type.slice(5);
    return name || null;
  }
  return null;
}

/**
 * Message assistant RÉELLEMENT en cours de génération : le dernier message du fil, et
 * seulement s'il est de l'assistant.
 *
 * Sans ce filtre, la bulle de statut du tour N affiche la trace du tour N−1 (retour Hugo
 * 2026-07) : entre l'envoi d'une question et l'arrivée du premier fragment de réponse, le
 * dernier message assistant du fil est encore le PRÉCÉDENT, avec ses compteurs d'outils —
 * l'utilisateur voyait « Vérification des liens (2) » de la réponse d'avant, puis tout
 * basculait d'un coup sur la réponse en cours. Tant que la nouvelle réponse n'a pas
 * commencé, il n'y a AUCUNE étape à montrer.
 */
export function inFlightAssistant<T extends { role?: unknown }>(
  messages: readonly T[] | null | undefined,
): T | null {
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const last = messages[messages.length - 1];
  return last && last.role === 'assistant' ? last : null;
}

/**
 * Trace ordonnée des outils appelés, dans l'ordre de PREMIÈRE apparition, avec le nombre
 * d'appels par outil. Le client marque toutes les étapes comme faites (✓) sauf la dernière,
 * rendue « active » tant que la réponse n'a pas commencé à s'écrire.
 */
export function summarizeChatProgress(parts: unknown): ChatProgressStep[] {
  if (!Array.isArray(parts)) return [];
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const part of parts) {
    if (part == null || typeof part !== 'object') continue;
    const name = toolNameOfPart(part as PartLike);
    if (!name) continue;
    if (!counts.has(name)) order.push(name);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return order.map((tool) => ({
    tool,
    label: CHAT_PROGRESS_LABELS[tool] ?? tool,
    count: counts.get(tool) ?? 1,
  }));
}
