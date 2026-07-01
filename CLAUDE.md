# CLAUDE.md — État IA / Supabase pour reprise par agents

```yaml
status: Active
date: 2026-06-10
owner: Hugo Bettembourg
scope: Documentation de reprise pour agents IA (Claude Code / Codex)
```

## ⚠️ Refonte 2026-06 (ADR-0024) : chat direct sans safe-box — sécurité à réintroduire après validation de l'ébauche par Hugo

> **Décision Hugo : refonte complète du chat. On valide d'abord une ébauche produit fonctionnelle, on réintroduit les couches de sécurité par-dessus ensuite.**
>
> `/api/chat` (`app/api/chat+api.ts`) est désormais un appel LLM **direct** : plus de
> classifieur pré-LLM, plus de guardrails/validation de sortie, plus de RAG injecté,
> plus de rate-limit sur le chat. Les modules correspondants sont **supprimés** du dépôt
> (`src/ai/orchestrator.ts`, `src/ai/classifier/*`, `src/ai/guardrails/*`, `src/ai/skills/*`,
> `src/ai/ui/*`, anciens prompts v1/v2, tests classifier/guardrails/prompt-regression) —
> contrairement à l'ADR-0023 qui les conservait derrière un interrupteur.
> 3 chatbots = 3 prompts produit complets fournis par Hugo (`public.v3`, `student.v3`,
> `professional.v2`). Le client choisit son chatbot (`body.chatbot`) ; côté serveur,
> `allowedChatbotsFor(persona vérifiée)` : public → chat public seulement ;
> étudiant/professionnel → les 3 chats.
> Restent actifs : disclosure passive, autorisation persona serveur, rate-limit sur
> `/api/analyze` et `/api/ecos` (`src/ai/rateLimit/`).
> Tant que ce bandeau est présent, la règle #2 ci-dessous est **relâchée par ADR-0024**
> (qui remplace ADR-0023). La réintroduction de la sécurité est planifiée après validation
> de l'ébauche par Hugo (voir « Suivi » de l'ADR-0024).

## ⚠️ Frontière grand public 2026-06 (ADR-0029) : encyclopédie conversationnelle

> **Le chatbot public est une encyclopédie qui *peut poser des questions de cadrage* pour mieux répondre — jamais un outil de diagnostic/triage.** Autorisé : questions de clarification + information **générale** (causes fréquentes, red flags, quand consulter en termes généraux). Interdit : diagnostic, décision/triage, **orientation individualisée** (« dans *votre* cas… »), posologie, temporalité personnalisée. Règle-pivot : *les questions cadrent l'information, la sortie reste générale, jamais individualisée* (`docs/01_REGULATION.md` §2/§3, v1.3.0).
>
> **Non-conformité connue (suivi séparé, docs d'abord)** : `src/ai/prompts/public.v3.ts` dépasse cette frontière (RECUEIL MINIMUM OBLIGATOIRE + « CE QUE CELA PEUT ÉVOQUER » + « QUE FAIRE MAINTENANT » = anamnèse → orientation individualisée). À réaligner en branche dédiée ; voir `docs/STATUS.md`.

## Règles de reprise

1. Lire `START.md`, `.ai-governance.md`, `docs/01_REGULATION.md`, puis `docs/README.md` avant tout changement.
2. Ne jamais dégrader la safe-box non-MDSW : classifieur avant LLM principal, refus déterministe en cas de doute, RAG cite-or-refuse. **(Relâchée temporairement par ADR-0024 — voir bandeau ci-dessus ; à rétablir lors de la réintroduction de la sécurité après validation de l'ébauche.)**
3. Ne pas implémenter d'historique patient, dossier, triage, diagnostic ou CAT individualisée sans ADR `Proposed` + arbitrage Hugo.
4. Une feature par branche dédiée ; documentation et ADR doivent accompagner chaque décision structurante.

## Tableau des features IA

| Feature | Statut | Surface / audience | Source de vérité | Sécurité / conformité | ADR |
|---|---|---|---|---|---|
| Chat direct 3 chatbots (refonte 2026-06) | Actif | Public (chat public) ; étudiant/pro vérifiés (les 3 chats) ; **visiteur non connecté : essai 1 message gratuit sur les 3 chatbots** | `app/api/chat+api.ts`, prompts `src/ai/prompts/public.v3.ts` / `student.v3.ts` / `professional.v2.ts`, contexte profil `src/ai/chat/chatContext.ts`, essai invité `src/chat/guestTrial.ts` | Appel LLM direct (gpt-5.2, web_search ON) ; pas de classifieur/guardrails/RAG/rate-limit sur le chat (temporaire) ; `allowedChatbotsFor()` serveur (`guestTrial` pour les anonymes) + refus serveur (401 `signup_required`) de toute conversation anonyme > 1 message utilisateur (`GUEST_TRIAL_MAX_USER_MESSAGES`) ; indicateur client 1/1 → 0/1 (localStorage) puis CTA inscription/connexion ; disclosure AI Act conservée | ADR-0024 |
| Suggestions d'amorce rotatives | Actif | Tous (chat, état vide) | `src/ai/chat/starterSuggestions.ts` (50 questions par chatbot), test `tests/unit/starter-suggestions.test.ts` | Affichage 3 par 3, rotation toutes les 30 s côté client (`suggestionWindow`) ; questions d'information générale uniquement | ADR-0024 |
| Parseur + rendu interactif des réponses chat | Actif | Tous (chat) | `src/ai/chat/parseAssistantMessage.ts`, `src/ui/chat/AssistantBlocks.tsx`, `src/ui/chat/SourceDetailModal.tsx`, `src/ui/MarkdownRenderer.tsx` | Parse SOURCES `SRCn::`, badges OFFICIEL/GUIDELINE/ÉTUDE/RCP, APPROFONDISSEMENTS, QUESTIONS_PATIENT, INTERACTION, AUTO-RÉFLEXION, `<!--CALC:…-->`, `[1]+[2]+[3]` étudiant ; références inline `(SRCx)` rendues en appels de note ¹ ² (`formatInlineCitations` — jamais de marqueur brut à l'écran ni dans le PDF, y compris export PDF) ; exposant inline **cliquable** (`MarkdownRenderer` `onCitationPress` + `sourceIdFromSuperscript`) et carte SOURCES cliquable → même modale niveau de preuve + bouton « Accéder à la source » (jamais d'ouverture directe du lien) ; propositions (APPROFONDISSEMENTS / INTERACTION / CALC / relances étudiant `[1]+[2]+[3]`) **à cocher** avec envoi groupé explicite via un bouton « Envoyer (N) » — jamais d'envoi immédiat au premier clic (cohérent avec QUESTIONS_PATIENT) ; bulle de statut pendant la génération (réfléchit / recherche de sources / rédige, via l'activité d'outil du stream) ; rendu 100% client | ADR-0024 |
| Historique des conversations + export PDF | Actif | Tous (chat) | `src/chat/history.ts` (CRUD client), `src/chat/serverHistory.ts` (archivage serveur), `src/ui/chat/HistoryPanel.tsx`, `src/ui/chat/ChatbotSwitcher.tsx`, `src/chat/exportChatPdf.ts`, migration `0020_chat_history.sql` | RLS own-row stricte (`chat_conversations`/`chat_messages`), test `tests/rls/chat-history.test.ts` ; contenu potentiellement sensible ; depuis 2026-06 la réponse assistant est archivée par `/api/chat` (service role, propriété de la conversation vérifiée contre le user du token, jamais le body) | ADR-0024 |
| Résilience hors-ligne du chat (2026-06) | Actif | Tous (chat) | `/api/chat` (`consumeStream` + archivage serveur `onFinish`), reprise + bouton « Réessayer » dans `app/(chat)/chat.tsx` | Page suspendue pendant le streaming (iOS coupe le flux en quittant Safari) → la génération va au bout côté serveur et la réponse est archivée ; au retour, le client la récupère depuis l'historique (poll ~1 min, bulle « Récupération de la réponse… ») ; en cas d'erreur, « Réessayer » vérifie d'abord l'historique avant de relancer la requête | ADR-0024 |
| Titre + catégorie de conversation `chat_meta` | Actif | Tous (chat) | `app/api/chat-meta+api.ts`, défaut `gemini-2.5-flash` (provider google) | Génère uniquement titre/catégorie ; pas de conseil médical ; configurable panel admin | ADR-0024 |
| RAG HAS/ANSM MVP | Conservé, non branché sur le chat | Documentaire (réutilisation future) | `rag_sources`, `rag_chunks`, `match_rag_chunks`, `src/rag/retrieval.ts` | Sources publiques whitelistées, métadonnées validées ; plus injecté dans `/api/chat` depuis la refonte (ADR-0024) | ADR-0014, ADR-0024 |
| Embeddings RAG réels | Pipeline livré, peuplement à faire | Retrieval documentaire | `text-embedding-3-small`, `scripts/embeddings/ingest-corpus.mjs` | Zéro pseudo-embedding ; lexical-only si clé/réseau échoue ; EU residency/ZDR à activer avant prod | ADR-0014 |
| Vérification étudiant | Actif | Choix rôle étudiant | `profiles`, route `app/api/role+api.ts` | E-mail académique / statut serveur, anti-auto-promotion RLS | ADR-0011 |
| Vérification RPPS / ANS | Configurée côté décision, activation contrôlée | Professionnels de santé | API FHIR Annuaire Santé, statut `pending` tant que clé absente | RPPS = donnée personnelle publique ; pro routable mais features cliniques gelées | ADR-0007, ADR-0011 |
| Facturation Stripe | Actif web-first | Plans public + étudiant | `subscriptions`, `billing_events`, webhook Stripe | Paywall = volume/features uniquement ; ne gate jamais les sources | ADR-0012 |
| Quotas par feature | Décidé / à maintenir côté serveur | Chat, ECOS, exports, transcriptions | Tables de limites/compteurs techniques, entitlements serveur | Quota découplé des sources ; service_role only ; aucune auto-promotion client | ADR-0016 |
| Cas ECOS en base | Décidé / feature pédagogique | Étudiants vérifiés | Tables de cas/stations pédagogiques versionnées | Cas explicitement fictifs ; aucun patient réel ; séparation du chat médical | ADR-0017 |
| Pages marketing + header public (2026-06) | Actif | Tous (public) | `src/ui/LandingHeader.tsx` (logo, menu Chatbots rôle-aware, Blog/À propos/Contact/Tarifs, CTA), `app/(marketing)/` (`a-propos.tsx`, `contact.tsx`, `blog/`), groupe public dans `app/_layout.tsx` | Pages statiques sans données ; le menu Chatbots reflète `allowedChatbotsFor` (jamais l'unique barrière) ; liens en bleu vif `accentVivid` | ADR-0024 |
| Blog santé + génération d'articles IA | Actif | Lecture publique ; génération + édition admin | Table `blog_posts` (migration `0022_blog_posts.sql`, lecture publiée seule), `src/blog/posts.ts` + `src/blog/toc.ts` (sommaire cliquable, test `tests/unit/blog-toc.test.ts`), pages `app/(marketing)/blog/`, API `app/api/admin/blog+api.ts` (feature `blog_generate` ; actions `update`/`upload_image`, `GET ?id=` pour relire un brouillon), éditeur admin `src/ui/admin/BlogEditorModal.tsx` (aperçu fidèle avant publication, édition titre/chapeau/catégorie/contenu avant ET après publication, barre d'outils markdown, remplacement de la couverture par une vraie photo — upload PNG/JPEG/WebP ≤ 4 Mo ou URL https — et insertion d'images dans le corps, rendues par `MarkdownRenderer` `![légende](url)`), onglet Blog du panel admin | RLS lecture publiée uniquement + zéro écriture client (test `tests/rls/blog-posts.test.ts`, GRANTs `supabase/policies/blog_posts.sql`) ; articles = information générale avec disclaimer, brouillon par défaut, relecture brouillon via l'éditeur admin (la page publique ne voit pas les brouillons — c'était le bug « article introuvable »), publication manuelle admin ; image de couverture best-effort (OpenAI Images → bucket public `blog-covers`, setup `supabase/setup/blog_covers_bucket.sql` hors harness) | ADR-0024 |
| Agent éditorial hebdo du blog (2026-06) | Actif | Publication automatique 1×/semaine (lecture publique) | Cron Vercel lundi 06:00 UTC (`vercel.json` crons) → `app/api/cron/weekly-blog+api.ts` → pipeline `src/blog/weeklyAgent.ts` : sujet (`blog_topic`, web_search ON, anti-doublon sur les 40 derniers titres) → rédaction (`blog_generate`, logique partagée avec l'admin via `src/blog/serverGeneration.ts`) → relecture (`blog_review` : publish/revise/reject) ; parseurs purs `src/blog/articleJson.ts` (test `tests/unit/blog-agent.test.ts`) | Fail-closed : reject ou relecture inexploitable → l'article reste en brouillon pour arbitrage admin ; route protégée par `CRON_SECRET` (cron Vercel) ou token admin (`?force=1` pour tester) ; garde anti-doublon 6 jours via `blog_posts.source = 'weekly_agent'` (migration `0024_weekly_blog_agent.sql`) ; RLS blog inchangée ; **requiert `CRON_SECRET` sur Vercel** | ADR-0025 |
| Analyse des partiels (medoutils) | Actif (v2, 2026-06) | Étudiants vérifiés | Page autonome `public/partiel.html` (servie statiquement par l'export web), embarquée en iframe par `app/(chat)/partiel.tsx` (RoleGate conservé) | Import .xlsx/.xls/.csv/.pdf (pdf.js) → stats par épreuve, quantiles, distributions interactives, radar, comparaison A/B, export PDF ; détection auto colonne identifiant + échelle /20 ou /100 (vote majoritaire) + virgules décimales FR + mentions ABS/DEF ; calcul 100% client (aucune donnée envoyée, sans IA) ; bloc « sauvegarde cloud » de la maquette retiré (exigerait table `analyses` + RLS + ADR, et passait des tokens en URL) ; ancien `src/lib/classement.ts` supprimé | ADR-0019 |
| Dashboard de révision étudiant (2026-06) | Actif | Étudiants vérifiés (et admins) | Écran natif `app/(chat)/revision.tsx` (RoleGate `revision`, autosave debouncé + date-pickers natifs `src/ui/revision/DateField(.web).tsx`) ; moteur DÉTERMINISTE pur `src/revision/engine/*` (workload/dates/riskScoring/planner/redistribution, modes lissé/charge-en-avance, tests `tests/unit/revision-planner.test.ts`) ; table unique `revision_plans` (plan complet en JSONB, migration `0027_student_revision.sql`) ; CRUD client RLS `src/revision/db/queries.ts`, validation pure `src/revision/db/plans.ts` (test `tests/unit/revision-plans.test.ts`) ; widgets `src/ui/revision/RevisionWidgets.tsx` ; **coup de pouce IA** `revision_plan_assist` (`/api/revision`, contexte serveur pur `src/revision/ai/revisionPrompt.ts`, test `tests/unit/revision-ai.test.ts`, migration `0028`) | Pédagogique uniquement (volumes de travail, planning) — jamais de symptôme/patient/santé ; chiffres jamais inventés (tout vient de l'utilisateur ou du moteur ; l'IA ne fait que des suggestions d'organisation, garde persona serveur étudiant/admin + disclosure IA) ; RLS own-row stricte (test `tests/rls/revision.test.ts`) ; jauge de risque vert/orange/rouge qui ne masque jamais l'irréalisme. Base de référentiels EDN = phase suivante (ADR séparé) | ADR-0027 |
| Visibilité des outils par rôle + menu d'outils | Actif | Tous (UI adaptée) | `src/ai/routing/featureVisibility.ts`, `src/ui/RoleGate.tsx`, `src/ui/ToolsMenu.tsx`, `app/(chat)/_layout.tsx` | Cloisonnement UI strict par persona ; menu déroulant rôle-aware ; jamais l'unique barrière (autorisation serveur conservée) | ADR-0018 |
| Dictée vocale (chat/ECOS) | Actif | Tous | `src/ui/DictationButton.tsx`, `/api/transcribe` mode `raw` | Voix → texte (Whisper) dans les saisies ; transcription brute ; le texte repasse par l'autorisation de la route cible (safe-box retirée du chat par ADR-0024) | ADR-0019 |
| Générateur de présentations (manuel + IA) | Actif | Étudiants + professionnels vérifiés (et admins) | Page autonome `public/presentation.html` (éditeur, aperçu, export PPTX Keynote-safe via pptxgenjs), embarquée en iframe par `app/(chat)/presentation.tsx` (RoleGate + token de session par postMessage) ; mode IA `app/api/presentation+api.ts`, prompt `presentation_generate` (`src/ai/prompts/promptStore.ts`), contexte serveur pur `src/ai/presentation/presentationPrompt.ts` (test `tests/unit/presentation-prompt.test.ts`), migration `0025` | Mode manuel 100% client (export PPTX dans le navigateur) ; mode IA = appel LLM (deck spec JSON régénéré à chaque tour), garde persona serveur étudiant/pro/admin (`serverPersona` + `isAdminUserId`, refus 403 sinon — jamais le body), rate-limit (compteur étudiant) ; le « médecin senior » n'invente jamais de référence ([à vérifier]) ; disclosure IA conservée | ADR-0018, ADR-0019 |
| Historique cloud des présentations (2026-06) | Actif | Étudiants + professionnels (propriétaire) | Table `presentation_decks` (migration `0026`), CRUD `app/api/presentations+api.ts` (client Supabase scopé au token → RLS), validation pure `src/presentation/decks.ts` (test `tests/unit/presentation-decks.test.ts`), autosave + panneau « Mes présentations » dans `public/presentation.html` | RLS own-row stricte (test `tests/rls/presentation-decks.test.ts`) ; conserve `deck` + `ai_history` (information médicale générale, jamais un dossier patient) ; autosave (debounce + tick + `pagehide` keepalive) anti-perte au changement de page ; un deck vierge n'est pas enregistré tant qu'il n'est pas édité | ADR-0026 |
| Module CV Builder (2026-06) | Actif | Étudiants + professionnels vérifiés (et admins) | Page autonome `public/cv-builder.html` (éditeur structuré, aperçu A4 live, gabarit médical 2 colonnes fidèle, export PDF généré côté client via html2canvas+jsPDF — plein cadre A4, sans en-tête/pied de page navigateur, bande latérale pleine hauteur —, import d'un CV existant, relecture IA, historique cloud), embarquée en iframe par `app/(chat)/cv-builder.tsx` (RoleGate + token de session par postMessage) ; relecture IA `app/api/cv+api.ts` (feature `cv_review`) ; import `app/api/cv-import+api.ts` (feature `cv_import`, texte extrait client par pdf.js/mammoth) ; CRUD cloud `app/api/cv-docs+api.ts` ; validation + minimisation + normalisation d'import pures `src/cv/cvDocument.ts` (test `tests/unit/cv-document.test.ts`) ; table `cv_documents` (migrations `0029`+`0030`) | Création/édition/aperçu/export PDF 100% client et gratuits ; relecture IA + import = jamais de réécriture/invention (le prompt n'invente aucun fait ni date ; import = structure fidèle du texte fourni) — garde persona serveur étudiant/pro/admin (`resolveChatPersona`, refus 403 sinon), rate-limit (compteur étudiant) ; minimisation RGPD `sanitizeCvForAi` (jamais la photo ni les coordonnées des référents par défaut) ; photo jamais importée ; RLS own-row stricte (test `tests/rls/cv-documents.test.ts`) ; un CV = donnée personnelle, jamais un dossier patient | ADR-0028 |

## Migrations Supabase — état documentaire

| Migration | Objet | Données santé ? | Accès client | Notes |
|---|---|---:|---|---|
| `0001_profiles.sql` | Profils user, persona, statut de vérification | Non | Own-row RLS | Base du routing d'audience |
| `0002_ai_interactions.sql` | Audit technique IA | Non (contenu sensible interdit) | Service role only | Ne pas utiliser comme historique patient |
| `0003_harden_handle_new_user.sql` | Durcissement trigger/RPC auth | Non | N/A | Sécurité auth |
| `0004_usage_counters.sql` | Compteurs journaliers rate-limit | Non | Service role only | Compteurs techniques sans contenu de message |
| `0005_profile_verification.sql` | Verrous anti-auto-promotion persona/status | Non | Own-row + garde serveur | Student/pro pending/pro verified |
| `0006_rag_pgvector.sql` | Sources/chunks RAG + pgvector + RPC | Non | Lecture documentaire contrôlée | Corpus HAS/ANSM public |
| `0007_subscriptions.sql` | Abonnements Stripe | Non | Lecture own-row ; écriture service role | Source de vérité paywall |
| `0008_billing_events.sql` | Idempotence webhooks Stripe | Non | Service role only | Anti-rejeu / déduplication |
| `0009_rag_match_or_semantics.sql` | Match RAG lexical OR + fusion dense | Non | RPC documentaire | Active RRF si embedding fourni |
| `0010_db_hardening.sql` | Search path fonctions + policies profiles | Non | Inchangé | Durcissement advisors Supabase |
| `0011_ai_model_config.sql` | Config admin du modèle par feature IA (seed des 6 features) | Non | Service role only (RLS sans policy client) | Lue par featureModel.ts + panel admin ; UPDATE → seed obligatoire |
| `0012_ai_prompts.sql` | Overrides admin des system prompts (key/template/scope/version) | Non | Service role only (RLS sans policy client) | Fallback PROMPT_DEFAULTS ; upsert au save |
| `0013_ecos_cases.sql` | Cas ECOS fictifs versionnés | Non si cas synthétiques uniquement | Lecture selon entitlement étudiant | Ne jamais importer de cas patient réel |
| `0014_feature_quotas.sql` | Quotas par feature et compteurs associés | Non | Service role only | Remplace la logique « quota chat unique » par une matrice extensible |
| `0015_ai_model_params.sql` | Réglages de génération par feature (temperature, reasoning_effort, verbosity, web_search) sur `ai_model_config` | Non | Service role only (hérite du verrou 0011) | Lus par featureModel.ts (`getFeatureSettings`), appliqués par featureRuntime.ts ; 0013/0014 réservés |
| `0016_verified_personas.sql` | Ensemble des rôles vérifiés par compte (`verified_personas persona[]`) + extension du verrou anti-élévation 0005 | Non | Own-row (lecture) + écriture service role | Bascule libre entre chats des rôles validés ; défaut `{public}` ; lu par AuthProvider, écrit par `/api/role` (ADR-0020) |
| `0017_profile_personal_info.sql` | Infos perso de profil (`first_name`, `last_name`, `age`, `sex`) + contraintes CHECK | Non (données perso, pas de santé) | Own-row (lecture + écriture user) | HORS verrou anti-élévation ; personnalise l'information générale du chat ; jamais diagnostic/anamnèse (ADR-0021) |
| `0018_ecos_cases_align_schema.sql` | Réconcilie `ecos_cases` (schéma FR dérivé en prod) vers le schéma du dépôt (`title`/`specialty`/`brief` + `patient_profile`/`grading_grid` jsonb) | Non (cas fictifs) | Lecture cas publiés | Corrige « column ecos_cases.title does not exist » ; idempotente, préserve les 16 cas |
| `0019_audio_documents.sql` | Bibliothèque transcriptions/comptes rendus audio (`title`, `folder`, `transcription`, `report`, `audio_path`, `audio_expires_at`) | Donnée sensible (consultation) | Own-row stricte (CRUD propriétaire) | Texte conservé indéfiniment ; audio ≤24h purgé par `pg_cron` (`supabase/setup/audio_storage_and_purge.sql`, hors harness) ; export PDF ; ADR-0022 |
| `0020_chat_history.sql` | Historique du chat : `chat_conversations` (chatbot, `title`/`category` générés par `chat_meta`) + `chat_messages` (user/assistant) | Potentiellement sensible (questions de santé) | Own-row stricte (CRUD propriétaire ; insert message vérifié contre la conversation du user) | Test `tests/rls/chat-history.test.ts` ; ADR-0024 |
| `0021_ai_model_config_refonte.sql` | Seed feature `chat_meta` (gemini-2.5-flash, google) + update `chat` → `gpt-5.2` (openai) avec `web_search = true` | Non | Service role only (hérite du verrou 0011) | Refonte 2026-06 ; le POST admin fait un UPDATE, la ligne `chat_meta` doit préexister ; ADR-0024 |
| `0022_blog_posts.sql` | Blog public : table `blog_posts` (slug, titre, sommaire via `## `, `cover_image_url`, statut draft/published) + seed `blog_generate` dans `ai_model_config` | Non (articles d'information générale) | Lecture publiée seule (anon + authenticated) ; écriture service role only | Test `tests/rls/blog-posts.test.ts` ; GRANTs `supabase/policies/blog_posts.sql` ; bucket Storage public `blog-covers` via `supabase/setup/blog_covers_bucket.sql` (hors harness) |
| `0023_document_analyses.sql` | Historique des analyses de documents (`mode` analyse/traduction, `source_name`, `target_language`, `result`) | Résultat potentiellement sensible ; **le document source n'est jamais stocké** | Own-row stricte (select/insert/delete propriétaire) ; archivage serveur via service role (`/api/analyze` onFinish) | Test `tests/rls/document-analyses.test.ts` |
| `0024_weekly_blog_agent.sql` | Agent hebdo du blog : colonne `blog_posts.source` (`admin`/`weekly_agent`) + seed `ai_model_config` des features `blog_topic` (web_search ON) et `blog_review` | Non (articles d'information générale) | Inchangé (lecture publiée seule ; écriture service role only) | Garde anti-doublon + traçabilité ; ADR-0025 |
| `0025_presentation_generator.sql` | Générateur de présentations : seed `ai_model_config` de la feature `presentation_generate` (claude-sonnet-4-6, anthropic). Aucune table : mode manuel 100% client, mode IA sans archivage | Non (support de présentation = information médicale générale, jamais un dossier patient) | Service role only (hérite du verrou 0011) | Le POST admin fait un UPDATE, la ligne doit préexister (convention 0011) ; ADR-0018 |
| `0026_presentation_decks.sql` | Historique cloud des présentations : table `presentation_decks` (`title`, `theme`, `deck` jsonb, `ai_history` jsonb) | Non (support de présentation = information médicale générale, jamais un dossier patient) | Own-row stricte (CRUD propriétaire via client scopé au token, route `/api/presentations`) | Test `tests/rls/presentation-decks.test.ts` ; ADR-0026 |
| `0027_student_revision.sql` | Dashboard de révision étudiant : table unique `revision_plans` (`title`, `exam_type`, `exam_date`, `plan` jsonb = dates/capacité/rythme/blocs+avancement) | Non (données pédagogiques : volumes de travail, planning ; jamais de santé) | Own-row stricte (CRUD propriétaire via client Supabase anon → RLS ; pas de route API ni table enfant) | Test `tests/rls/revision.test.ts` ; ADR-0027 |
| `0028_revision_ai_boost.sql` | Coup de pouce IA des révisions : seed `ai_model_config` de la feature `revision_plan_assist` (claude-sonnet-4-6, anthropic) | Non (conseils d'organisation pédagogique ; jamais de santé) | Service role only (hérite du verrou 0011) | Le POST admin fait un UPDATE, la ligne doit préexister (convention 0011) ; ADR-0027 |
| `0029_cv_builder.sql` | Module CV Builder : table own-row `cv_documents` (`title`, `theme` (`medical`), `document` jsonb) + seed `ai_model_config` de la feature `cv_review` (claude-sonnet-4-6, anthropic) | Non (CV = donnée personnelle : identité, parfois celles des référents ; jamais un dossier patient) | Own-row stricte (CRUD propriétaire via client scopé au token, route `/api/cv-docs`) ; seed service role only (hérite du verrou 0011) | Test `tests/rls/cv-documents.test.ts` ; le POST admin fait un UPDATE de la ligne `cv_review` qui doit préexister ; ADR-0028 |
| `0030_cv_import.sql` | Import d'un CV existant : seed `ai_model_config` de la feature `cv_import` (claude-sonnet-4-6, anthropic). Aucune table (sortie renvoyée au client, jamais archivée) | Non (CV = donnée personnelle ; jamais un dossier patient) | Service role only (hérite du verrou 0011) | Le POST admin fait un UPDATE de la ligne `cv_import` qui doit préexister ; ADR-0028 |

> Si une migration ci-dessus n'existe pas encore dans `supabase/migrations/`, la documenter comme décision attendue et ne pas modifier le schéma sans tests RLS correspondants.
> Note : `supabase/setup/` contient le setup Supabase-spécifique (bucket Storage `consultation-audio`, RLS Storage, purge `pg_cron`) NON rejoué par le harness RLS CI ; appliqué directement sur le projet via MCP.

## Points de vigilance

- `chat_meta` (titre/catégorie d'historique) requiert `GOOGLE_GENERATIVE_AI_API_KEY` côté serveur (Vercel) ; sans clé, repli déterministe sur les premiers mots de la question (l'archivage fonctionne quand même).
- L'agent hebdo du blog requiert `CRON_SECRET` côté Vercel (sinon le déclenchement cron est refusé, fail-closed) ; le verdict `reject` du relecteur laisse l'article en brouillon — surveiller l'onglet Blog du panel admin.

- Les features professionnelles cliniques restent gelées par ADR-0006 même si le RPPS devient vérifié.
- Les cas ECOS doivent rester des vignettes pédagogiques fictives ; un cas réel anonymisé reste refusé.
- Les quotas ne doivent jamais limiter l'accès aux sources de sécurité (HAS/ANSM) ni transformer une réponse refusée en réponse payante.
- Toute nouvelle table utilisateur : RLS active + test `tests/rls/` avant merge.

---

# MedInfo AI — Guide développement

## ⚠️ CONVENTION OBLIGATOIRE : Nouvelle fonctionnalité IA

Chaque fois qu'une **nouvelle fonctionnalité IA** est ajoutée (nouvelle API route qui appelle un LLM, nouveau mode dans une route existante), tu dois obligatoirement :

### 1. Déclarer la fonctionnalité dans le registre admin
Fichier : `src/admin/index.ts` → tableau `AI_FEATURES`

```ts
{
  key: 'ma_feature',          // identifiant unique snake_case
  emoji: '🔧',
  label: 'Ma fonctionnalité',
  description: 'Ce que fait cette fonctionnalité',
  apiRoute: '/api/ma-route',
  promptKeys: ['ma_feature'], // clés des prompts utilisés
  providers: ['anthropic', 'openai'], // providers compatibles
}
```

### 2. Ajouter le modèle par défaut dans featureModel.ts
Fichier : `src/ai/providers/featureModel.ts` → objet `FEATURE_DEFAULTS`

```ts
ma_feature: { modelId: 'claude-sonnet-4-6', provider: 'anthropic' },
```

### 3. Ajouter la ligne dans la migration SQL
```sql
INSERT INTO ai_model_config (key, model_id, label, provider) VALUES
  ('ma_feature', 'claude-sonnet-4-6', 'Ma fonctionnalité', 'anthropic');
```

### 4. Enregistrer le prompt dans promptStore.ts
Fichier : `src/ai/prompts/promptStore.ts` → objet `PROMPT_DEFAULTS`

```ts
ma_feature: {
  label: 'Ma fonctionnalité',
  scope: 'Nom de la catégorie',
  template: `Le prompt système ici...`,
},
```

### 5. Utiliser getModelForFeature() et getPromptTemplate() dans l'API
```ts
import { getModelForFeature } from '@/ai/providers/featureModel';
import { getPromptTemplate } from '@/ai/prompts/promptStore';

const [model, systemPrompt] = await Promise.all([
  getModelForFeature('ma_feature'),
  getPromptTemplate('ma_feature'),
]);
```

### 6. Ajouter le commentaire de convention dans le fichier API
```ts
/**
 * ⚠️  CONVENTION : le modèle utilisé (feature key: "ma_feature") est configurable
 * depuis le panel admin (app/(admin)/index.tsx).
 * Si tu ajoutes une étape IA ici, déclare-la dans src/admin/index.ts AI_FEATURES.
 */
```

---

## Architecture IA

| Fichier | Rôle |
|---------|------|
| `src/admin/index.ts` | Registre de toutes les features IA + contrôle accès admin |
| `src/ai/providers/featureModel.ts` | Sélection du modèle par feature (cache 60s depuis Supabase) |
| `src/ai/prompts/promptStore.ts` | Chargement des prompts (Supabase override > fichiers TS) |
| `app/(admin)/index.tsx` | Panel admin UI (modèles + prompts) |
| `app/api/admin/config+api.ts` | API admin (lecture/écriture config) |

| `src/ai/providers/featureRuntime.ts` | Construit les options d'appel LLM par feature (température, raisonnement, verbosité, web search) → `getRuntimeForFeature()` |

Tables Supabase (service role only, RLS sans policy) :
- `ai_model_config` — migrations `0011_ai_model_config.sql` (seed initial) + `0021_ai_model_config_refonte.sql` (seed `chat_meta`, chat → gpt-5.2 + web_search) ; le POST admin fait un UPDATE, les lignes doivent préexister.
- `ai_prompts` — migration `0012_ai_prompts.sql` (overrides des prompts ; table vide, fallback sur `PROMPT_DEFAULTS`).
- Réglages de génération par feature — migration `0015_ai_model_params.sql` (colonnes `temperature`, `reasoning_effort`, `verbosity`, `web_search` sur `ai_model_config`).

### Réglages par fonctionnalité (panel admin → onglet Modèles)
Chaque feature expose, **selon les capacités du modèle choisi** (`AVAILABLE_MODELS[].capabilities` dans `featureModel.ts`) :
- **Raisonnement** (`reasoning_effort` : minimal/low/medium/high) — OpenAI `reasoningEffort` ; Anthropic → budget *thinking*.
- **Verbosité** (`verbosity` : low/medium/high) — OpenAI `textVerbosity` (gpt-5.x).
- **Température** (0–2).
- **Recherche internet** (`web_search`, OFF par défaut sauf `chat`) — outil web du provider (OpenAI / Anthropic / Google). Pour le chat, `web_search` est **ON par défaut** depuis la refonte 2026-06 (migration 0021) : les prompts v3 exigent des sources réelles vérifiables (HAS/ESC/PubMed…).

Les réglages sont appliqués au call LLM par `getRuntimeForFeature()` dans toutes les routes IA.

## Panel admin

Accessible depuis **Mon compte → Ouvrir le panel admin IA** (comptes admin seulement).

Comptes admin : `medaifr1@gmail.com`, `h.bilal0@icloud.com`
Pour ajouter un admin : modifier `ADMIN_USER_IDS` dans `src/admin/index.ts`.

## Fonctionnalités IA actuelles

| Feature key | Route API | Modèle par défaut | Audience |
|-------------|-----------|-------------------|----------|
| `chat` | `/api/chat` | gpt-5.2 (web_search ON) | Tous — 3 chatbots (prompts `public`/`student`/`professional`) ; public → chat public seul, étudiant/pro vérifiés → les 3 |
| `chat_meta` | `/api/chat-meta` | gemini-2.5-flash | Tous (titre + catégorie d'une conversation) |
| `analyze` | `/api/analyze` | claude-sonnet-4-6 | Grand public — texte collé, PDF ou photo ; modes analyse (`analyze`) et traduction (`analyze_translate`) |
| `ecos_simulate` | `/api/ecos` | claude-sonnet-4-6 | Étudiant |
| `ecos_evaluate` | `/api/ecos` | claude-sonnet-4-6 | Étudiant |
| `audio_diarize` | `/api/transcribe` | gpt-4o-mini | Professionnel |
| `audio_report` | `/api/transcribe` | gpt-4o-mini | Professionnel |
| `presentation_generate` | `/api/presentation` | claude-sonnet-4-6 | Étudiant + Professionnel (mode IA du générateur de présentations) |
| `revision_plan_assist` | `/api/revision` | claude-sonnet-4-6 | Étudiant (coup de pouce planning du dashboard de révision ; conseils d'organisation, jamais médical) |
| `cv_review` | `/api/cv` | claude-sonnet-4-6 | Étudiant + Professionnel (relecture du CV : suggestions à valider, jamais de réécriture auto) |
| `cv_import` | `/api/cv-import` | claude-sonnet-4-6 | Étudiant + Professionnel (import d'un CV existant PDF/Word : structure le texte extrait, n'invente rien) |
| `blog_generate` | `/api/admin/blog` | claude-sonnet-4-6 | Admin (articles publiés visibles de tous) ; aussi appelé par l'agent hebdo |
| `blog_topic` | `/api/cron/weekly-blog` | claude-sonnet-4-6 (web_search ON) | Cron hebdo (choix du sujet de la semaine) |
| `blog_review` | `/api/cron/weekly-blog` | claude-sonnet-4-6 | Cron hebdo (relecture publish/revise/reject avant publication) |

## Visibilité des fonctionnalités par rôle (persona)

Chaque rôle ne voit QUE ses outils (le grand public ne voit pas les outils
étudiant/pro, et inversement). Le chat est commun à tous, mais les **3 chatbots**
(public/étudiant/professionnel) ne sont accessibles qu'aux comptes étudiant/pro
vérifiés et aux admins ; le grand public n'a que le chat public. Source de vérité
unique : `src/ai/routing/featureVisibility.ts` (module pur, testé dans
`tests/unit/feature-visibility.test.ts`) ; côté serveur `allowedChatbotsFor()`
dans `app/api/chat+api.ts`. La navigation utilise des icônes ligne (plus d'emojis).

**Visiteur non connecté (essai sans inscription, 2026-06)** : le groupe `(chat)` est
accessible sans session (`app/_layout.tsx`), mais `isGuest` dans `featureVisibility.ts`
ne montre QUE le chat (onglets, ToolsMenu, RoleGate). L'invité voit les 3 onglets de
chatbot, dispose d'UN message gratuit (indicateur 1/1 → 0/1, `src/chat/guestTrial.ts`,
localStorage) puis une carte propose inscription/connexion ; côté serveur, `/api/chat`
ouvre les 3 chatbots aux anonymes (`guestTrial`) mais refuse (401 `signup_required`)
toute conversation anonyme contenant plus d'un message utilisateur.

> **⚠️ Icônes (piège connu)** : les chemins SVG vivent dans `src/ui/iconPaths.ts`, avec DEUX
> implémentations de `<Icon>` : `src/ui/icons.tsx` (natif, `<Image>` data-URI) et
> `src/ui/icons.web.tsx` (web, `<svg>` inline, résolu automatiquement par Metro). Les data-URI
> SVG dans `<Image>` sont INVISIBLES sur l'export web de production — toujours passer par
> `icons.web.tsx` pour le web, et ajouter les nouveaux chemins dans `iconPaths.ts`.

> **⚠️ Design / animations (pièges connus, audit 2026-06)** : design system documenté dans
> `docs/05_DESIGN.md` (+ rapport `docs/audits/DESIGN_AUDIT_2026-06.md`). Sur react-native-web,
> la ref d'`Animated.View` n'expose PAS le nœud DOM : un `IntersectionObserver` posé dessus ne
> s'attache jamais (échec silencieux) — observer une sentinelle `View` 1×1 à la place (cf.
> `src/ui/Reveal.tsx`). Titres de page en Fraunces (`tokens.font.serif`), jamais en corps de
> texte. Tout mouvement doit rester coupé sous `prefers-reduced-motion`.

| Outil | Grand public | Étudiant | Professionnel | Admin |
|---|:---:|:---:|:---:|:---:|
| Chat santé (3 chatbots) | ✅ (chat public seul) | ✅ (les 3) | ✅ (les 3) | ✅ (les 3) |
| Analyse de document | ✅ | — | — | ✅ |
| ECOS | — | ✅ | — | ✅ |
| Classement (analyseur de promo) | — | ✅ | — | ✅ |
| Dashboard de révision | — | ✅ | — | ✅ |
| Audio (compte rendu) | — | — | ✅ | ✅ |
| Générateur de présentations | — | ✅ | ✅ | ✅ |
| Créateur de CV | — | ✅ | ✅ | ✅ |

Application :
- Barre d'onglets `app/(chat)/_layout.tsx` : onglet masqué via `href: null` si non visible.
- Accueil rôle-aware : étudiant/pro voient les 3 chats + leurs outils ; le public voit son chat.
- Switch de chatbot `src/ui/chat/ChatbotSwitcher.tsx` (étudiant/pro/admin uniquement).
- Menu déroulant d'outils `src/ui/ToolsMenu.tsx` (en-tête) : switch rôle-aware depuis n'importe quel écran.
- Garde d'écran `<RoleGate feature="…">` (`src/ui/RoleGate.tsx`) sur Document/ECOS/Classement/Audio
  (défense en profondeur contre l'accès direct / deep-link).
- Écran Compte : section « Mes outils » listant les outils du rôle courant.
- Dictée vocale `src/ui/DictationButton.tsx` (Whisper, `/api/transcribe` mode `raw`) dans les saisies de chat/ECOS.
- **Sécurité** : le masquage UI n'est jamais l'unique barrière. L'autorisation réelle des routes
  IA reste dérivée du profil vérifié côté serveur (`serverPersona.ts` ; garde persona étudiant/admin
  dans `/api/partiel`). ADR-0018.

---

# Contrat opératoire (lu à chaque session)

## 0. Reformulation en auto-prompt — AVANT d'agir
Avant d'exécuter, réécris EN INTERNE ma requête en prompt optimisé : identifie le domaine,
adopte le cadre d'un expert de ce domaine, explicite les exigences implicites et le critère
de réussite. Optimise la formulation, n'élargis JAMAIS le périmètre demandé.
- Tâche non triviale → restitue le cadre retenu en 1 ligne avant d'exécuter
  (domaine, objectif, critère de "fini").
- Tâche triviale (question factuelle, micro-correction) → saute cette étape, réponds directement.

## 1. Calibrage
Classe la tâche : triviale / standard / complexe, et règle l'effort dessus.
Ne sur-ingénie jamais une tâche triviale ; ne bâcle jamais une complexe.

## 2. Économie de tokens — décide SEUL, sans qu'on le demande
Tu choisis toi-même quand déléguer pour réduire le coût. Délègue au sous-agent `mecano`
(modèle Haiku) tout travail mécanique ou volumineux mais à faible enjeu de raisonnement :
recherche et lecture de code (grep, parcours de fichiers), scan de logs, exécution des tests
avec report des seuls échecs, édits mécaniques bien spécifiés (renommage, application d'un
patron connu), extraction ou résumé de gros documents.
Garde sur le modèle principal (Opus) : architecture, décisions de conception, logique sensible,
arbitrages ambigus, et TOUT contenu à enjeu clinique/médical — jamais délégué à un modèle plus faible.
Seuil : délègue seulement si le travail est assez gros pour que le gain dépasse le coût
d'amorçage d'un sous-agent ; pour 2-3 lignes triviales, fais-le directement.
Le fil principal ne reçoit que la synthèse du sous-agent, jamais le contenu brut.

## 3. Boucle (tâches standard et complexes)
- CADRER (déjà fait en 0) : objectif réel + critère de "fini". Multi-étapes → plan mode + todo (TodoWrite).
- IMPLÉMENTER : livre le produit fini. Interdits → TODO laissés, "on verra plus tard",
  contournement quand le vrai correctif est à portée, code non testé annoncé comme terminé.
- VÉRIFIER : tests + types + lint. Rouge = pas fini : corrige la CAUSE et reboucle.
  Ne JAMAIS affaiblir, contourner ou supprimer un test pour franchir la porte.
- AUTO-CRITIQUE : avant de rendre — ce qui peut casser, la dette restante, les hypothèses
  (1-3 lignes, zéro flatterie).

## 4. Porte de sortie (dure, auto-armée)
Pour une vraie tâche d'implémentation/refactor qui modifie du code : ARME la porte toi-même
au début en créant le fichier `.claude/loop-active` (touch). Tant qu'il existe, tu ne peux pas
t'arrêter sur des tests/types/lint rouges (hook Stop). Sur vert, la porte se désarme seule.
Ne rends QUE si : critère de "fini" atteint ET vert intégral ET auto-critique faite.
N'arme PAS la porte pour une question ou une micro-correction.

> Note repo : le hook (`.claude/hooks/loop_gate.py`) lance `typecheck` + `test:unit`
> (suite sans DB). Les tests RLS (`tests/rls/`) exigent un Postgres local et restent
> vérifiés via `npm run test:rls` / la CI — lance-les toi-même quand tu touches à une
> table ou une policy, le hook ne les couvre pas.

## 5. Décisions & questions
Ambiguïté d'implémentation → décision la plus défendable + signalement en 1 ligne.
Question PRÉALABLE seulement si conséquence grave : décision clinique, sécurité patient,
action irréversible, données sensibles, coût non trivial.

## 6. Honnêteté
N'invente jamais API, chiffre, chemin, signature, source. Incertain → dis-le et vérifie
(code, doc officielle, test). Sépare le vérifié de l'hypothèse.
