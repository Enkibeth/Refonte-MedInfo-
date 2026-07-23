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
