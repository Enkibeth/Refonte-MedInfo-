# ADR-0002 — Stack Expo + Supabase + Vercel AI SDK, abandon WordPress/AI Engine

```yaml
status: Accepted
date: 2026-06-02
```

## Contexte
MedInfo AI v3 tournait sur WordPress + AI Engine Pro. Objectif refondation : UI minimaliste, web + iOS + Android, liberté de dev, dev solo avec Claude Code, budget 500 €, MVP 3 mois. Quasi aucune donnée à migrer.

## Décision
Refonte complète en stack TypeScript unifiée : Expo (une app web+iOS+Android), Supabase (Postgres+Auth+pgvector+Storage), Vercel AI SDK, Stripe web-first. Abandon total de WordPress et AI Engine.

## Conséquences
- (+) Un seul langage → effet de levier max Claude Code. Web + natif d'un seul codebase. Contrôle design total. Features chat (dossiers, export PDF, QCM, toggle sources) plus simples qu'en AI Engine.
- (+) RAG portable : pipeline Python inchangé, destination pgvector au lieu d'AI Engine Embeddings.
- (−) Reconstruction de ce qu'AI Engine fournissait (~10 personne-semaines). Pas de fallback CMS.
- Ferme : option headless WordPress, option wrapper WebView.

## Statut
Accepted.
