# MedInfo AI v4 — Refonte

Plateforme d'information médicale générale et éducative (web + iOS + Android). Stack cible : **Expo · Supabase · Vercel AI SDK · Stripe**.

## ⚠️ Point d'entrée obligatoire

1. Lire `START.md`.
2. Lire `.ai-governance.md`.
3. Lire `docs/01_REGULATION.md`.
4. Lire `docs/README.md` pour l'index documentaire complet.

Le projet opère sous doctrine **safe-box non-MDSW** (hors dispositif médical, MDR 2017/745). Toute contribution doit respecter les invariants de `.ai-governance.md` et passer les gates CI décrits dans `docs/03_SECURITY.md`.

## Statut actuel

- App Expo + API Vercel : **présentes**, avec chat streaming côté `POST /api/chat`.
- Safe-box non-MDSW : **active** (classifieur avant LLM, refus canonique, validation de sortie, RAG cite-or-refuse).
- Classifieur : **étage 1 regex prioritaire** + **étage 2 LLM léger conditionnel** (Claude Haiku 4.5, fail-closed).
- RAG : corpus HAS/ANSM MVP, pgvector, retrieval lexical + fusion dense prête ; embeddings réels `text-embedding-3-small` à peupler après configuration OpenAI prod.
- Auth/routing : personas `public` et `student` actifs ; `professional` routable mais features cliniques gelées par ADR-0006.
- RPPS : vérification ANS documentée/configurable ; tant que la clé Annuaire Santé est absente, le statut reste `pending`.
- Facturation : Stripe web-first pour public/étudiant ; paywall limité au volume et aux features avancées, jamais aux sources.
- Quotas : trajectoire documentée vers des quotas **par feature** (`chat`, `ecos`, `transcription`, `export`) côté serveur.
- Cas ECOS : décision actée pour un stockage DB de cas **fictifs et pédagogiques** uniquement.
- Données santé identifiables : **interdites au MVP** ; pas d'historique patient ni dossier sans ADR dédiée + HDS.

## Installation

```bash
cp .env.example .env
npm install
npm run dev
```

## Déploiement Vercel

Le repo contient la configuration Vercel pour Expo Router en sortie serveur :

```bash
npm run build:web
```

Configurer ensuite les variables Vercel/Supabase décrites dans `docs/09_DEPLOYMENT.md`, puis vérifier `GET /api/health` après déploiement.

## Commandes de validation

```bash
npm run typecheck
npm run test
npm run compliance
```

## Organisation

```txt
app/                     Routes Expo Router
src/ai/                  Prompts, guardrails, routing, skills, orchestrator
src/compliance/          Disclosures, refus canonique, règles transversales
src/db/                  Client Supabase et futurs helpers DB
src/rag/                 Pipeline RAG futur
src/ui/                  Tokens et composants UI partagés
supabase/                Migrations, policies, seeds
scripts/                 Ingestion, embeddings, évaluation, compliance
tests/                   Unit, RLS, prompt regression, prompt eval
docs/                    Documentation fondatrice, STATUS et ADRs
CLAUDE.md                Mémo de reprise agents : features IA + migrations
.github/workflows/       Gates CI
```

## Règle de développement

Ne pas ajouter de logique médicale, de triage, de diagnostic, de conduite à tenir individualisée ou de données santé persistées hors HDS. En cas de doute : ouvrir une ADR avant d'implémenter.
