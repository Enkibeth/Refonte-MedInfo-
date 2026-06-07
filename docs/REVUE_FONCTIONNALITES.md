# Revue des fonctionnalités MedInfo AI + prompts d'amélioration

```yaml
status: Draft de travail
date: 2026-06-07
owner: Hugo Bettembourg
but: Passer en revue chaque fonctionnalité de l'app et fournir, pour chacune,
     un prompt prêt à coller pour l'améliorer et la fiabiliser une par une.
```

> **Mode d'emploi.** Pour travailler une fonctionnalité, ouvre une session/branche dédiée
> (`ai/<agent>/<feature>`), colle le bloc **PROMPT** de la section correspondante, et laisse
> l'agent te faire un plan AVANT de coder (règle `START.md`). Chaque PROMPT rappelle déjà les
> invariants safe-box, mais l'agent doit relire `START.md`, `.ai-governance.md`,
> `docs/01_REGULATION.md` et `docs/04_CHATBOT.md` avant tout changement.

## Rappel des invariants non négociables (s'appliquent à TOUTES les features)

- **Safe-box non-MDSW** : jamais de triage symptomatique, diagnostic individualisé, calculateur
  clinique interprétatif, ni synthèse décisionnelle pour un patient identifiable.
- **Defense-in-depth du refus** : classifieur (étage 1 regex + étage 2 LLM) → contrainte prompt →
  validation de sortie. Le LLM principal n'est appelé que pour `route_main_llm`.
- **RAG cite-or-refuse** : pas de source fiable → refus, jamais de complétion mémoire.
- **Refus canonique** : un seul message source de vérité (`CANONICAL_REFUSAL`), pas de variante.
- **Persona côté serveur** : dérivé de `profiles.persona` vérifié, jamais du client.
- **Prompts = artefacts versionnés** : modif = nouvelle version semver + regression + eval.
- **Pas de donnée santé / PII persistée** ; logs techniques uniquement (`ai_interactions`).

---

## Tableau de bord — état & priorité

| # | Fonctionnalité | Feature key | Route | Persona | État perçu | Priorité suggérée |
|---|---|---|---|---|---|---|
| 1 | Chat santé — public | `chat` | `/api/chat` | public | Actif | Haute |
| 2 | Chat santé — étudiant | `chat` | `/api/chat` | student | Actif | Haute |
| 3 | Chat santé — pro | `chat` | `/api/chat` | professional | **Gelé (ADR-0006)** | Ne pas activer |
| 4 | Analyse de document | `analyze` | `/api/analyze` | public | Actif, sans classifieur | Haute (risque MDSW) |
| 5 | ECOS — Simulation patient | `ecos_simulate` | `/api/ecos` | student | Actif | Moyenne |
| 6 | ECOS — Évaluation | `ecos_evaluate` | `/api/ecos` | student | Actif | Moyenne |
| 7 | Audio — Diarisation | `audio_diarize` | `/api/transcribe` | — | Actif | Moyenne |
| 8 | Audio — Compte rendu | `audio_report` | `/api/transcribe` | — | Actif | Moyenne |
| 9 | Classifieur d'intention | (transverse) | — | tous | Actif | Critique |
| 10 | RAG HAS/ANSM | (transverse) | — | tous | Lexical actif, dense prêt | Haute |
| 11 | Vérification de rôle | — | `/api/role` | tous | Actif (RPPS pending) | Moyenne |
| 12 | Facturation Stripe | — | `/api/billing`, `/api/stripe` | public/student | Actif | Basse |
| 13 | Panel admin (modèles + prompts) | — | `/api/admin/config` | admin | Actif | Basse |
| 14 | Rate limiting / quotas | — | (transverse) | tous | Actif | Moyenne |

---

## 1. Chat santé — persona PUBLIC

**Rôle.** Encyclopédie santé conversationnelle grand public. Réponses sourcées (HAS/ANSM/OMS),
refus déterministe sur tout ce qui est personnel/urgence.

**État & points à vérifier.**
- Prompt `public.v2` en place ; outils `propose_followups`, `show_sources`, `refuse_and_redirect`.
- Vérifier que les 3 couches de refus sont bien câblées dans `/api/chat` et que le LLM n'est jamais
  appelé hors `route_main_llm`.
- Vérifier le format de sortie (disclaimer obligatoire en pied, citations inline réelles issues du RAG).
- Vérifier que `show_sources` ne renvoie pas de citations inventées (doivent venir des chunks RAG).

> **PROMPT**
> « On travaille la fonctionnalité **Chat santé — persona public** (`chat`, `/api/chat`).
> Lis d'abord `START.md`, `.ai-governance.md`, `docs/01_REGULATION.md`, `docs/04_CHATBOT.md §4-5`,
> `docs/07_CLASSIFIER.md`, puis le code de `app/api/chat+api.ts`, `src/ai/prompts/public.v2.ts`,
> `src/ai/classifier/*`, `src/ai/guardrails/outputValidator.ts`, `src/rag/retrieval.ts`.
> Objectif : rendre le chat public *parfait et fonctionnel*. (1) Fais un audit : les 3 couches de
> refus sont-elles toutes câblées et testées ? Le LLM principal est-il appelé uniquement sur
> `route_main_llm` ? Les citations de `show_sources` proviennent-elles bien des chunks RAG (zéro
> invention) ? Le disclaimer est-il toujours présent ? (2) Liste les écarts trouvés. (3) Propose un
> plan avant de coder, je valide. Contraintes : ne JAMAIS dégrader la safe-box, refus canonique
> unique, RAG cite-or-refuse. Ajoute/maj les tests `tests/prompt-regression/` et garde
> `refusal_compliance = 1.0`. Toute modif de prompt = nouvelle version semver + ADR si prompt actif change. »

---

## 2. Chat santé — persona ÉTUDIANT

**Rôle.** Assistant pédagogique EDN/R2C/ECOS. Sourcing granulaire (Item/page/Rang), score de
fiabilité, QCM interactif. Cas fictifs autorisés, patient réel refusé.

**État & points à vérifier.**
- Prompt `student.v2` + outil `render_qcm` (student only).
- Vérifier l'exception « cas fictif pédagogique » de l'orchestrateur : le pattern autorise-t-il bien
  EDN/ECOS/R2C SANS laisser passer un cas réel déguisé ?
- Vérifier que `render_qcm` n'est exposé qu'au persona student (sinon `NoSuchToolError`).
- Vérifier la présence systématique du SCORE DE FIABILITÉ et le sourcing granulaire réel.

> **PROMPT**
> « On travaille la fonctionnalité **Chat santé — persona étudiant** (`chat` student, `/api/chat`).
> Lis `docs/04_CHATBOT.md §6,§8`, `src/ai/prompts/student.v2.ts`, `src/ai/orchestrator.ts`,
> `src/ai/skills/render_qcm.ts`, `app/(chat)/chat.tsx`. Objectif : fiabiliser le mode étudiant.
> (1) Audite l'exception "cas fictif pédagogique" : confirme par des tests qu'un cas EDN/ECOS/R2C
> explicitement fictif passe, mais qu'un cas patient réel (même anonymisé) ou des symptômes
> personnels sont refusés (y compris formulations de contournement). (2) Vérifie que `render_qcm`
> est filtré au seul persona student par l'orchestrateur. (3) Vérifie le sourcing granulaire
> (Item/page/Rang réels, zéro invention) et la présence du SCORE DE FIABILITÉ. Plan avant code,
> je valide. Ajoute les tests de refus/autorisation correspondants. »

---

## 3. Chat santé — persona PROFESSIONNEL (GELÉ)

**Rôle.** Moteur de référence documentaire pour HCP. **Reporté M6-M9 (ADR-0006).** Le prompt existe
(`professional.v1.ts`) mais ne doit PAS être servi par le chat au MVP (`CHAT_PERSONAS = ['public','student']`).

**État & points à vérifier.**
- Vérifier qu'aucun chemin ne route le persona `professional` vers le LLM de chat.
- Le travail ici est **de gouvernance**, pas d'activation : ne pas lever le gel sans arbitrage Hugo + ADR.

> **PROMPT (audit de gel uniquement)**
> « Vérifie que le persona **professional** reste totalement gelé côté chat (ADR-0006). Lis
> `src/ai/providers/serverPersona.ts`, `app/api/chat+api.ts`, `src/ai/prompts/professional.v1.ts`.
> Confirme qu'aucun chemin de code ne route un utilisateur `professional` vers le LLM de chat et
> qu'aucun test ne suppose l'inverse. NE PAS activer la feature. Rends un court rapport des points
> de routage à surveiller si on l'activait un jour. »

---

## 4. Analyse de document (`analyze`)

**Rôle.** Résumé patient-friendly d'un document médical (CR, ordonnance, résultats) : explication,
termes, questions à poser au médecin, points clés.

**État & points à vérifier (IMPORTANT — risque réglementaire).**
- La route n'a **pas de classifieur** en amont (le document est traité comme input « de confiance »).
  Risque : un utilisateur peut coller « voici mes symptômes, qu'est-ce que j'ai ? » dans le champ doc
  pour contourner le refus. À évaluer : faut-il une validation de sortie / un garde-fou anti-diagnostic ?
- Vérifier que le prompt interdit toute interprétation clinique / avis individuel (déjà annoncé) et que
  la sortie le respecte (validation de sortie ?).
- Vérifier troncature 8000 chars (perte d'info silencieuse → prévenir l'utilisateur ?).

> **PROMPT**
> « On travaille la fonctionnalité **Analyse de document** (`analyze`, `/api/analyze`).
> Lis `app/api/analyze+api.ts`, le prompt `analyze` dans `src/ai/prompts/promptStore.ts`,
> `src/ai/guardrails/outputValidator.ts`, `docs/01_REGULATION.md`. Objectif : sécuriser et fiabiliser.
> Point critique : cette route n'a pas de classifieur — analyse le risque de contournement (coller des
> symptômes personnels dans le champ "document" pour obtenir un diagnostic) et propose un garde-fou
> (validation de sortie anti-diagnostic individualisé réutilisant le guardrail existant, et/ou refus si
> le "document" est en réalité une question personnelle). Vérifie aussi : interdiction d'interprétation
> clinique respectée en sortie, gestion de la troncature 8000 chars (avertir l'utilisateur),
> disclaimer présent. Plan avant code, je valide. Ajoute des tests de contournement. »

---

## 5. ECOS — Simulation patient (`ecos_simulate`)

**Rôle.** L'IA joue un patient fictif pour entraîner l'étudiant (dialogue streaming). Cas issus de
`ecos_cases` (vignettes fictives versionnées).

**État & points à vérifier.**
- Le client fournit un system prompt custom (max 4000 chars) + l'historique. Vérifier qu'on ne peut
  pas détourner ce champ pour faire produire au modèle autre chose qu'un jeu de rôle patient fictif.
- Vérifier le rattachement aux cas `ecos_cases` publiés (entitlement étudiant).
- Vérifier que la simulation ne glisse jamais vers du conseil médical réel.

> **PROMPT**
> « On travaille la fonctionnalité **ECOS — Simulation patient** (`ecos_simulate`, `/api/ecos`).
> Lis `app/api/ecos+api.ts`, `app/(chat)/ecos.tsx`, la table `ecos_cases` (migration `0013`),
> le prompt `ecos_patient`, `docs` ADR-0017. Objectif : rendre la simulation robuste et bornée au
> pédagogique. (1) Audite l'injection du system prompt client (max 4000 chars) : peut-on détourner ce
> champ ? Faut-il le contraindre/valider côté serveur plutôt que faire confiance au client ? (2)
> Vérifie l'entitlement étudiant et le rattachement à un cas `ecos_cases` *publié et fictif*. (3)
> Garantis que l'IA reste dans le rôle "patient fictif" et ne produit jamais de conseil médical réel.
> Plan avant code, je valide. Tests : détournement du prompt custom + accès non-étudiant refusé. »

---

## 6. ECOS — Évaluation (`ecos_evaluate`)

**Rôle.** L'IA évalue la prestation de l'étudiant sur une grille (`grading_grid`) et rend note +
feedback pédagogique.

**État & points à vérifier.**
- Vérifier que l'évaluation s'appuie sur la grille du cas et non sur un jugement clinique libre.
- Vérifier le fallback non-bloquant (si l'appel échoue, réponse de repli propre).
- Vérifier la stabilité du format de sortie (sections markdown attendues par l'UI).

> **PROMPT**
> « On travaille la fonctionnalité **ECOS — Évaluation** (`ecos_evaluate`, `/api/ecos` mode evaluate).
> Lis `app/api/ecos+api.ts` (branche evaluate), le prompt `ecos_evaluate` dans `promptStore.ts`,
> la structure `grading_grid` de `ecos_cases`. Objectif : fiabiliser l'évaluation. (1) Vérifie que la
> note et le feedback s'ancrent sur la grille fournie (pas de jugement clinique hors grille). (2)
> Stabilise le format de sortie (sections attendues par l'UI) et teste un cas où le modèle renvoie un
> format inattendu. (3) Vérifie le fallback non-bloquant. Plan avant code, je valide. »

---

## 7. Audio — Diarisation (`audio_diarize`)

**Rôle.** À partir d'une transcription Whisper brute, étiqueter chaque prise de parole
« Médecin : » / « Patient : » (sinon « Intervenant : »).

**État & points à vérifier.**
- Pipeline 3 étages (Whisper → diarize → report) ; diarisation non-bloquante (fallback transcription brute).
- Vérifier le format de sortie strict (uniquement le texte étiqueté, sans commentaire).
- Vérifier la limite 25 Mo et les messages d'erreur clairs.

> **PROMPT**
> « On travaille la fonctionnalité **Audio — Diarisation** (`audio_diarize`, `/api/transcribe`).
> Lis `app/api/transcribe+api.ts`, `app/(chat)/audio.tsx`, le prompt `audio_diarize`. Objectif :
> fiabiliser l'étiquetage. (1) Vérifie que la sortie respecte strictement le format ligne par ligne
> ("Médecin :"/"Patient :"/"Intervenant :") sans préambule ni commentaire, et ajoute un nettoyage si
> le modèle dérape. (2) Vérifie le fallback non-bloquant vers la transcription brute. (3) Vérifie la
> limite 25 Mo et la clarté des erreurs. Plan avant code, je valide. »

---

## 8. Audio — Compte rendu (`audio_report`)

**Rôle.** Génère un compte rendu médical structuré à partir de la transcription étiquetée. Mention
« généré par IA — à valider par un professionnel ».

**État & points à vérifier.**
- Vérifier l'ancrage strict à la transcription (« n'invente rien »).
- Vérifier la présence systématique de la mention de validation humaine.
- Audience/usage : qui utilise cette feature (pro ?) ? Cohérence avec le gel pro.

> **PROMPT**
> « On travaille la fonctionnalité **Audio — Compte rendu** (`audio_report`, `/api/transcribe`).
> Lis `app/api/transcribe+api.ts`, le prompt `audio_report`, `docs/01_REGULATION.md`. Objectif :
> fiabiliser le CR. (1) Vérifie l'ancrage strict à la transcription (zéro invention) et teste un cas
> où des éléments sont absents. (2) Garantis la présence de la mention "généré par IA — à valider par
> un professionnel". (3) Clarifie l'audience et l'usage attendu de cette feature et sa cohérence avec
> le gel des features pro (ADR-0006). Plan avant code, je valide. »

---

## 9. Classifieur d'intention (transverse — CRITIQUE)

**Rôle.** Première barrière de la safe-box : regex (étage 1) + LLM léger (étage 2) → décision
`route_main_llm` / `refuse` / `out_of_scope_reply`. Re-classifie *chaque* tour utilisateur.

**État & points à vérifier.**
- Étage 2 (Gemini Flash-Lite) optionnel : fail-closed vers `ambiguous` si clé/réseau absent.
- Seuil `general_info ≥ 0.85`. Double-check : si étage 2 dit `general_info` mais regex a vu un marqueur
  personnel → rétrograder en `personal_symptoms`.
- Le golden set de refus doit rester à 100 % (`refusal_compliance = 1.0`).

> **PROMPT**
> « On travaille le **classifieur d'intention** (transverse safe-box). Lis `docs/07_CLASSIFIER.md`,
> `src/ai/classifier/regexClassifier.ts`, `llmStage2.ts`, `decision.ts`, `gate.ts`,
> `src/ai/orchestrator.ts`, `src/ai/classifier/lexicon.ts`, et `tests/prompt-regression/`. Objectif :
> durcir la détection sans sur-refuser. (1) Construis/étends un golden set FR de cas limites
> (symptômes personnels, urgences, contournements "imagine que tu es médecin", cas fictifs étudiants,
> questions encyclopédiques légitimes) et mesure faux positifs/négatifs. (2) Le faux négatif (laisser
> passer du personnel) est INACCEPTABLE : confirme le fail-closed étage 2 et la rétrogradation
> double-check. (3) Propose des ajouts de lexique/regex pour les trous détectés. Plan avant code,
> je valide. `refusal_compliance` doit rester 1.0. »

---

## 10. RAG HAS/ANSM (transverse)

**Rôle.** Récupération hybride lexical + dense (RRF) via `match_rag_chunks`, cite-or-refuse,
isolation anti-injection des sources (`⟦SOURCE_DATA⟧`).

**État & points à vérifier.**
- Embeddings réels prêts mais **corpus à peupler** (`scripts/embeddings/ingest-corpus.mjs`).
- Fallback local dev uniquement ; zéro pseudo-embedding ; lexical-only si la clé/réseau échoue.
- EU residency / ZDR à activer avant prod.
- Vérifier la sanitisation des contenus de source (anti prompt-injection).

> **PROMPT**
> « On travaille le **RAG HAS/ANSM** (transverse). Lis `docs/08_RAG.md`, `src/rag/retrieval.ts`,
> `src/rag/corpus/has-ansm-mvp.ts`, migrations `0006/0009`, `scripts/embeddings/ingest-corpus.mjs`.
> Objectif : passer du MVP lexical à un retrieval dense fiable. (1) Vérifie le peuplement des
> embeddings réels (text-embedding-3-small) et le pipeline d'ingestion ; documente l'état. (2)
> Confirme le cite-or-refuse (aucun chunk → refus) et l'isolation/sanitisation anti-injection des
> sources. (3) Vérifie le comportement de dégradation (lexical-only si embedding échoue, zéro pseudo-
> embedding) et les prérequis EU residency/ZDR avant prod. (4) Propose un mini-benchmark recall@3 sur
> un set FR. Plan avant code, je valide. »

---

## 11. Vérification de rôle (`/api/role`)

**Rôle.** Attribution serveur du persona (public / student / professional). Email académique pour
student, format RPPS + lookup Annuaire Santé FHIR (pending) pour pro. Anti auto-promotion (RLS).

**État & points à vérifier.**
- RPPS : validation format OK, lookup FHIR en `pending` tant que la clé est absente.
- Bypass dev (`BYPASS_ROLE_VERIFICATION`) : confirmer qu'il est impossible en prod.
- Pro vérifié ≠ features cliniques (restent gelées ADR-0006).

> **PROMPT**
> « On travaille la **vérification de rôle** (`/api/role`). Lis `app/api/role+api.ts`,
> `app/(account)/choose-role.tsx`, migration `0005`, ADR-0007/0011, `tests/rls/`. Objectif : fiabiliser
> sans ouvrir de faille. (1) Vérifie l'anti auto-promotion (écriture service_role, RLS) avec un test
> cross-user. (2) Confirme que le bypass dev est strictement inopérant en prod. (3) Vérifie la validation
> email académique et le format RPPS + l'état `pending` du lookup FHIR. (4) Rappelle dans le code/UI
> que pro vérifié ne déverrouille AUCUNE feature clinique (ADR-0006). Plan avant code, je valide. »

---

## 12. Facturation Stripe (`/api/billing`, `/api/stripe/webhook`)

**Rôle.** Checkout + webhook source de vérité du statut payé. Paywall = volume/features, jamais les sources.

**État & points à vérifier.**
- Webhook : vérification signature + idempotence (`billing_events`).
- Gating d'audience : plan cohérent avec persona vérifié.
- **Invariant** : le paywall ne doit jamais gater les sources de sécurité (HAS/ANSM) ni transformer un
  refus en réponse payante.

> **PROMPT**
> « On travaille la **facturation Stripe** (`/api/billing/checkout`, `/api/stripe/webhook`). Lis ces
> routes, migrations `0007/0008`, `docs/06_BILLING.md`, ADR-0012/0016. Objectif : fiabiliser le paywall.
> (1) Vérifie la signature webhook et l'idempotence (`billing_events`), avec un test de rejeu. (2)
> Vérifie le gating d'audience (plan ↔ persona) et l'écriture service_role (anti self-promotion). (3)
> Garantis par un test que le paywall ne gate jamais les sources HAS/ANSM ni ne convertit un refus en
> réponse payante. Plan avant code, je valide. »

---

## 13. Panel admin — modèles & prompts (`/api/admin/config`)

**Rôle.** Lecture/écriture de `ai_model_config` (modèle, provider, température, reasoning, verbosity,
web_search) et overrides de prompts (`ai_prompts`). Admins via `ADMIN_USER_IDS`.

**État & points à vérifier.**
- Auth admin stricte (Bearer + `ADMIN_USER_IDS`) ; invalidation du cache 60 s après écriture.
- POST `model` fait un UPDATE → les lignes doivent préexister (seed migration `0011`).
- Cohérence avec la convention « nouvelle feature IA » du CLAUDE.md.

> **PROMPT**
> « On travaille le **panel admin IA** (`/api/admin/config`, `app/(admin)/index.tsx`). Lis ces
> fichiers, `src/admin/index.ts`, `src/ai/providers/featureModel.ts`, `promptStore.ts`, migrations
> `0011/0012/0015`. Objectif : fiabiliser la config. (1) Vérifie l'auth admin (Bearer + ADMIN_USER_IDS)
> et l'invalidation du cache 60 s après save. (2) Vérifie que toutes les features de `AI_FEATURES` ont
> bien une ligne seedée (UPDATE only) et des défauts cohérents. (3) Vérifie que les réglages
> (temperature/reasoning/verbosity/web_search) sont exposés selon les capacités réelles du modèle.
> Plan avant code, je valide. »

---

## 14. Rate limiting / quotas (transverse)

**Rôle.** Limites journalières par persona/feature, appliquées AVANT le classifieur. Quotas découplés
des sources (jamais limiter HAS/ANSM).

**État & points à vérifier.**
- Compteurs techniques sans contenu de message ; service_role only.
- Vérifier que le rate limit s'applique bien en amont du classifieur sur toutes les routes IA.
- Matrice de quotas extensible (`0014`) plutôt que « quota chat unique ».

> **PROMPT**
> « On travaille le **rate limiting / quotas** (transverse). Lis `src/ai/rateLimit/chatRateLimit.ts`,
> migrations `0004/0014`, ADR-0016, et l'usage dans `app/api/*`. Objectif : cohérence et robustesse.
> (1) Vérifie que chaque route IA applique le rate limit AVANT le classifieur et le LLM. (2) Vérifie
> que les compteurs ne stockent aucun contenu de message (service_role only). (3) Garantis par un test
> qu'un quota épuisé ne gate jamais l'accès aux sources de sécurité ni ne transforme un refus en
> réponse payante. (4) Vérifie l'extensibilité de la matrice de quotas par feature. Plan avant code,
> je valide. »

---

## Ordre de travail recommandé

1. **Classifieur (#9)** et **RAG (#10)** d'abord : ce sont les fondations safe-box dont dépendent les chats.
2. **Chat public (#1)** puis **Chat étudiant (#2)**.
3. **Analyse de document (#4)** — risque réglementaire à traiter (pas de classifieur aujourd'hui).
4. **ECOS (#5, #6)** puis **Audio (#7, #8)**.
5. Transverses support : **rôle (#11)**, **quotas (#14)**, **admin (#13)**, **billing (#12)**.
6. **Pro (#3)** : rester gelé — audit de non-régression seulement.
</content>
</invoke>
