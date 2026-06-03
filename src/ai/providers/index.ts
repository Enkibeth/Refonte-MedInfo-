/**
 * Sélecteur de provider IA (04_CHATBOT §5 — model_default).
 * Contrôlé par la variable d'environnement AI_PROVIDER=anthropic|openai.
 * Par défaut : anthropic (Claude Sonnet 4.6).
 * Les deux clés API doivent être présentes dans .env pour le provider choisi.
 */
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
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
