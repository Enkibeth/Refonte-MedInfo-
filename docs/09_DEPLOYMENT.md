# Déploiement Vercel + Supabase dédié

```yaml
title: Deployment Runbook
version: 1.0.0
owner: Hugo Bettembourg
status: Active
date: 2026-06-03
```

## Objectif

Permettre au projet Expo Router MedInfo AI de tourner sur Vercel avec :

- le bundle web client servi depuis `dist/client` ;
- les routes API Expo Router, notamment `POST /api/chat`, servies par une Vercel Function ;
- le projet Supabase dédié MedInfo connecté par variables d'environnement ;
- aucune clé secrète committée dans le repo.

## Fichiers de déploiement

| Fichier | Rôle |
|---|---|
| `app.json` | `expo.web.output=server` génère `dist/client` + `dist/server`, requis pour les API routes. |
| `api/index.js` | Entrypoint Vercel qui délègue les requêtes à `expo-server/adapter/vercel`. |
| `vercel.json` | Build `expo export -p web`, publication `dist/client`, inclusion `dist/server/**`, rewrite vers la Function. |
| `.env.example` | Liste des variables à créer dans Vercel et en local. |
| `app/api/health+api.ts` | Smoke-test non secret : `GET /api/health`. |

## Variables Vercel obligatoires

Dans **Vercel → Project → Settings → Environment Variables**, créer au minimum :

| Variable | Environnements | Valeur attendue | Secret ? | Notes |
|---|---:|---|---:|---|
| `AI_PROVIDER` | Production / Preview / Development | `anthropic` ou `openai` | Non | `anthropic` par défaut. |
| `ANTHROPIC_API_KEY` | selon provider | clé Anthropic | Oui | Obligatoire si `AI_PROVIDER=anthropic`. |
| `OPENAI_API_KEY` | selon provider | clé OpenAI | Oui | Obligatoire si `AI_PROVIDER=openai`. Peut coexister avec Anthropic. |
| `AI_MODEL_ID` | optionnel | ex. `gpt-4o` | Non | Vide = modèle par défaut du provider. |
| `EXPO_PUBLIC_SUPABASE_URL` | tous | URL projet Supabase dédié | Non | Injectée dans le bundle client à la build. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | tous | clé `anon` Supabase | Non sensible publiquement | Protégée par RLS, nécessaire à l'auth client. |
| `SUPABASE_URL` | tous | URL projet Supabase dédié | Non | Utilisée côté serveur ; garder identique à `EXPO_PUBLIC_SUPABASE_URL`. |
| `SUPABASE_SERVICE_ROLE_KEY` | tous | clé `service_role` Supabase | Oui | Serveur uniquement : audit `ai_interactions`. |

> Ne jamais mettre `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` dans un fichier committé.

## Étapes Vercel

1. Importer le repo GitHub dans Vercel.
2. Framework preset : **Other** si Vercel ne détecte pas Expo correctement.
3. Build command : laisser le `vercel.json` imposer `expo export -p web`.
4. Output directory : laisser le `vercel.json` imposer `dist/client`.
5. Ajouter les variables ci-dessus dans Vercel.
6. Déployer ou redéployer.
7. Vérifier `https://<ton-domaine>/api/health` :
   - `ok` doit être `true` ;
   - `supabase.configured` doit être `true` ;
   - `supabase.hostname` doit correspondre au projet Supabase dédié ;
   - le provider IA actif doit être celui attendu.
8. Tester le chat via l'UI web, puis contrôler dans Supabase que `ai_interactions` reçoit les logs sans contenu de message.

## Notes Supabase

- Les migrations sous `supabase/migrations/` restent la source versionnée du schéma.
- `profiles` est lu côté client avec la clé `anon` et la RLS.
- `ai_interactions` est écrit côté serveur avec `service_role`; il ne doit pas être accessible au client.
- Si `SUPABASE_URL` est absent côté serveur, le helper serveur accepte `EXPO_PUBLIC_SUPABASE_URL` en fallback, mais Vercel doit idéalement définir les deux pour éviter l'ambiguïté.

## Native mobile

Le chat mobile utilise aussi `/api/chat`. Pour une build native de production, Expo Router doit connaître l'origine serveur déployée. Tant que les builds iOS/Android prod ne sont pas lancés, la configuration Vercel suffit pour le web. Avant build native store, définir l'origine de production selon la stratégie Expo Router retenue (origine manuelle ou déploiement serveur automatisé EAS) et documenter l'URL dans une ADR.
