# MedInfo AI v4 — Refonte

Plateforme d'information médicale générale et éducative (web + iOS + Android). Stack cible : **Expo · Supabase · Vercel AI SDK · Stripe**.

## ⚠️ Point d'entrée obligatoire

1. Lire `START.md`.
2. Lire `.ai-governance.md`.
3. Lire `docs/01_REGULATION.md`.
4. Lire `docs/README.md` pour l'index documentaire complet.

Le projet opère sous doctrine **safe-box non-MDSW** (hors dispositif médical, MDR 2017/745). Toute contribution doit respecter les invariants de `.ai-governance.md` et passer les gates CI décrits dans `docs/03_SECURITY.md`.

## Statut actuel

- Étape 1 scaffold : **livrée**.
- App Expo vide : **présente**.
- Supabase/Vercel AI SDK : **préparés**.
- Déploiement Vercel + connexion Supabase dédié : **configurés côté repo** (`vercel.json`, `api/index.js`, `docs/09_DEPLOYMENT.md`).
- Module Pro/RPPS : **post-MVP, non activé**.
- Données santé identifiables : **interdites au MVP**.
- Chat streaming + appels LLM : **branchés côté API**, protégés par la safe-box 3 couches.

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
docs/                    Documentation fondatrice et ADRs
.github/workflows/       Gates CI
```

## Règle de développement

Ne pas ajouter de logique médicale, de triage, de diagnostic, de conduite à tenir individualisée ou de données santé persistées hors HDS. En cas de doute : ouvrir une ADR avant d'implémenter.
