# 🚀 GLOW UP — Feuille de route session multi-agents

> Préparée à partir d'un audit complet du projet (2026-06-06).
> Objectif : répartir le travail sur **2 comptes Claude Code (CC-A, CC-B)** + **1 compte Codex (CX)** en une session.
>
> **Règle de répartition :**
> - 🟢 **Codex (CX)** = tâches *tokenivores* : génération de contenu en volume, dédup de datasets, texte légal, seeds, docs, tests répétitifs. Faible risque architectural.
> - 🔵 **Claude Code (CC)** = tâches *complexes* : multi-fichiers, sécurité, intégrations externes, contrats DB/code, refactors transverses.

---

## 0. Carte des dépendances & anti-collision

**Numéros de migration réservés** (pour éviter les collisions entre agents) :

| Migration | Tâche | Agent |
|-----------|-------|-------|
| `0011_ai_model_config.sql` | Config modèles IA | CC1 |
| `0012_ai_prompts.sql` | Prompts overridables | CC1 |
| `0013_ecos_cases.sql` | Cas ECOS en DB | CC4 |
| `0014_entitlements.sql` | Quotas par feature | CC5 |

**Règle d'or :** chaque tâche = **une branche dédiée** partant de `main` (ou de la branche d'intégration). Ne jamais faire travailler 2 agents sur les mêmes fichiers en parallèle. La colonne « Fichiers touchés » ci-dessous garantit zéro chevauchement par vague.

### Plan de vagues (3 agents en parallèle)

| Vague | CC-A 🔵 | CC-B 🔵 | Codex 🟢 |
|-------|---------|---------|----------|
| **1** | CC1 — Migrations config IA *(BLOCKER)* | CC2 — Classifier étage 2 (LLM) | CX1 — Dédup golden set |
| **2** | CC3 — Vérif RPPS/ANS (FHIR) | CC4 — Cas ECOS en DB | CX2 — Corpus de cas ECOS → *alimente CC4* |
| **3** | CC5 — Quotas par feature | CC7 — Versioning prompts (admin) | CX3 — Pages légales + CX4 — Seeds |
| **4** *(rab)* | CC6 — Audio natif | — | CX5 — Tests + CX6 — Docs |

> ⚠️ **CX2 alimente CC4.** Lance CX2 au début de la vague 2 ; CC4 commence par un schéma + placeholder et intègre le corpus de CX2 dès qu'il est prêt. S'ils tournent vraiment en simultané, fais générer le corpus à Codex en premier (vague 1 bis).

### À FAIRE MANUELLEMENT (toi, avant/pendant la session)

Ces tâches ne sont pas codables par un agent — elles vivent dans les dashboards.

- **M1 — Vercel env vars** : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (+ `ANNUAIRE_SANTE_API_KEY` pour CC3, + une clé Haiku/Gemini si CC2 utilise un 2e provider). À mettre en *Production* ET *Preview*.
- **M2 — Supabase Auth** : Dashboard → Auth → Providers : activer Email/password (+ Google, Apple si voulu). Auth → URL Configuration : Site URL (prod) + Redirect URLs (prod, preview Vercel, `http://localhost:8081`).
- **M3 — Appliquer les migrations** : une fois CC1 mergé, `supabase db push` (ou via MCP `apply_migration`). Idem 0013/0014.
- **M4 — Assets de marque** (design) : fournir `assets/brand/logo-wordmark.png`, favicon, splash. Le câblage `<Image>` dans `src/ui/Logo.tsx` + `app.json` est trivial — confie-le à un CC en fin de session si tu as les fichiers.
- **M5 — Vérif post-deploy** : `GET /api/health` doit renvoyer providers + Supabase OK.

---

# 🔵 TÂCHES CLAUDE CODE (complexes)

---

## CC1 — Migrations config IA *(BLOCKER absolu)* 🔵

**Pourquoi Claude Code :** contrat DB↔code à respecter au caractère près (sinon le panel admin écrit dans le vide). Sémantique RLS + seed obligatoire.

**Fichiers touchés :** `supabase/migrations/0011_ai_model_config.sql`, `supabase/migrations/0012_ai_prompts.sql` (création uniquement).

**Prompt à coller :**
```
Contexte : projet Expo Router + Supabase. Le panel admin IA (app/(admin)/index.tsx,
app/api/admin/config+api.ts) et les helpers src/ai/providers/featureModel.ts +
src/ai/prompts/promptStore.ts lisent deux tables Supabase qui N'EXISTENT PAS encore :
ai_model_config et ai_prompts. Résultat : le panel admin ne persiste rien.

Crée deux migrations sur la branche dédiée, en lisant d'abord les fichiers cités
ci-dessus pour respecter EXACTEMENT le contrat de colonnes.

1) supabase/migrations/0011_ai_model_config.sql
   - Table ai_model_config : key text PRIMARY KEY, model_id text NOT NULL,
     provider text NOT NULL, label text NOT NULL,
     updated_at timestamptz NOT NULL DEFAULT now().
   - ACTIVE RLS, AUCUNE policy client (accès service_role uniquement, comme
     ai_interactions). REVOKE ALL pour anon/authenticated.
   - SEED OBLIGATOIRE des 6 features (le POST admin fait un UPDATE, pas un upsert,
     donc les lignes doivent préexister) :
     chat → claude-sonnet-4-6 / anthropic / 'Chat'
     analyze → claude-sonnet-4-6 / anthropic / 'Analyse de document'
     ecos_simulate → claude-sonnet-4-6 / anthropic / 'ECOS — Simulation patient'
     ecos_evaluate → claude-sonnet-4-6 / anthropic / 'ECOS — Évaluation'
     audio_diarize → gpt-4o-mini / openai / 'Audio — Diarisation'
     audio_report → gpt-4o-mini / openai / 'Audio — Compte rendu'
     (vérifie ces valeurs contre FEATURE_DEFAULTS dans featureModel.ts)

2) supabase/migrations/0012_ai_prompts.sql
   - Table ai_prompts : key text PRIMARY KEY, label text NOT NULL,
     template text NOT NULL, scope text NOT NULL,
     version text NOT NULL DEFAULT '1.0.0',
     updated_at timestamptz NOT NULL DEFAULT now().
   - ACTIVE RLS, accès service_role uniquement (REVOKE anon/authenticated).
   - PAS de seed nécessaire (le code fallback sur PROMPT_DEFAULTS et le POST fait
     un upsert). Laisse la table vide ; ce sont des overrides.

3) Respecte le hardening de la migration 0010 : SET search_path figé sur toute
   fonction éventuelle ; pas de SECURITY DEFINER inutile.

4) Mets à jour CLAUDE.md (section « Architecture IA ») et docs si un fichier liste
   les migrations, pour mentionner 0011/0012.

NE TOUCHE À RIEN d'autre. Ne lance pas apply_migration (je le ferai). Commit +
push sur la branche dédiée. Donne-moi en fin de tâche le SQL des 2 fichiers pour
relecture.
```
**Critères d'acceptation :** les 6 lignes `ai_model_config` seedées ; RLS active sans policy client ; colonnes strictement alignées sur les `select()` de `config+api.ts`.

---

## CC2 — Classifier étage 2 (LLM) 🔵

**Pourquoi Claude Code :** sécurité-critique (couche 1 du safe-box), nouvelle feature IA → **convention CLAUDE.md obligatoire (6 étapes)**, calibrage de seuils.

**Fichiers touchés :** `src/ai/classifier/*`, `src/ai/orchestrator.ts`, `src/admin/index.ts`, `src/ai/providers/featureModel.ts`, `src/ai/prompts/promptStore.ts`, nouvelle migration ou ligne seed, `tests/classifier/llm-stage2.test.ts`.

**Prompt à coller :**
```
Contexte : le classifier de sécurité (src/ai/classifier/) a un étage 1 regex
opérationnel et un étage 2 LLM STUBBÉ (jamais câblé). Quand l'étage 1 renvoie
'ambiguous' avec faible confiance, on doit appeler un petit LLM rapide pour
trancher entre les catégories : general_info, personal_symptoms, emergency,
out_of_scope, ambiguous.

Tâche :
1. Lis src/ai/classifier/index.ts, decision.ts, src/ai/orchestrator.ts et
   tests/classifier/llm-stage2.test.ts pour comprendre le contrat existant.
2. Implémente l'étage 2 : appelle un modèle rapide (Claude Haiku 4.5 par défaut)
   avec un prompt système strict qui retourne UNIQUEMENT une des 5 catégories +
   un score de confiance. Parse robuste, fallback sur 'ambiguous' si réponse
   invalide. Timeout court + fail-safe : en cas d'erreur LLM, on garde la décision
   conservatrice (refus) plutôt que de laisser passer.
3. Câble-le dans l'orchestrateur : étage 2 déclenché seulement si étage 1 =
   ambiguous OU confiance < seuil. Ne ralentis pas le chemin nominal.
4. ⚠️ C'EST UNE NOUVELLE FEATURE IA → applique la CONVENTION OBLIGATOIRE de
   CLAUDE.md (les 6 étapes) avec feature key `classify_stage2` :
   - AI_FEATURES dans src/admin/index.ts
   - FEATURE_DEFAULTS dans featureModel.ts (claude-haiku-4-5-20251001 / anthropic)
   - ligne INSERT dans la migration ai_model_config (coordonne le numéro avec
     l'agent CC1 : si 0011 est pris, ajoute une migration 0015_classify_stage2_model.sql
     qui fait juste l'INSERT)
   - PROMPT_DEFAULTS dans promptStore.ts (le prompt système de classification)
   - getModelForFeature('classify_stage2') + getPromptTemplate('classify_stage2')
   - commentaire de convention en tête du fichier
5. Active/complète tests/classifier/llm-stage2.test.ts : mock le LLM, vérifie le
   fail-safe, le seuil de déclenchement, et qu'aucune catégorie dangereuse ne
   devient autorisée par erreur.

Sécurité : ne JAMAIS rendre une catégorie de refus (personal_symptoms, emergency)
autorisée. En cas de doute → refus. Lance `npm run test` (au moins le dossier
classifier + guardrails) avant de commit. Commit + push sur branche dédiée.
```
**Critères d'acceptation :** tests classifier verts ; fail-safe conservateur prouvé par test ; feature déclarée selon les 6 étapes.

---

## CC3 — Vérification RPPS / Annuaire Santé (FHIR) 🔵

**Pourquoi Claude Code :** intégration API externe (FHIR ANS), gestion d'erreurs/secrets, impacte le statut « professionnel ».

**Fichiers touchés :** `app/api/role+api.ts`, possiblement `src/auth/*`, `tests/unit/roles.test.ts`.

**Prompt à coller :**
```
Contexte : app/api/role+api.ts contient un TODO (~ligne 80) : la vérification RPPS
pour les professionnels de santé renvoie 'verified' SANS interroger l'Annuaire
Santé de l'ANS. Il faut implémenter le lookup FHIR réel.

Tâche :
1. Lis app/api/role+api.ts en entier + tests/unit/roles.test.ts (format RPPS).
2. Implémente un appel à l'API FHIR de l'Annuaire Santé (ANS) pour vérifier qu'un
   numéro RPPS existe et correspond à un professionnel actif. Utilise la variable
   d'env ANNUAIRE_SANTE_API_KEY. Endpoint Practitioner (recherche par identifier
   RPPS). Documente l'URL exacte utilisée en commentaire.
3. Gestion d'erreurs robuste : si la clé est absente OU l'API indisponible,
   comportement dégradé EXPLICITE et configurable (par défaut : statut 'pending'
   plutôt que 'verified' silencieux — ne jamais auto-valider un pro non vérifié).
   Ne crash pas la route.
4. Ne logge JAMAIS le numéro RPPS complet ni de PII dans ai_interactions / logs.
5. Mets à jour/ajoute des tests : RPPS valide (mock 200 + match), invalide (404),
   API down (fallback pending), clé manquante.
6. Documente la nouvelle var d'env dans .env.example et le README/docs.

Commit + push sur branche dédiée. Liste-moi ce qui reste à configurer côté
dashboard (obtention de la clé ANS).
```
**Critères d'acceptation :** aucun pro auto-validé sans vérif réussie ; pas de PII loggée ; tests couvrant les 4 cas.

---

## CC4 — Cas ECOS en base de données 🔵

**Pourquoi Claude Code :** schéma + RLS + refactor de l'écran + CRUD admin. *Consomme le corpus généré par CX2.*

**Fichiers touchés :** `supabase/migrations/0013_ecos_cases.sql`, `app/(chat)/ecos.tsx`, `app/api/ecos+api.ts`, panel admin (onglet cas ECOS), éventuellement `app/api/admin/config+api.ts`.

**Prompt à coller :**
```
Contexte : les cas ECOS sont actuellement HARDCODÉS dans le composant
app/(chat)/ecos.tsx (1 seul cas). On veut les déplacer en base Supabase + un
CRUD admin léger. Un corpus de cas (JSON) est/sera fourni dans
data/ecos-cases.json (généré par un autre agent) — si le fichier n'existe pas
encore, crée un cas placeholder et prévois le seed pour qu'il s'intègre plus tard.

Tâche :
1. Lis app/(chat)/ecos.tsx + app/api/ecos+api.ts pour récupérer la structure de
   cas attendue (consigne, rôle patient, grille d'évaluation, etc.).
2. supabase/migrations/0013_ecos_cases.sql : table ecos_cases avec id, slug unique,
   title, specialty, level, brief (consigne étudiant), patient_profile (jsonb),
   grading_grid (jsonb), is_published bool, created_at. RLS : SELECT public sur
   is_published=true ; écriture service_role uniquement (cohérent avec le reste).
   Seed depuis data/ecos-cases.json si présent, sinon 1 cas placeholder.
3. Refactore ecos.tsx pour charger la liste des cas publiés depuis Supabase
   (sélecteur de cas) au lieu du hardcode. Garde l'UX existante.
4. Ajoute un onglet/CRUD minimal dans le panel admin pour créer/éditer/publier un
   cas (réutilise le pattern de app/api/admin/config+api.ts, accès requireAdmin).
5. NE TOUCHE PAS aux migrations 0011/0012/0014 (autres agents). Utilise bien 0013.

Lance les tests liés à ECOS. Commit + push sur branche dédiée.
```
**Critères d'acceptation :** écran ECOS charge depuis la DB ; RLS publish-only ; CRUD admin fonctionnel ; intègre `data/ecos-cases.json` si présent.

---

## CC5 — Quotas par feature (entitlements granulaires) 🔵

**Pourquoi Claude Code :** logique billing transverse + schéma + impacts sur toutes les routes IA.

**Fichiers touchés :** `supabase/migrations/0014_entitlements.sql`, `src/billing/*`, `app/api/chat+api.ts`, `app/api/analyze+api.ts`, `app/api/ecos+api.ts`, `app/api/transcribe+api.ts`, tests billing.

**Prompt à coller :**
```
Contexte : le rate-limiting actuel est GLOBAL par persona (un seul compteur de
messages). On veut des quotas PAR FEATURE (ex : 10 analyses/mois en gratuit, X
ECOS, Y minutes audio) selon le plan d'abonnement.

Tâche :
1. Lis src/billing/ (entitlements, usage), la migration 0004_usage_counters.sql et
   les 4 routes IA (chat, analyze, ecos, transcribe) pour voir comment le compteur
   est incrémenté/vérifié aujourd'hui.
2. supabase/migrations/0014_entitlements.sql : étends usage_counters (ou nouvelle
   table) pour tracker par (user_id, feature_key, période). Définis une table/const
   de quotas par (plan, feature). RLS : lecture/écriture own-row (cohérent avec
   0004).
3. Implémente une fonction centrale checkAndConsume(userId, feature) dans
   src/billing/ qui vérifie le quota du plan et incrémente atomiquement. Renvoie un
   refus propre (HTTP 429 + message FR) si dépassé.
4. Câble-la au début de chaque route IA. Ne casse pas le comportement gratuit
   existant : définis des quotas par défaut raisonnables et documente-les.
5. Tests : quota atteint → 429 ; reset de période ; isolation RLS entre users.

NE TOUCHE PAS 0011/0012/0013. Utilise 0014. Lance les tests billing. Commit + push.
```
**Critères d'acceptation :** quota par feature appliqué sur les 4 routes ; 429 propre ; tests RLS + dépassement verts.

---

## CC6 — Audio natif (rab, optionnel) 🔵

**Fichiers touchés :** `app/(chat)/audio.tsx`, config permissions, possiblement `app.json`.

**Prompt à coller :**
```
Contexte : app/(chat)/audio.tsx ne supporte l'enregistrement que sur web ("available
on web only"). On veut l'enregistrement natif iOS/Android.

Tâche : implémente l'enregistrement audio natif via expo-av (ou expo-audio selon la
version Expo 56 installée — vérifie package.json). Gère les permissions micro
(iOS NSMicrophoneUsageDescription dans app.json, Android RECORD_AUDIO). Upload vers
/api/transcribe inchangé. Garde le chemin web fonctionnel (branche par plateforme).
Teste le build web ne casse pas. Commit + push sur branche dédiée.
```

---

## CC7 — Versioning & rollback des prompts (admin) 🔵

**Fichiers touchés :** `app/(admin)/index.tsx`, `app/api/admin/config+api.ts`, possiblement migration d'historique.

**Prompt à coller :**
```
Contexte : le panel admin permet d'éditer les prompts (table ai_prompts) mais sans
historique : pas de rollback, pas de diff. On veut versionner.

Tâche :
1. Lis app/api/admin/config+api.ts (POST type=prompt fait un upsert avec
   version '1.0.0' figée) et app/(admin)/index.tsx.
2. Ajoute une table d'historique ai_prompts_history (key, template, version,
   created_at, author) — nouvelle migration (numéro libre ≥ 0015, vérifie qu'aucun
   autre agent ne l'utilise). À chaque save, snapshot l'ancienne version.
3. Bump automatique de version (semver patch) à chaque save.
4. UI admin : liste des versions d'un prompt + bouton "restaurer" + diff simple
   (ancienne vs nouvelle). Accès requireAdmin.
5. Tests sur la logique de snapshot/restore.

Commit + push sur branche dédiée.
```

---

# 🟢 TÂCHES CODEX (tokenivores)

---

## CX1 — Dédup & diversification du golden set classifier 🟢

**Pourquoi Codex :** traitement en volume (500 items), mécanique, peu d'enjeu archi.

**Fichiers touchés :** dataset golden set du classifier (cherche dans `tests/` / `scripts/` / `data/`), pas de code applicatif.

**Prompt à coller :**
```
Contexte : le golden set de 500 items qui sert à tester le classifier de sécurité
contient 56 doublons exacts (signalé dans STATUS.md). Catégories visées :
general_info, personal_symptoms, emergency, out_of_scope, ambiguous.

Tâche :
1. Localise le fichier dataset (cherche les golden set / fixtures du classifier
   dans tests/, scripts/, data/).
2. Supprime les 56 doublons exacts.
3. Régénère des exemples DE REMPLACEMENT pour revenir à 500 (ou plus), en
   maximisant la DIVERSITÉ : varie le vocabulaire médical FR, les formulations,
   les niveaux de langue, les cas limites entre catégories. Équilibre la
   distribution entre les 5 catégories.
4. NE CHANGE PAS le format/schéma du dataset ni le label des exemples existants
   conservés. Respecte strictement la structure.
5. Vérifie : 0 doublon exact restant, distribution rapportée par catégorie.

Lance les tests du classifier (npm run test -- classifier) pour t'assurer que le
dataset reste valide. Commit + push sur branche dédiée. Donne un rapport :
avant/après par catégorie.
```

---

## CX2 — Corpus de cas ECOS (alimente CC4) 🟢

**Pourquoi Codex :** génération massive de contenu clinique structuré (texte). *À lancer tôt.*

**Fichiers touchés :** `data/ecos-cases.json` (nouveau).

**Prompt à coller :**
```
Contexte : on migre les cas ECOS (examen clinique objectif structuré, format
étudiant médecine FR) vers la base. Il faut produire un corpus de cas réalistes
au format JSON qui sera importé par une migration.

Tâche :
1. D'abord, lis app/(chat)/ecos.tsx pour copier EXACTEMENT la structure d'un cas
   (champs attendus : consigne/brief étudiant, profil patient à jouer, grille
   d'évaluation, etc.).
2. Crée data/ecos-cases.json : un tableau de 15 à 20 cas ECOS variés couvrant
   plusieurs spécialités (cardio, pneumo, gastro, neuro, uro, gynéco, pédiatrie,
   psychiatrie, dermato, urgences). Chaque cas :
   - slug unique, title, specialty, level (DFASM/etc.)
   - brief : consigne claire pour l'étudiant
   - patient_profile : éléments que l'IA-patient doit jouer (antécédents, motif,
     symptômes, réponses types) — FICTIF, jamais de vrai patient
   - grading_grid : critères d'évaluation pondérés (communication, anamnèse,
     examen, raisonnement, conduite)
3. Réalisme clinique mais 100% fictif et pédagogique. Français médical correct.
4. JSON strictement valide (vérifie avec un parse).

NE TOUCHE À AUCUN code applicatif ni migration — uniquement data/ecos-cases.json.
Commit + push sur branche dédiée.
```

---

## CX3 — Pages légales (CGU, mentions, RGPD) 🟢

**Pourquoi Codex :** rédaction de gros volumes de texte légal FR, faible risque code.

**Fichiers touchés :** `app/(legal)/legal.tsx` + éventuels nouveaux écrans, contenu uniquement.

**Prompt à coller :**
```
Contexte : app/(legal)/legal.tsx est un placeholder minimal. C'est une app
d'information médicale (PAS de diagnostic) avec comptes grand public / étudiant /
professionnel, abonnements Stripe, données hébergées sur Supabase.

Tâche : rédige le contenu légal complet en français, structuré et lisible
(markdown ou composants existants — calque le style des écrans actuels) :
1. Mentions légales (éditeur, hébergeur, contact).
2. CGU / CGV (abonnements, paiement Stripe, résiliation, droit de rétractation).
3. Politique de confidentialité RGPD (données collectées, finalités, base légale,
   sous-traitants : Supabase/Anthropic/OpenAI/Stripe, durée, droits, DPO/contact,
   transferts hors UE).
4. Disclaimer médical PROÉMINENT : outil d'information, ne remplace pas une
   consultation, pas de diagnostic/prescription, urgences → 15/112.
   Réutilise/aligne-toi sur src/compliance/ s'il existe déjà des textes de
   disclosure.

Laisse des [PLACEHOLDERS] clairs pour les infos que je dois remplir (raison
sociale, SIRET, adresse, email DPO). Ne touche pas à la logique applicative.
Vérifie la cohérence avec src/compliance/. Commit + push sur branche dédiée.
```

---

## CX4 — Seeds Supabase & corpus RAG 🟢

**Pourquoi Codex :** génération de seeds/contenu en volume.

**Fichiers touchés :** `supabase/seeds/*`, scripts d'ingestion RAG sous `scripts/`.

**Prompt à coller :**
```
Contexte : supabase/seeds/ est vide (seul un README existe). Le corpus RAG MVP est
limité (diabète, obésité, AINS) basé sur HAS/ANSM.

Tâche :
1. Lis supabase/seeds/README.md, les migrations RAG (0006/0009) et scripts/ (
   ingestion/embeddings) pour comprendre le format attendu (rag_sources,
   rag_chunks, métadonnées de licence : source, url, hash, licence).
2. Crée des scripts de seed reproductibles pour un jeu de données de dev cohérent
   (profils de test, config, et un corpus RAG élargi de quelques thèmes santé
   publique supplémentaires issus de sources ouvertes HAS/ANSM/Ameli — respecte
   STRICTEMENT les métadonnées de licence exigées par le gate CI rag-license).
3. N'introduis aucune source sans licence/URL/hash valides (le gate CI échouera).

NE TOUCHE PAS aux migrations existantes ni au code applicatif. Commit + push sur
branche dédiée. Vérifie le gate rag-license si possible.
```

---

## CX5 — Extension de la couverture de tests (rab) 🟢

**Prompt à coller :**
```
Contexte : suite de tests existante (~200 tests, vitest) dans tests/. On veut
élargir la couverture sans changer le comportement.

Tâche : identifie les zones sous-testées (parcours UI, edge cases des routes API,
guardrails étage 3, refus). Ajoute des tests unitaires/regression cohérents avec
le style existant (lis quelques tests d'abord). Ne modifie PAS le code de prod —
si un test révèle un bug réel, signale-le sans le corriger. Tous les tests doivent
passer. Commit + push sur branche dédiée.
```

---

## CX6 — Rafraîchissement de la documentation (rab) 🟢

**Prompt à coller :**
```
Contexte : docs riche (12 ADR, guides). Après les changements de cette session
(tables config IA, classifier étage 2, RPPS, cas ECOS en DB, quotas par feature),
la doc doit refléter le nouvel état.

Tâche : mets à jour CLAUDE.md (tableau des features IA, migrations), STATUS.md,
README, et ajoute de courts ADR pour les décisions structurantes (classifier
étage 2, quotas par feature, cas ECOS en DB). Aligne-toi sur le format ADR
existant. Documentation UNIQUEMENT, pas de code. Commit + push sur branche dédiée.
```

---

## Récapitulatif express

| ID | Agent | Titre | Bloquant ? | Dépend de |
|----|-------|-------|-----------|-----------|
| CC1 | 🔵 CC-A | Migrations config IA | **OUI** | — |
| CC2 | 🔵 CC-B | Classifier étage 2 (LLM) | non | (coord. n° migration avec CC1) |
| CC3 | 🔵 CC-A | Vérif RPPS/ANS | non | M1 (clé ANS) |
| CC4 | 🔵 CC-B | Cas ECOS en DB | non | CX2 (corpus) |
| CC5 | 🔵 CC-A | Quotas par feature | non | — |
| CC6 | 🔵 | Audio natif | non | — |
| CC7 | 🔵 CC-B | Versioning prompts | non | CC1 |
| CX1 | 🟢 CX | Dédup golden set | non | — |
| CX2 | 🟢 CX | Corpus cas ECOS | non | — (à lancer tôt) |
| CX3 | 🟢 CX | Pages légales | non | — |
| CX4 | 🟢 CX | Seeds + RAG | non | — |
| CX5 | 🟢 CX | Tests | non | — |
| CX6 | 🟢 CX | Docs | non | tout le reste |

**Ordre recommandé pour démarrer la soirée :**
1. Toi : M1 + M2 (dashboards) pendant que les agents bootent.
2. CC-A → **CC1** (débloque le panel admin). CC-B → CC2. CX → CX2 puis CX1.
3. Au merge de CC1 : applique les migrations (M3), vérifie `/api/health`.
4. Enchaîne les vagues 2→4 selon le tableau.
