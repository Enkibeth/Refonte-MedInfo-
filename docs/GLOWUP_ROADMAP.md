# MedInfo AI — Glow-up Roadmap (design / UX / produit)

```yaml
title: Glow-up Roadmap
version: 1.0.0
owner: Hugo Bettembourg
status: Active
date: 2026-06-07
```

Roadmap vivante du « glow up » visuel et produit. À mettre à jour à chaque passe.
Légende : ✅ fait · 🟡 en cours / partiel · ⬜ à faire.

## 1. Design system & identité

| Item | Statut | Détail |
|---|:---:|---|
| Refonte design (DM Sans, tokens, mouvement) | ✅ | PR #59 — `tokens.ts`, `Reveal`, `useReducedMotion`, accents persona, `+html.tsx` (DM Sans + reveal + `prefers-reduced-motion`) |
| Logo / branding | ✅ | Logo wordmark code (`src/ui/Logo.tsx`, `size`+`tone`) ; en-tête Compte/Tarifs/Légal ; hero landing |
| Landing « hero » + cartes persona | ✅ | `app/index.tsx` : hero petrol, `PersonaCard`, bloc confiance, finalité + disclosure AI Act |
| Réconciliation `main` ↔ `dev` | ✅ | Branding (#60/#61) + design system (#59) fusionnés sans perte (cette passe) |
| Thème sombre | ⬜ | Tokens prêts pour étendre ; non priorisé |
| Icônes complètes / illustrations cohérentes | 🟡 | `src/ui/icons.tsx` (set partiel) ; illustration chat conservée |

## 2. Expérience par rôle (persona)

| Item | Statut | Détail |
|---|:---:|---|
| Visibilité stricte des outils par rôle | ✅ | `featureVisibility.ts` + `RoleGate` + onglets adaptés (ADR-0018) |
| Section « Mes outils » (Compte) | ✅ | Liste les outils du rôle courant |
| Sélection / changement de rôle | ✅ | `choose-role` (email étudiant, RPPS pro) — vérif serveur |
| Mode switcher in-chat (public/étudiant/pro) | ⬜ | Proposé dans PR #49 (non mergée) — à arbitrer |

## 3. Outils IA par audience

| Outil | Audience | Statut | Détail |
|---|---|:---:|---|
| 💬 Chat santé | Tous | ✅ | Safe-box 3 couches + RAG cite-or-refuse |
| 📄 Analyse de document | Grand public | ✅ | Résumé patient (`/api/analyze`) |
| 🩺 ECOS | Étudiant | ✅ | Simulation + évaluation, cas en base (ADR-0017) |
| 📈 Analyseur de partiel | Étudiant | ✅ | **Nouveau** (`/api/partiel`, ADR-0019) : analyse de résultats QCM/partiels → items EDN faibles + plan de révision |
| 🎤 Audio (compte rendu) | Professionnel | ✅ | Transcription + compte rendu structuré |
| QCM interactifs | Étudiant | ✅ | `render_qcm` dans le chat |

## 4. Plateforme & conformité (rappel)

| Item | Statut | Détail |
|---|:---:|---|
| Panel admin (modèles + prompts + réglages) | ✅ | `ai_model_config` (0011/0015), `ai_prompts` (0012) |
| Quotas par feature | 🟡 | Décidé (ADR-0016) ; PR #51 ouverte |
| Versioning des prompts (historique + diff) | 🟡 | PR #58 ouverte (`0016_ai_prompts_history`) |
| RAG embeddings réels — **peuplement** | 🟡 | Pipeline livré ; ingestion en attente EU/ZDR OpenAI (ADR-0014) |
| Vérification RPPS / activation pro | 🟡 | PR #49 ouverte ; features cliniques gelées (ADR-0006) |
| Pages légales (champs éditeur) | 🟡 | « [À compléter] » avant lancement public |

## 5. Prochaines passes suggérées

1. Merger/clore les PR ouvertes pertinentes (#49 mode switcher, #51 quotas, #58 versioning prompts,
   #43 corpus RAG, #44/#45/#46 fixes) puis réaligner `main`/`dev`/`staging`.
2. Peupler les embeddings RAG une fois EU Data Residency + ZDR confirmés (action Hugo).
3. Compléter les champs éditeur des pages légales avant ouverture publique.
4. Étendre l'analyseur de partiel : import d'un fichier de résultats, suivi de progression (sous ADR
   si donnée attribuable).
