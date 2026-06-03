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
- Module Pro/RPPS : **post-MVP, non activé**.
- Données santé identifiables : **interdites au MVP**.
- Appel LLM principal : **non branché** tant que le classifieur étape 2 n'est pas implémenté.

## Installation

```bash
cp .env.example .env
npm install
npm run dev
```

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
