/**
 * Sélecteur de provider IA (04_CHATBOT §5 — model_default).
 * Contrôlé par la variable d'environnement AI_PROVIDER=anthropic|openai.
 * Par défaut : anthropic (Claude Sonnet 4.6).
 * Les deux clés API doivent être présentes dans .env pour le provider choisi.
 */
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

export type AIProvider = 'anthropic' | 'openai';

const PROVIDER_MODELS: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
};

export function getActiveProvider(): AIProvider {
  const raw = process.env.AI_PROVIDER?.toLowerCase();
  if (raw === 'openai') return 'openai';
  return 'anthropic';
}

export function getActiveModel(): LanguageModel {
  const provider = getActiveProvider();
  const modelId = process.env.AI_MODEL_ID ?? PROVIDER_MODELS[provider];

  if (provider === 'openai') {
    return openai(modelId);
  }
  return anthropic(modelId);
}

export function getActiveModelId(): string {
  const provider = getActiveProvider();
  return process.env.AI_MODEL_ID ?? PROVIDER_MODELS[provider];
}

/**
 * Libellé humain du système d'IA actif, pour la disclosure AI Act (art. 50, 01_REGULATION §6).
 * Réservé au contexte SERVEUR (lit AI_PROVIDER côté serveur) ; l'UI statique utilise la
 * forme par défaut de getAiDisclosure() qui nomme les deux providers possibles.
 */
const PROVIDER_VENDORS: Record<AIProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
};

export function getActiveSystemLabel(): string {
  const provider = getActiveProvider();
  return `${getActiveModelId()}, ${PROVIDER_VENDORS[provider]}`;
}

/**
 * Modèle de l'étage 2 du classifieur (07_CLASSIFIER §3 — couche 1, deuxième lecture).
 *
 * Indépendant du provider du LLM PRINCIPAL : la classification de sécurité est un poste
 * à part (modèle léger, rapide, peu coûteux). Production = Gemini 2.5 Flash-Lite.
 * Surchargable via CLASSIFIER_MODEL_ID. Réservé au contexte SERVEUR.
 */
export const CLASSIFIER_MODEL_DEFAULT = 'gemini-2.5-flash-lite';

export function getClassifierModelId(): string {
  return process.env.CLASSIFIER_MODEL_ID ?? CLASSIFIER_MODEL_DEFAULT;
}

export function getClassifierModel(): LanguageModel {
  return google(getClassifierModelId());
}
