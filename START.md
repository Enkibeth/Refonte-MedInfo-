# 🚀 START — Point d'entrée MedInfo AI v4

> **Agent (Codex / Claude Code) : lis ce fichier EN PREMIER, puis `.ai-governance.md`, puis `docs/01_REGULATION.md`. Ne code rien avant d'avoir lu ces trois fichiers et confirmé ta compréhension.**

## Quoi
Refonte totale de MedInfo AI : plateforme d'information médicale (3 personas : public, étudiant, pro). Stack neuve, zéro WordPress, zéro migration de données.

## Stack cible
Expo (web+iOS+Android, une app) · Supabase (Postgres+Auth+pgvector) · Vercel AI SDK · Stripe web-first · Claude Sonnet 4.6.

## Loi du projet (non négociable)
1. **Safe-box non-MDSW** : jamais de triage symptomatique, diagnostic individualisé, calculateur clinique interprétatif, synthèse décisionnelle. Cf `docs/01_REGULATION.md` (source de vérité).
2. **MVP = public + student uniquement.** Module pro REPORTÉ (ADR-0006).
3. **Une feature à la fois, validée avant la suivante.** Branche par feature (`ai/<agent>/<feature>`), jamais de push direct sur `main`.
4. **Tests de conformité AVANT les features** (TDD). 5 gates CI doivent passer (cf `docs/03_SECURITY.md §1`).
5. **Prompts = artefacts versionnés sous contrat** (cf `docs/04_CHATBOT.md`), jamais éditables en prod.

## Ordre d'exécution (step by step — ne PAS sauter d'étape)

| Étape | Objectif | Doc de référence | Validation |
|---|---|---|---|
| **0** | Lire `.ai-governance.md` + tout `docs/`. Restituer l'archi + les invariants. | tous | Résumé correct de la safe-box |
| **1** | Scaffold Expo + Supabase + Vercel AI SDK. Structure repo exacte. | `02_ARCHITECTURE §2` | `npm run dev` démarre, app web vide |
| **2** | Classifieur d'intention + tests de refus (TDD : tests d'abord). | `07_CLASSIFIER`, `03_SECURITY` | « j'ai mal au ventre » → refus ; tests verts |
| **3** | Auth Supabase + routing par persona + RLS testées. | `02_ARCHITECTURE §4`, `03_SECURITY §2` | Login OK, 3 personas routés, test RLS cross-user échoue |
| **4** | Chat streaming + prompt `public.v2` + 4 outils (tool-calling). | `04_CHATBOT §5,§8` | Question encyclopédique répond + boutons natifs |
| **5** | RAG pgvector sur petit corpus test (HAS/ANSM). | `08_RAG` | Une réponse cite une vraie source HAS |
| **6** | Prompt `student.v2` + render_qcm + show_sources (toggle). | `04_CHATBOT §6,§9` | QCM interactif + panneau sources fonctionnels |
| **7+** | Features une par une : historique, dossiers, export PDF, Stripe, vérif statut. | `06_BILLING` | Chacune validée isolément |

## Phrase type à chaque étape
> « On attaque l'étape N décrite dans `START.md` / `docs/`. Respecte les invariants de `.ai-governance.md`. **Fais-moi un plan avant de coder, je valide, puis tu codes.** Crée une branche `ai/codex/etape-N-xxx`. »

## Garde-fous
- Le « plan avant de coder » t'évite de te perdre — Hugo valide chaque bloc.
- Branche ratée = `git reset`, rien de cassé (équivalent propre de la leçon v3.0.6).
- Toute décision d'archi/produit → nouvel ADR dans `docs/DECISIONS/`.
- Toute PR met à jour `docs/CHANGELOG_AI.md`.

## À benchmarker avant de figer (ne pas trancher sur la foi des docs)
- Embedding : voyage-3.5-lite vs BGE-M3 (recall@3 sur 200 questions FR).
- Classifieur : Gemini Flash-Lite vs Haiku 4.5 (golden set).

## Hors budget mais à prévoir (Hugo, hors code)
- RCP pro ~400-800 €/an avant lancement public.
- Avis juriste IP/santé ~500-1500 € (corpus EDN/LiSA, abstracts) avant commercialisation.
- Demande avis GIO ANSM (gratuit) — à envoyer dès le mois 0.
