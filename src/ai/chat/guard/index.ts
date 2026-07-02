/**
 * Garde d'entrée du chat (couche 1 réintroduite, ADR-0029) — module pur,
 * étage 2 LLM injectable, testé dans tests/unit/chat-guard.test.ts.
 *
 * Politique SANS sur-refus (leçon ADR-0023, validée sur le golden set) :
 *  1. Cas fictif pédagogique explicite (persona étudiante vérifiée) → passe,
 *     évalué AVANT le verrou urgence (une vignette ECOS cite des red flags).
 *  2. Urgence vitale (regex) → refus + redirection 15/112, jamais adouci par le LLM.
 *  3. Situation personnelle (regex, contournements inclus) → l'étage 2 LLM ne
 *     peut que dégrader un faux positif vers « passe » ; erreur/timeout → refus.
 *  4. Tout le reste (general_info, out_of_scope, aucun match/ambigu) → passe,
 *     sans appel LLM (latence ≈ 0 sur le chemin nominal).
 *
 * La garde n'évalue que le DERNIER message utilisateur : l'historique client
 * n'est pas une source de vérité, et chaque tour repasse ici de toute façon.
 */
import { classifyByRegex } from './regexClassifier';
import { isExplicitFictiveEducationalCase } from './fictive';
import type { GuardVerdict, LlmGuardCheck } from './types';

export interface GuardOptions {
  /** Persona étudiante vérifiée : autorise les cas explicitement fictifs/pédagogiques. */
  allowFictiveEducationalCases?: boolean;
  /** Étage 2 LLM (createGuardLlmCheck) — absent en test ou si volontairement coupé. */
  llmCheck?: LlmGuardCheck;
}

export async function runInputGuard(
  lastUserText: string,
  opts: GuardOptions = {},
): Promise<GuardVerdict> {
  if (opts.allowFictiveEducationalCases && isExplicitFictiveEducationalCase(lastUserText)) {
    return { category: 'educational_case', blocked: false, layer: 'regex' };
  }

  const regex = classifyByRegex(lastUserText);
  if (!regex) return { category: 'general_info', blocked: false, layer: 'none' };

  if (regex.category === 'emergency') {
    // Jamais soumis au LLM : une urgence vitale ne se « dégrade » pas.
    return { category: 'emergency', blocked: true, layer: 'regex', marker: regex.matchedMarker };
  }

  if (regex.category === 'personal_symptoms') {
    if (opts.llmCheck) {
      try {
        const check = await opts.llmCheck(lastUserText);
        if (!check.personal) {
          return { category: 'general_info', blocked: false, layer: 'llm' };
        }
        return {
          category: 'personal_symptoms',
          blocked: true,
          layer: 'llm',
          marker: regex.matchedMarker,
          reformulations: check.reformulations,
        };
      } catch {
        // Erreur/timeout étage 2 → verdict regex conservé (fail-closed sur cette branche).
      }
    }
    return {
      category: 'personal_symptoms',
      blocked: true,
      layer: 'regex',
      marker: regex.matchedMarker,
    };
  }

  // general_info / out_of_scope : passent (le prompt v3 gère le hors-sujet poliment).
  return { category: regex.category, blocked: false, layer: 'regex' };
}

/** Texte du dernier message utilisateur (string `content` ou première part texte). */
export function extractLastUserText(uiMessages: unknown[]): string {
  const users = (Array.isArray(uiMessages) ? uiMessages : []).filter(
    (m): m is Record<string, unknown> => !!m && (m as { role?: unknown }).role === 'user',
  );
  const last = users[users.length - 1];
  if (!last) return '';
  if (typeof last.content === 'string') return last.content;
  const parts = Array.isArray(last.parts) ? (last.parts as Array<Record<string, unknown>>) : [];
  const textPart = parts.find((p) => p?.type === 'text');
  return typeof textPart?.text === 'string' ? textPart.text : '';
}
