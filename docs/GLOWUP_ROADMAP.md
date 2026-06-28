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
| Logo / branding | ✅ | Logo wordmark code (`src/ui/primitives/Logo.tsx`, `size`+`tone`) ; en-tête Compte/Tarifs/Légal ; hero landing |
| Landing « hero » + cartes persona | ✅ | `app/index.tsx` : hero petrol, `PersonaCard`, bloc confiance, finalité + disclosure AI Act |
| Réconciliation `main` ↔ `dev` | ✅ | Branding (#60/#61) + design system (#59) fusionnés sans perte (cette passe) |
| Thème sombre | ⬜ | Tokens prêts pour étendre ; non priorisé |
| Icônes complètes / illustrations cohérentes | 🟡 | `src/ui/icons/icons.tsx` (set partiel) ; illustration chat conservée |

## 2. Expérience par rôle (persona)

| Item | Statut | Détail |
|---|:---:|---|
| Visibilité stricte des outils par rôle | ✅ | `featureVisibility.ts` + `RoleGate` + onglets adaptés (ADR-0018) |
| Menu déroulant d'outils (rôle-aware) | ✅ | `src/ui/components/ToolsMenu.tsx` dans les en-têtes (chat/document/audio) |
| Dictée vocale (voix → texte) chat + ECOS | ✅ | `src/ui/components/DictationButton.tsx` + `/api/transcribe` mode `raw` (Whisper) |
| Section « Mes outils » (Compte) | ✅ | Liste les outils du rôle courant |
| Sélection / changement de rôle | ✅ | `choose-role` (email étudiant, RPPS pro) — vérif serveur |
| Mode switcher in-chat (public/étudiant/pro) | ⬜ | Était dans PR #49 (fermée) — à refaire si voulu |

## 3. Outils IA par audience

| Outil | Audience | Statut | Détail |
|---|---|:---:|---|
| 💬 Chat santé | Tous | ✅ | Safe-box 3 couches + RAG cite-or-refuse |
| 📄 Analyse de document | Grand public | ✅ | Résumé patient (`/api/analyze`) |
| 🩺 ECOS | Étudiant | ✅ | Simulation + évaluation, cas en base (ADR-0017) |
| 📊 Analyseur de classement | Étudiant | ✅ | v1 (ADR-0019) : import CSV/TSV des notes de promo → rang, stats, comparaison par n° étudiant, **côté client sans IA** (`src/lib/classement.ts`). Support `.xlsx` direct = à ajouter si voulu |
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

1. **Fait** : « reparte de 0 » — #63 mergé sur `main`, `dev`/`staging` réalignés, 8 autres PR fermées
   (fixes #44/#45 ré-intégrés). À refaire proprement plus tard si voulu : quotas (#51), versioning
   prompts (#58), RPPS + mode switcher (#49), corpus RAG élargi (#43).
2. **Livrer l'analyseur de classement** dès réception de la spéc medoutils (format fichier, colonnes).
3. Peupler les embeddings RAG une fois EU Data Residency + ZDR confirmés (action Hugo).
4. Compléter les champs éditeur des pages légales avant ouverture publique.
