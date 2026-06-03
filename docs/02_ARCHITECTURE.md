# MedInfo AI — Architecture Technique

```yaml
title: Technical Architecture
version: 1.1.0
owner: Hugo Bettembourg
status: Active
date: 2026-06-03
linked_to: [00_CHARTER.md, 01_REGULATION.md, 03_SECURITY.md, 04_CHATBOT.md]
```

> Toute décision ici doit être justifiable par `01_REGULATION.md`. Architecture **regulatory-first**.

---

## 1. Stack (non négociable)

| Couche | Choix | Raison |
|---|---|---|
| Front unifié | **Expo SDK 56** (RN 0.85 / React 19.2), Expo Router v6 | UNE app → web + iOS + Android. Effet de levier max pour dev solo + Claude Code (un seul langage). |
| Backend / DB | **Supabase** (Postgres + Auth + pgvector + Storage) | Free ≤ 50k MAU. RLS native. RAG dans la même offre. |
| Orchestration IA | **Vercel AI SDK 5/6** (`useChat`, streaming SSE, tool-calling) | Streaming natif Expo via `expo/fetch`. Tool-calling typé pour QCM/skills. |
| Paiement | **Stripe web-first** (PAS d'IAP) | Économise 15-30% commission. Cf `06_BILLING.md`. |
| Design system | **NativeWind** (Tailwind RN) ou **Tamagui** | Cohérence cross-platform. Cf `05_DESIGN.md`. |
| Erreurs | **Sentry** | Observabilité front. |

**Interdits absolus :** WordPress, second langage backend, microservice non documenté, fichier hors structure.

---

## 2. Structure repo (monorepo léger, UNE app)

```
medinfo-ai/
├── app/                      # UNE app Expo Router (web+iOS+Android)
│   ├── (auth)/               # login, signup, audience routing
│   ├── (chat)/               # interface chat par persona
│   ├── (account)/            # réglages, switch student→pro
│   └── _layout.tsx
├── src/
│   ├── ai/
│   │   ├── prompts/          # artefacts versionnés (04_CHATBOT.md)
│   │   ├── guardrails/       # classifieur intention + validation sortie
│   │   ├── routing/          # cascade modèles (nano→mini→sonnet)
│   │   ├── skills/           # tool-calling
│   │   └── orchestrator.ts   # SEUL point d'accès LLM + DB
│   ├── rag/                  # retrieval pgvector
│   ├── compliance/           # intended purpose, disclaimers, refus
│   ├── db/                   # client Supabase typé
│   └── ui/                   # design system
├── supabase/
│   ├── migrations/           # DDL versionné
│   ├── policies/             # RLS — 1 policy = 1 fichier testé
│   └── seeds/
├── scripts/
│   ├── ingestion/            # PyMuPDF+Tesseract (porté tel quel)
│   ├── embeddings/           # chunk → pgvector
│   └── eval/                 # harness LLM-as-judge
├── tests/
│   ├── unit/
│   ├── rls/                  # isolation données (critique)
│   ├── prompt-regression/    # snapshots refus
│   └── prompt-eval/          # scoring qualité LLM-as-judge
├── docs/
└── .github/workflows/        # la VRAIE gouvernance (5 gates CI)
```

**Pourquoi pas `packages/` multiples :** un seul `package.json`, alias TS (`@/ai`, `@/rag`). Extraction en packages le jour où un 2ᵉ consommateur existe — YAGNI strict.

**Pourquoi UNE app :** routing par audience = groupes Expo Router + état auth, pas apps séparées.

---

## 3. Flux d'une requête chat (séquence)

```
User message
   │
   ▼
[1] Rate limit check (middleware) ──fail──▶ 429
   │ ok
   ▼
[2] Intent classifier (nano/haiku, déterministe)
   │
   ├─ personal_symptoms / emergency / ambiguous ──▶ Refus canonique `01_REGULATION.md §4` [LLM principal JAMAIS appelé]
   │
   └─ general_info / out_of_scope
        │
        ▼
   [3] RAG retrieval (pgvector, top-k chunks sourcés)
        │
        ▼
   [4] Orchestrator → modèle routé (mini défaut, sonnet si flag difficulté)
        │  + prompt système versionné (persona)
        ▼
   [5] Streaming réponse (Vercel AI SDK)
        │
        ▼
   [6] Output validation ──diagnostic individualisé détecté──▶ bloqué + remplacé + incident
        │ ok
        ▼
   [7] Réponse + sources + log ai_interactions
```

L'**orchestrator est le seul composant** qui touche à la fois le LLM et la DB. Les skills n'ont pas d'accès DB direct.

---

## 4. Modèle de données (tables principales)

| Table | Rôle | RLS | Données santé ? |
|---|---|---|---|
| `profiles` | user (audience, statut vérif) | Oui | Non |
| `conversations` | fil + dossier + persona | Oui | Non (titre générique) |
| `messages` | tours user/ai + sources | Oui | **Voie stateless : non persisté en clair pour public** |
| `folders` | organisation | Oui | Non |
| `rag_documents` | corpus + metadata licence/source | Lecture publique | Non |
| `rag_chunks` | embeddings pgvector + validation_hash | Lecture publique | Non |
| `ai_interactions` | audit (persona, modèle, tokens, latence, refusal_flag, guardrail_layer) | Service role only | Non |
| `subscriptions` | Stripe (tier, statut) | Oui | Non |

Schéma DDL détaillé : `supabase/migrations/`. RLS détaillée : `03_SECURITY.md`.

---

## 5. Cascade de modèles (routing)

| Étape | Modèle | Usage | Coût ind. |
|---|---|---|---|
| Classification | GPT-5.4 nano / Haiku 4.5 | intent + difficulté | ~gratuit |
| **Défaut** | **GPT-5.4 mini** | encyclopédie standard | ~0,016 €/conv |
| Escalade | Sonnet 4.6 / Opus | requêtes cliniques complexes (pro) | ~0,058 €/conv |

Marge brute > 75% sur tous tiers avec mini en défaut. Décision de routing loggée dans `ai_interactions`.

---

## 6. RAG — portage du pipeline existant

Pipeline Python (PyMuPDF + Tesseract OCR pour PDF CID-encodés) **inchangé jusqu'à l'étape chunks**. Seule la destination bascule : AI Engine Embeddings → **INSERT Supabase pgvector + index HNSW**.

Ingestion 30 manuels ≈ 7,5 M tokens ≈ **0,15 $** (`text-embedding-3-small` Standard) ou 0,075 $ Batch. Fonctionnellement gratuit. Gouvernance metadata : `04_CHATBOT.md` §RAG + gate CI `rag-license`.

---

## 7. Coûts infra (budget 500 € / 12 mois)

| Poste | Coût | Phase |
|---|---|---|
| Apple Developer | ~92 €/an | avant soumission iOS |
| Google Play | ~23 € one-time | avant soumission Android |
| Supabase | 0 € (free) → 23 €/mois (Pro) | Pro au lancement payant |
| Vercel | 0 € (Hobby) → ~19 €/mois (Pro) | Pro au lancement payant |
| OpenAI (dev/beta) | ~150-200 € | continu |
| Stripe | 0 € fixe (~1,5%+0,25 €/tx) | au lancement |
| **Réserve** | ~150 € | bascule Pro synchronisée 1ᵉʳ revenu |

**Hors budget mais critique : RCP ~400-800 €/an** (sortie de poche perso avant lancement public).

---

## 8. App stores — stratégie multiplatform

iOS/Android publiés **uniquement comme clients** (login + accès aux features déjà souscrites web). **Zéro bouton d'abonnement in-app** (guideline Apple 3.1.3(b) Multiplatform). Précédent Netflix/Spotify/ChatGPT. Détail : `06_BILLING.md`.

EAS Build (30 builds gratuits/mois) + EAS Submit. Enrôlement Organization (D-U-N-S) requis pour publier sous « MedInfo AI » → cf bascule SASU dans `01_REGULATION.md` §9.

---

## 9. Environnements

- **dev** : local + Supabase free + Vercel preview
- **staging** : branche `staging` + Supabase projet staging
- **main** : production

Git : `ai/<agent>/<feature>/<desc>` → PR → 5 gates CI → merge. Cf `03_SECURITY.md`.

---

## 10. Domaine & mise en production (procédure DNS)

> Procédure ponctuelle, à exécuter **le jour de la mise en prod du vrai domaine**, pas avant. Pendant le dev, l'app vit sur une URL Vercel temporaire (`medinfo-ai.vercel.app`).

### 10.1 Décision : repointer les DNS, ne PAS transférer (ADR-0004)

Le domaine `medinfo-ai.com` **reste enregistré chez Hostinger** (registrar, ~12 €/an). On ne transfère pas la propriété. On change uniquement où le domaine pointe : de l'hébergement WordPress → vers Vercel.

- **Coût : 0 €.** Réversible en 2 min (remettre les anciens enregistrements).
- Transfert sortant complet (vers Cloudflare/OVH/Namecheap) = plus de friction (code EPP, déverrouillage, 5-7 j, verrou ICANN 60 j possible) pour zéro bénéfice au lancement. **Reporté à plus tard** si regroupement registrar souhaité (optimisation de confort, non bloquante).

### 10.2 Étapes (le jour J)

1. **Prérequis :** safe-box réglementaire validée + app web prête à ouvrir au public (cf `01_REGULATION.md`). Ne pas repointer avant.
2. Dans le projet **Vercel** → Settings → Domains → ajouter `medinfo-ai.com` et `www.medinfo-ai.com`. Vercel affiche les valeurs DNS exactes à configurer.
3. Dans le panneau **DNS Hostinger** → remplacer les enregistrements pointant vers WordPress :
   - `A` (ou `CNAME`) pour `medinfo-ai.com` → valeur fournie par Vercel
   - `CNAME` pour `www` → valeur fournie par Vercel
4. Attendre la propagation (quelques min à quelques heures). Vercel confirme automatiquement + provisionne le certificat HTTPS.
5. Vérifier : `https://medinfo-ai.com` et `https://www.medinfo-ai.com` servent bien l'app Expo web.

### 10.3 ⚠️ Préserver les emails (MX)

Si des emails sont configurés sur le domaine (ex. `contact@medinfo-ai.com` via Hostinger), **NE PAS supprimer les enregistrements `MX`** en repointant — sinon la réception d'emails casse. Ne toucher qu'aux `A`/`CNAME` du web.
Si seul Gmail est utilisé (`medaifr1@gmail.com`), aucun MX à préserver côté domaine → rien à faire.

### 10.4 Pendant le dev

Le site WordPress actuel peut rester en ligne sans gêne jusqu'au jour J. La bascule DNS est l'unique action qui fait passer le public de l'ancien site à la nouvelle app.
