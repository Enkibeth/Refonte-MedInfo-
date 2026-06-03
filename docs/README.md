# MedInfo AI — Documentation fondatrice

Base documentaire du projet MedInfo AI v4. **À lire avant toute contribution** (humaine ou agent Codex/Claude Code). Point d'entrée : `../START.md`.

## Hiérarchie d'autorité
`01_REGULATION.md` > `00_CHARTER.md` > tous les autres. La conformité réglementaire prime sur tout.

## Index
| Doc | Rôle |
|---|---|
| `STATUS.md` | Statut courant du projet, validation des étapes, limites connues |
| `00_CHARTER.md` | Constitution, doctrine, critères de succès |
| `01_REGULATION.md` | **SOURCE DE VÉRITÉ** : safe-box non-MDSW, intended purpose, HDS, AI Act, refus |
| `02_ARCHITECTURE.md` | Stack, repo, flux, coûts, app stores, DNS |
| `03_SECURITY.md` | 5 gates CI, RLS, rate limit, secrets, audit, incidents |
| `04_CHATBOT.md` | **v2** : prompts sans triage + tool-calling natif + 3 personas + contrats + tests |
| `05_DESIGN.md` | Logo, palette petrol, typo, composants, accessibilité |
| `06_BILLING.md` | Stripe web-first, tiers, TVA, coûts/abonnements, vérif statut (RPPS) |
| `07_CLASSIFIER.md` | Classifieur d'intention (couche 1 safe-box) — composant critique |
| `08_RAG.md` | Pipeline RAG, qualité réponses, corpus FR, citation grounding |
| `09_DEPLOYMENT.md` | Runbook Vercel + Supabase dédié, variables, smoke-test |
| `DECISIONS/` | ADRs (1 fichier = 1 décision) — 8 décisions actées |

## Règle pour les agents IA
Toute PR passe 5 gates CI (`03_SECURITY §1`) : `compliance-grep`, `refusal-regression`, `rls-isolation`, `prompt-contract`, `rag-license`. Échec = merge bloqué. La conformité est **testée, pas déclarée**.

## TDD-conformité
Tests de refus et gates écrits **avant** les features.

## ADRs actées
| ADR | Décision | Statut |
|---|---|---|
| `0001-template.md` | Template ADR | Accepted |
| `0002-stack-expo-supabase.md` | Stack Expo/Supabase | Accepted |
| `0003-safe-box-non-mdsw.md` | Safe-box non-MDSW | Accepted |
| `0004-domaine-dns-vs-transfert.md` | Domaine/DNS vs transfert | Accepted |
| `0005-prompts-v2-sans-triage.md` | Prompts v2 sans triage | Accepted |
| `0006-report-module-pro.md` | Report module Pro | Accepted |
| `0007-verification-rpps-annuaire-sante.md` | Vérification RPPS/Annuaire Santé post-MVP | Accepted |
| `0008-refus-canonique-et-pro-post-mvp.md` | Refus canonique + Pro post-MVP | Accepted |
