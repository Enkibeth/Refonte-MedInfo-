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
> 3 chatbots = 3 prompts produit complets fournis par Hugo (`public.v3`, `student.v4`,
> `professional.v2`). Le client choisit son chatbot (`body.chatbot`) ; côté serveur,
> `allowedChatbotsFor(persona vérifiée)` : public → chat public seulement ;
> étudiant/professionnel → les 3 chats.
> Restent actifs : disclosure passive, autorisation persona serveur, rate-limit sur
> `/api/analyze` et `/api/ecos` (`src/ai/rateLimit/`).
> Tant que ce bandeau est présent, la règle #2 ci-dessous est **relâchée par ADR-0024**
> (qui remplace ADR-0023). La réintroduction de la sécurité est planifiée après validation
> de l'ébauche par Hugo (voir « Suivi » de l'ADR-0024).

## Règles de reprise

1. Lire `START.md`, `.ai-governance.md`, `docs/01_REGULATION.md`, puis `docs/README.md` avant tout changement.
2. Ne jamais dégrader la safe-box non-MDSW : classifieur avant LLM principal, refus déterministe en cas de doute, RAG cite-or-refuse. **(Relâchée temporairement par ADR-0024 — voir bandeau ci-dessus ; à rétablir lors de la réintroduction de la sécurité après validation de l'ébauche.)**
3. Ne pas implémenter d'historique patient, dossier, triage, diagnostic ou CAT individualisée sans ADR `Proposed` + arbitrage Hugo.
4. Une feature par branche dédiée ; documentation et ADR doivent accompagner chaque décision structurante.

## Tableau des features IA

| Feature | Statut | Surface / audience | Source de vérité | Sécurité / conformité | ADR |
|---|---|---|---|---|---|
| Chat direct 3 chatbots (refonte 2026-06) | Actif | Public (chat public) ; étudiant/pro vérifiés (les 3 chats) ; **visiteur non connecté : essai 1 message gratuit sur les 3 chatbots** | `app/api/chat+api.ts`, prompts `src/ai/prompts/public.v3.ts` / `student.v4.ts` / `professional.v2.ts`, contexte profil `src/ai/chat/chatContext.ts`, essai invité `src/chat/guestTrial.ts` | Appel LLM direct (gpt-5.2, web_search ON) ; pas de classifieur/guardrails/RAG/rate-limit sur le chat (temporaire) ; `allowedChatbotsFor()` serveur (`guestTrial` pour les anonymes) + refus serveur (401 `signup_required`) de toute conversation anonyme > 1 message utilisateur (`GUEST_TRIAL_MAX_USER_MESSAGES`) ; indicateur client 1/1 → 0/1 (localStorage) puis CTA inscription/connexion ; disclosure AI Act conservée | ADR-0024 |
| Workflow agents qualité du chat (2026-07) | Actif | Tous (chat ; essais cliniques = chatbot pro seul) | `src/ai/chat/tools/` (`europe_pmc_search` avec tri relevance/recent/cited, `europe_pmc_article` = résumé complet par PMID/DOI, `clinical_trials_search`, `verify_source_links`, garde `urlSafety.ts`), **workflow evidence-first** (à la OpenEvidence) imposé par `buildChatToolsSection` : décomposer → RECHERCHER avant de rédiger → LIRE les résumés des 2-3 articles retenus → VÉRIFIER les liens → RÉDIGER ; boucle agentique `stopWhen: stepCountIs(modeRuntime.maxSteps)` dans `app/api/chat+api.ts`, bulle de statut par outil dans `app/(chat)/chat.tsx`, tests `tests/unit/chat-tools.test.ts` ; **balance rapidité/qualité (2026-07)** : lecture des 2-3 résumés EN UN SEUL tour (appels parallèles imposés par le prompt), sous-agent PubMed en SECONDE intention (1 appel max, plafond 2048 tokens de sortie), `verify_source_links` timeout 4 s + cache mémoire des verdicts ok/cassé (jamais les échecs réseau), chat public plafonné à `reasoning minimal` via `capReasoningEffort` ; **audit latence 2026-07** : plafond d'étapes standard abaissé `12 → 5` (deep `14 → 8`) car la latence de prod était linéaire dans le nombre d'étapes (~15-18 s/étape) sans gain de qualité au-delà de ~5 ; `web_search` OpenAI bridé à `searchContextSize: 'low'` (premier poste de tokens d'entrée et de latence — jusqu'à ~30 k tokens web injectés/réponse) et `maxUses: 3` côté Anthropic ; résumés Europe PMC injectés plafonnés `3000 → 2000` caractères ; **item H (latence perçue)** : trace de progression cumulative du workflow (recherche ✓ → lecture ✓ → vérification…) dans la bulle de statut via `src/ai/chat/progress.ts` (pur, testé `tests/unit/chat-progress.test.ts`) — données déjà dans le flux, aucun appel ajouté ; **item I (assemblage conditionnel du prompt)** : un tour PUREMENT conversationnel (« bonjour »/« merci ») détecté par `src/ai/chat/turnKind.ts` (`isConversationalTurn`/`latestUserText`, pur, CONSERVATEUR, testé `tests/unit/chat-turn-kind.test.ts`) n'envoie QUE le cœur clinique du prompt (pas le workflow outils/pharmaco/mode) et AUCUN outil (réponse directe instantanée) — on ne route JAMAIS les blocs cliniques (pas de classifieur pré-LLM, cf. ADR-0024) ; **G (retrieve-then-generate) reporté** (web_search ne s'exécute qu'au sein d'un appel LLM → à réévaluer avec le RAG) (`featureRuntime.ts`, pur, testé `tests/unit/feature-runtime.test.ts` — étudiant/pro gardent la config admin), instrumentation `steps`/`tool_calls` dans `ai_interactions` (`src/ai/logging/stepMetrics.ts`, migration `0034`, test `tests/unit/step-metrics.test.ts`), bulle de statut détaillée (titre de l'article lu via le paramètre `title`, requête cherchée, nb de liens vérifiés) | Objectif QUALITÉ (métadonnées d'études réelles Europe PMC, affirmations ancrées sur les résumés réels et non les seuls titres, NCT réels ClinicalTrials.gov, zéro lien mort dans SOURCES via vérification HEAD/GET avant rédaction), PAS une couche de régulation ; outils REST déterministes au sein de la feature `chat` (aucun appel LLM ajouté, pas de nouvelle feature admin ni migration) ; anti-SSRF (URLs http(s) publiques nommées seulement) ; archivage multi-étapes (concat des steps dans `onFinish`) ; modèle Google + web_search → outils custom désactivés (mix interdit par Gemini) ; **PubMed chatbot pro à deux voies** (`src/ai/chat/tools/pubmed.ts`) : modèle chat = Claude → connecteur MCP direct (`pubmedMcpServers`, serveur hébergé Anthropic `pubmed.mcp.claude.com`) ; modèle chat ≠ Claude (gpt-5.2 défaut) → **délégation orchestrateur → sous-agent Claude** via l'outil `pubmed_search` (feature admin `pubmed_agent`, migration `0031`, requiert `ANTHROPIC_API_KEY`) ; `PUBMED_MCP_URL=off` coupe les deux voies | ADR-0030 |
| Renfort pharmacologie + contexte pays du chat (2026-07) | Actif | Pharmaco : étudiant/pro vérifiés (chat) ; contexte pays : tous (chat) | Renfort pharmaco `src/ai/chat/pharmacology.ts` (pur, testé `tests/unit/chat-pharmacology.test.ts`) : `buildPharmacologySection(chatbot)` injecté dans le `system` (vide pour le grand public) — pour les questions médicamenteuses, PRIORISE via le workflow evidence-first existant les sources officielles (ANSM + base-donnees-publique.medicaments.gouv.fr/RCP, EMA, interactions ANSM, Le CRAT, PubMed/Europe PMC + HAS), profondeur adaptée à la complexité, cadrage SÛR des équivalences de doses ; sélecteur de pays `src/ui/chat/CountrySelector.tsx` + module pur `src/ai/chat/country.ts` (`coerceCountry`/`buildCountryContextSection`, testé `tests/unit/chat-country.test.ts`) envoyé dans le body de `/api/chat` (comme `personalInfo`, `localStorage medinfo:chatCountry`) → oriente les sources par pays ; assemblage `system = template + userContext + countryContext + toolsSection + pharmacoSection` (`app/api/chat+api.ts`) | GREFFE sur le pipeline evidence-first (ADR-0030), PAS un 4e chatbot : aucun nouvel appel LLM, aucun nouvel outil, aucune migration, aucune feature admin ; information pharmacologique GÉNÉRALE et sourcée — équivalences de doses INDICATIVES (à valider par le prescripteur, selon le RCP/contexte), jamais de prescription individualisée, ne jamais inventer de chiffre ; cloisonnement persona conservé (section vide grand public) ; pays = préférence client, jamais une source de vérité serveur ; limite assumée : fiabilité via web_search + littérature orientés domaines officiels, PAS des connecteurs REST ANSM/EMA (pas d'API publique propre) — outils REST déterministes = étape suivante | ADR-0033 |
| Mode de réponse + outils de sortie du chat (2026-07) | Actif | Tous (les 3 chatbots) | Composer `app/(chat)/chat.tsx` : `src/ui/chat/ResponseControls.tsx` (variante `bar` sur écran large = segmenté Rapide/Classique/Complexe + bouton « Ajouter » ; variante `inline` sur mobile < 700 px = deux boutons-icônes 🧠 profondeur + 🧰 outils intégrés à la barre du composer, la rangée disparaît pour gagner de la hauteur de chat) ; réglages envoyés dans le body de `/api/chat` (`responseMode`, `tools`), persistés `localStorage medinfo:chatResponseMode` / `medinfo:chatTools`. Modules PURS testés : `src/ai/chat/responseMode.ts` (`coerceResponseMode`, `responseModeRuntime(mode, chatbot)` → surcharges effort/verbosité/budget + plafond d'étapes `stepCountIs`, `buildResponseModeSection` ; test `tests/unit/chat-response-mode.test.ts`) et `src/ai/chat/outputTools.ts` (`coerceChatOutputTools`, `buildOutputToolsSection` : diagramme/points clés/tableau comparatif ; test `tests/unit/chat-output-tools.test.ts`). Diagramme natif : bloc ```medinfo-diagram``` (JSON) parsé par `src/ai/chat/diagram.ts` (pur, testé `tests/unit/chat-diagram.test.ts`), rendu cross-platform `src/ui/chat/DiagramView.tsx` via `MarkdownRenderer` (détection des fences ``` + bloc `diagram`), converti en plan texte pour Copier/export PDF (`assistantTextForExport` → `replaceDiagramsWithText`) | GREFFE sur la feature `chat` : AUCUN nouvel appel LLM, aucun nouvel outil serveur REST, aucune migration, aucune feature admin. `responseMode`/`tools` = préférences client bornées côté serveur (`coerce*`), JAMAIS un droit. Cloisonnement coût conservé : `standard` grand public reste plafonné `minimal` (comportement historique) ; `deep` grand public plafonné `medium` (jamais `high`) ; étudiant/pro montent jusqu'à `high`. Diagramme = augmentation de FORME (schéma déterministe rendu par l'app) ; les consignes sont conditionnelles (« quand c'est pertinent »), interdiction d'inventer seuil/chiffre/conduite ; JSON invalide/streaming incomplet → rien affiché (jamais de JSON brut). Rendu maison sans dépendance (pas de Mermaid), identique web + mobile | — (greffe chat, cf. ADR-0033/0034) |
| Pièce jointe (document) dans le chat (2026-07) | Actif | Étudiant / professionnel vérifiés (+ admin) — web | Bouton trombone du composer (`app/(chat)/chat.tsx`, `canAttach` = verified étudiant/pro/admin + web) → input DOM éphémère, lecture base64 client, envoyé dans le body de `/api/chat` (`attachment`) ; module PUR `src/ai/chat/attachment.ts` (`coerceChatAttachment` valide/borne, `appendAttachmentToModelMessages` injecte PDF `file` / photo `image` / texte inliné dans le dernier message utilisateur APRÈS `convertToModelMessages`, test `tests/unit/chat-attachment.test.ts`) ; garde serveur sur la persona vérifiée (jamais le body) ; puce « 📎 nom » dans la bulle | Réutilise le pattern multimodal de `/api/analyze` (document transmis au modèle puis OUBLIÉ, JAMAIS stocké — seul le marqueur « 📎 nom » est archivé, pas le contenu) ; max 6 Mo, types PDF/JPEG/PNG/WebP/texte ; aucune migration, aucune feature admin, aucun nouvel appel LLM ; fiabilité dépendante des capacités multimodales du modèle du chat (gpt-5.2 lit image+PDF) ; masquage UI jamais l'unique barrière (garde persona serveur) ; web-first (pas de picker natif) | ADR-0034 |
| Citations ancrées de l'analyse de document (2026-07) | Actif (modèle `analyze` = Claude uniquement) | Grand public (outil Analyse de document) | `src/document/citations.ts` (pur : footer `<!--CITATIONS:…-->`, parse, libellés pages), `/api/analyze` (blocs `document` + `citations.enabled`, flux texte + pied, archivage avec pied), section « Passages du document cités » dans `app/(chat)/document.tsx`, tests `tests/unit/document-citations.test.ts` | API Citations d'Anthropic : chaque passage cité vient MOT POUR MOT du document analysé (page PDF ou extrait texte) — vérifiabilité, anti-hallucination ; PDF + texte collé seulement (pas les images) ; le document lui-même n'est toujours jamais stocké ; providers non-Anthropic : comportement antérieur inchangé | ADR-0030 |
| Section QCM type EDN (chat étudiant, 2026-07) | Actif | Étudiant / professionnel vérifiés (et admins) — chat étudiant | Bouton « Générer un QCM (type EDN) » sous les réponses du chat étudiant (`app/(chat)/chat.tsx`), route `app/api/qcm+api.ts` (feature `qcm_generate`, `generateObject`), prompt `qcm_generate` (`promptStore.ts`), module PUR `src/qcm/qcm.ts` (types + validation + **notation déterministe barème EDN « discordances »**, test `tests/unit/qcm.test.ts`), UI interactive `src/ui/chat/QcmCard.tsx` (QCM/QCS, nb de propositions variable 3-6, validation explicite → correction item par item + note /20), migration `0036` | Génération à la demande seulement (clic), rien archivé ; QCM (plusieurs bonnes réponses) + QCS (une seule), justification par proposition ; la NOTE n'est JAMAIS fournie par l'IA — recalculée côté client à partir de la grille (0 discordance = 1, 1 = 0,5, 2 = 0,2, ≥3 = 0 ; QCS tout-ou-rien) ; garde persona serveur étudiant/pro/admin (`resolveChatPersona`, refus 403) + rate-limit (compteur étudiant) ; anti-hallucination (prompt : aucun chiffre/reco inventé) ; entraînement sur connaissances générales, aucun conseil individuel | ADR-0024 |
| Suggestions d'amorce rotatives | Actif | Tous (chat, état vide) | `src/ai/chat/starterSuggestions.ts` (50 questions par chatbot), test `tests/unit/starter-suggestions.test.ts` | Affichage 3 par 3, rotation toutes les 30 s côté client (`suggestionWindow`) ; questions d'information générale uniquement | ADR-0024 |
| Parseur + rendu interactif des réponses chat | Actif | Tous (chat) | `src/ai/chat/parseAssistantMessage.ts` (+ `assistantTextForExport` : version « texte propre » partagée Copier/export PDF ; alias `SOURCES UTILISÉES` + fallback body anti-perte, audit 2026-07), `src/ui/chat/AssistantBlocks.tsx`, `src/ui/chat/SourceDetailModal.tsx`, `src/ui/MarkdownRenderer.tsx` | Parse SOURCES `SRCn::`, badges OFFICIEL/GUIDELINE/ÉTUDE/RCP, APPROFONDISSEMENTS, QUESTIONS_PATIENT, INTERACTION, AUTO-RÉFLEXION, `<!--CALC:…-->`, `[1]+[2]+[3]` étudiant ; références inline `(SRCx)` rendues en appels de note ¹ ² (`formatInlineCitations` — jamais de marqueur brut à l'écran ni dans le PDF, y compris export PDF) ; exposant inline **cliquable** (`MarkdownRenderer` `onCitationPress` + `sourceIdFromSuperscript`) et carte SOURCES cliquable → même modale niveau de preuve + bouton « Accéder à la source » (jamais d'ouverture directe du lien) ; propositions (APPROFONDISSEMENTS / INTERACTION / CALC / relances étudiant `[1]+[2]+[3]`) **à cocher** avec envoi groupé explicite via un bouton « Envoyer (N) » — jamais d'envoi immédiat au premier clic (cohérent avec QUESTIONS_PATIENT) ; bulle de statut pendant la génération (réfléchit / recherche de sources / rédige, via l'activité d'outil du stream) ; rendu 100% client | ADR-0024 |
| Historique des conversations + export PDF | Actif | Tous (chat) | `src/chat/history.ts` (CRUD client + `renameConversation`), `src/chat/serverHistory.ts` (archivage serveur ; `replaceLast` : une régénération REMPLACE la dernière réponse archivée au lieu de l'empiler — audit 2026-07), `src/ui/chat/HistoryPanel.tsx` (`ConversationList` réutilisée : modale mobile + colonne persistante desktop shell dans `chat.tsx`), `src/ui/chat/ChatbotSwitcher.tsx`, `src/chat/exportChatPdf.ts`, migration `0020_chat_history.sql` | RLS own-row stricte (`chat_conversations`/`chat_messages`), test `tests/rls/chat-history.test.ts` ; contenu potentiellement sensible ; depuis 2026-06 la réponse assistant est archivée par `/api/chat` (service role, propriété de la conversation vérifiée contre le user du token, jamais le body) | ADR-0024 |
| Résilience hors-ligne du chat (2026-06) | Actif | Tous (chat) | `/api/chat` (`consumeStream` + archivage serveur `onFinish`), reprise + bouton « Réessayer » dans `app/(chat)/chat.tsx` | Page suspendue pendant le streaming (iOS coupe le flux en quittant Safari) → la génération va au bout côté serveur et la réponse est archivée ; au retour, le client la récupère depuis l'historique (poll ~1 min, bulle « Récupération de la réponse… ») ; en cas d'erreur, « Réessayer » vérifie d'abord l'historique avant de relancer la requête | ADR-0024 |
| Titre + catégorie de conversation `chat_meta` | Actif | Tous (chat) | `app/api/chat-meta+api.ts`, défaut `gemini-2.5-flash` (provider google) | Génère uniquement titre/catégorie ; pas de conseil médical ; configurable panel admin | ADR-0024 |
| RAG HAS/ANSM MVP | Conservé, non branché sur le chat | Documentaire (réutilisation future) | `rag_sources`, `rag_chunks`, `match_rag_chunks`, `src/rag/retrieval.ts` | Sources publiques whitelistées, métadonnées validées ; plus injecté dans `/api/chat` depuis la refonte (ADR-0024) | ADR-0014, ADR-0024 |
| Embeddings RAG réels | Pipeline livré, peuplement à faire | Retrieval documentaire | `text-embedding-3-small`, `scripts/embeddings/ingest-corpus.mjs` | Zéro pseudo-embedding ; lexical-only si clé/réseau échoue ; EU residency/ZDR à activer avant prod | ADR-0014 |
| Vérification étudiant | Actif | Choix rôle étudiant | `profiles`, route `app/api/role+api.ts` | E-mail académique / statut serveur, anti-auto-promotion RLS | ADR-0011 |
| Vérification RPPS / ANS | Configurée côté décision, activation contrôlée | Professionnels de santé | API FHIR Annuaire Santé, statut `pending` tant que clé absente | RPPS = donnée personnelle publique ; pro routable mais features cliniques gelées | ADR-0007, ADR-0011 |
| Facturation Stripe | Actif web-first | Plans public + étudiant | `subscriptions`, `billing_events`, webhook Stripe | Paywall = volume/features uniquement ; ne gate jamais les sources | ADR-0012 |
| Quotas par feature | Décidé / à maintenir côté serveur | Chat, ECOS, exports, transcriptions | Tables de limites/compteurs techniques, entitlements serveur | Quota découplé des sources ; service_role only ; aucune auto-promotion client | ADR-0016 |
| Cas ECOS en base | Décidé / feature pédagogique | Étudiants vérifiés | Tables de cas/stations pédagogiques versionnées | Cas explicitement fictifs ; aucun patient réel ; séparation du chat médical | ADR-0017 |
| Corpus ECOS « Annales 2024 » + simulateur anti faux-positif (2026-07) | Actif | Étudiants vérifiés | 15 stations ORIGINALES et FICTIVES couvrant les SDD des annales ECOS 2024 (`data/ecos-cases.json`, migration `0037`) ; **les cas de démonstration antérieurs ont été retirés (migration `0038`) — le corpus ne contient que ces 15 stations** ; prompt serveur **`ecos_patient`** (`promptStore.ts`) appliqué en mode simulate par `app/api/ecos+api.ts` (les RÈGLES de comportement ne viennent plus du body client) | Cas rédigés de zéro — AUCUN contenu tiers copyrighté (les fiches La Martingale/Ellipses ne sont ni recopiées ni screenshotées) ; le simulateur ne répond QU'À ce qui est précisément demandé (une question = une information, jamais de déballage spontané d'éléments de la grille) → supprime les « faux positifs » ; iconographie/para-clinique (ECG, bilan, constantes) fournie en TEXTE seulement sur demande explicite, jamais interprétée par le patient | ADR-0017, ADR-0032 |
| Dashboard ECOS : historique des passages + notes (2026-07) | Actif | Étudiants vérifiés | Refonte de la phase sélection d'`app/(chat)/ecos.tsx` (stats globales, filtres recherche/thème/statut, cas groupés par thème avec meilleure/dernière note, historique consultable) ; modules purs `src/ecos/score.ts` (note « x/20 » extraite DÉTERMINISTIQUEMENT, null si introuvable — jamais inventée) + `src/ecos/dashboard.ts` (stats/filtres/groupes, test `tests/unit/ecos-dashboard.test.ts`) ; CRUD client `src/ecos/attemptsDb.ts` ; table `ecos_attempts` (migration `0035`) ; prompt `ecos_evaluate` impose « **Note : X/20** » | Donnée pédagogique (cas fictifs) ; transcription de simulation JAMAIS conservée (note + feedback seulement) ; passage IMMUABLE (aucun UPDATE) ; RLS own-row stricte (test `tests/rls/ecos-attempts.test.ts`) ; archivage best-effort (un échec d'insert ne bloque jamais l'évaluation) ; aucune nouvelle feature IA | ADR-0032 |
| Refonte design : shell applicatif + Vue d'ensemble (2026-07) | Actif | Tous les comptes connectés (desktop web : sidebar bleu nuit + top bar ; mobile : onglet Accueil) | `src/ui/shell/AppShell.tsx` (sidebar role-aware via `visibleFeatures`, fil d'Ariane, actif seulement web ≥ 1024 px + session), dashboard `app/(chat)/dashboard.tsx`, module pur `src/dashboard/overview.ts` (test `tests/unit/dashboard-overview.test.ts`), chips teintées `src/ui/featureChips.ts` + `tokens.colors.tints`, `tabBarFeatures(..., { reservedSlots })` (test mis à jour), post-login → `/(chat)/dashboard` ; uniformisation 2026-07 : hero du dashboard sur `HeroBackdrop` (grille + ECG animé), écrans Compte/Tarifs sans en-tête natif sous le shell, panel admin en en-tête clair + onglets à icônes (plus d'emojis), variables CSS des pages autonomes `public/{partiel,presentation,cv-builder,article}.html` alignées sur les tokens ; confort 2026-07 : sidebar repliable en rail d'icônes 72 px (bouton + Ctrl/Cmd+B, tooltip au survol, préférence localStorage), squelette anti-saut de layout à l'hydratation (indice `hadSession` auto-réparé), fil d'Ariane racine cliquable, menu « Outils » masqué sous le shell actif (gardé pour les invités), **colonne d'historique du chat masquable sur desktop/grand écran (bouton replier/déplier, préférence `medinfo:chatHistoryCollapsed` en localStorage) pour gagner de la place pendant la conversation**, dashboard : horloge vivante + cache mémoire 5 min par compte + activité récente qui rouvre LA conversation (`?conversation=` dans `chat.tsx`) | Pure couche d'ergonomie/design : RoleGate + autorisation serveur inchangés ; chiffres du dashboard exclusivement issus des données de l'utilisateur (chat/ECOS/plans) et du moteur déterministe de révision — jamais inventés, sections fail-soft ; invité → redirigé vers le chat ; aucune nouvelle feature IA, aucune migration | — (design, 05_DESIGN §6) |
| Pages marketing + header public (2026-06) | Actif | Tous (public) | `src/ui/LandingHeader.tsx` (logo, menu Chatbots rôle-aware, Blog/À propos/Contact/Tarifs, CTA), `app/(marketing)/` (`a-propos.tsx`, `contact.tsx`, `blog/`), groupe public dans `app/_layout.tsx` | Pages statiques sans données ; le menu Chatbots reflète `allowedChatbotsFor` (jamais l'unique barrière) ; liens en bleu vif `accentVivid` | ADR-0024 |
| Refonte SEO landing + pages publiques (2026-07) | Actif | Tous (public) | Module pur `src/seo/meta.ts` (titres/descriptions par page, canonical, JSON-LD Organization/WebSite/FAQPage/BlogPosting/Breadcrumb) + `src/seo/sitemap.ts` (XML pur), test `tests/unit/seo-meta.test.ts` ; `src/ui/SeoHead.tsx` (expo-router/head, web only, `noindex` sur auth/compte/admin) ; footer maillage interne `src/ui/SiteFooter.tsx` (liens `<a>` crawlables) ; `public/robots.txt` ; route `app/sitemap.xml+api.ts` (pages statiques + articles publiés via clé anon, fail-open statique) ; landing `app/index.tsx` : sections « Comment MedInfo AI répond » (workflow agentique ADR-0030 côté produit), « Une plateforme complète » (outils par audience depuis `APP_FEATURES`, visiteurs) et FAQ (miroir exact du JSON-LD FAQPage) | Aucune donnée de santé ni d'utilisateur (URLs publiques seulement) ; copy alignée sur la réalité produit (information générale, jamais un avis individuel, urgences 15/112) ; les liens footer vers les outils restent derrière RoleGate + autorisation serveur | — |
| Blog santé + génération d'articles IA | Actif | Lecture publique ; génération + édition admin | Table `blog_posts` (migration `0022_blog_posts.sql`, lecture publiée seule), `src/blog/posts.ts` + `src/blog/toc.ts` (sommaire cliquable, test `tests/unit/blog-toc.test.ts`), pages `app/(marketing)/blog/`, API `app/api/admin/blog+api.ts` (feature `blog_generate` ; actions `update`/`upload_image`, `GET ?id=` pour relire un brouillon), éditeur admin `src/ui/admin/BlogEditorModal.tsx` (aperçu fidèle avant publication, édition titre/chapeau/catégorie/contenu avant ET après publication, barre d'outils markdown, remplacement de la couverture par une vraie photo — upload PNG/JPEG/WebP ≤ 4 Mo ou URL https — et insertion d'images dans le corps, rendues par `MarkdownRenderer` `![légende](url)`), onglet Blog du panel admin | RLS lecture publiée uniquement + zéro écriture client (test `tests/rls/blog-posts.test.ts`, GRANTs `supabase/policies/blog_posts.sql`) ; articles = information générale avec disclaimer, brouillon par défaut, relecture brouillon via l'éditeur admin (la page publique ne voit pas les brouillons — c'était le bug « article introuvable »), publication manuelle admin ; image de couverture best-effort (OpenAI Images → bucket public `blog-covers`, setup `supabase/setup/blog_covers_bucket.sql` hors harness) | ADR-0024 |
| Agent éditorial hebdo du blog (2026-06, sous-agents 2026-07) | Actif | Publication automatique 1×/semaine (lecture publique) | Cron Vercel lundi 06:00 UTC (`vercel.json` crons) → `app/api/cron/weekly-blog+api.ts` → pipeline multi-agents `src/blog/weeklyAgent.ts` : sujet (`blog_topic`, web_search ON, anti-doublon sur les 40 derniers titres) → rédaction (`blog_generate`, logique partagée avec l'admin via `src/blog/serverGeneration.ts`) → **en parallèle** : vérification des faits/sources (`blog_fact_check`, web_search ON, rapport `parseFactCheckJson`) + relecture rédactionnelle (`blog_copyedit`, forme seulement) + illustrations best-effort (couverture + corps via `body_image_prompt`, insérée avant la 2e section par `insertBodyImage`) → relecture finale (`blog_review` : publish/revise/reject, reçoit le rapport du vérificateur) ; parseurs purs `src/blog/articleJson.ts` (test `tests/unit/blog-agent.test.ts`) | Sous-agents fail-open (leur échec ne bloque jamais le pipeline) ; relecture finale fail-closed : reject ou relecture inexploitable → l'article reste en brouillon pour arbitrage admin ; route protégée par `CRON_SECRET` (cron Vercel) ou token admin (`?force=1` pour tester) ; garde anti-doublon 6 jours via `blog_posts.source = 'weekly_agent'` (migration `0024_weekly_blog_agent.sql`, seeds sous-agents `0032`) ; RLS blog inchangée ; **requiert `CRON_SECRET` sur Vercel** | ADR-0025 |
| Analyse des partiels (medoutils) | Actif (v2, 2026-06) | Étudiants vérifiés | Page autonome `public/partiel.html` (servie statiquement par l'export web), embarquée en iframe par `app/(chat)/partiel.tsx` (RoleGate conservé) | Import .xlsx/.xls/.csv/.pdf (pdf.js) → stats par épreuve, quantiles, distributions interactives, radar, comparaison A/B, export PDF ; détection auto colonne identifiant + échelle /20 ou /100 (vote majoritaire) + virgules décimales FR + mentions ABS/DEF ; calcul 100% client (aucune donnée envoyée, sans IA) ; bloc « sauvegarde cloud » de la maquette retiré (exigerait table `analyses` + RLS + ADR, et passait des tokens en URL) ; ancien `src/lib/classement.ts` supprimé | ADR-0019 |
| Dashboard de révision étudiant (2026-06) | Actif | Étudiants vérifiés (et admins) | Écran natif `app/(chat)/revision.tsx` (RoleGate `revision`, autosave debouncé + date-pickers natifs `src/ui/revision/DateField(.web).tsx`) ; moteur DÉTERMINISTE pur `src/revision/engine/*` (workload/dates/riskScoring/planner/redistribution, modes lissé/charge-en-avance, tests `tests/unit/revision-planner.test.ts`) ; table unique `revision_plans` (plan complet en JSONB, migration `0027_student_revision.sql`) ; CRUD client RLS `src/revision/db/queries.ts`, validation pure `src/revision/db/plans.ts` (test `tests/unit/revision-plans.test.ts`) ; widgets `src/ui/revision/RevisionWidgets.tsx` ; **coup de pouce IA** `revision_plan_assist` (`/api/revision`, contexte serveur pur `src/revision/ai/revisionPrompt.ts`, test `tests/unit/revision-ai.test.ts`, migration `0028`) | Pédagogique uniquement (volumes de travail, planning) — jamais de symptôme/patient/santé ; chiffres jamais inventés (tout vient de l'utilisateur ou du moteur ; l'IA ne fait que des suggestions d'organisation, garde persona serveur étudiant/admin + disclosure IA) ; RLS own-row stricte (test `tests/rls/revision.test.ts`) ; jauge de risque vert/orange/rouge qui ne masque jamais l'irréalisme. Base de référentiels EDN = phase suivante (ADR séparé) | ADR-0027 |
| Visibilité des outils par rôle + menu d'outils | Actif | Tous (UI adaptée) | `src/ai/routing/featureVisibility.ts` (+ `tabBarFeatures()` : répartition barre/panneau), `src/ui/RoleGate.tsx`, `src/ui/ToolsMenu.tsx`, `src/ui/AppTabBar.tsx`, `app/(chat)/_layout.tsx` | Cloisonnement UI strict par persona ; barre du bas ≤ 4 entrées (outils prioritaires + panneau « Outils », lisibilité mobile 2026-07) ; menu déroulant rôle-aware ; jamais l'unique barrière (autorisation serveur conservée) | ADR-0018 |
| Dictée vocale (chat/ECOS) | Actif | Tous | `src/ui/DictationButton.tsx`, `/api/transcribe` mode `raw` | Voix → texte (Whisper) dans les saisies ; transcription brute ; le texte repasse par l'autorisation de la route cible (safe-box retirée du chat par ADR-0024) | ADR-0019 |
| Générateur de présentations (manuel + IA) | Actif | Étudiants + professionnels vérifiés (et admins) | Page autonome `public/presentation.html` (éditeur, aperçu, export PPTX Keynote-safe via pptxgenjs), embarquée en iframe par `app/(chat)/presentation.tsx` (RoleGate + token de session par postMessage) ; mode IA `app/api/presentation+api.ts`, prompt `presentation_generate` (`src/ai/prompts/promptStore.ts`), contexte serveur pur `src/ai/presentation/presentationPrompt.ts` (test `tests/unit/presentation-prompt.test.ts`), migration `0025` | Mode manuel 100% client (export PPTX dans le navigateur) ; mode IA = appel LLM (deck spec JSON régénéré à chaque tour), garde persona serveur étudiant/pro/admin (`serverPersona` + `isAdminUserId`, refus 403 sinon — jamais le body), rate-limit (compteur étudiant) ; le « médecin senior » n'invente jamais de référence ([à vérifier]) ; disclosure IA conservée | ADR-0018, ADR-0019 |
| Historique cloud des présentations (2026-06) | Actif | Étudiants + professionnels (propriétaire) | Table `presentation_decks` (migration `0026`), CRUD `app/api/presentations+api.ts` (client Supabase scopé au token → RLS), validation pure `src/presentation/decks.ts` (test `tests/unit/presentation-decks.test.ts`), autosave + panneau « Mes présentations » dans `public/presentation.html` | RLS own-row stricte (test `tests/rls/presentation-decks.test.ts`) ; conserve `deck` + `ai_history` (information médicale générale, jamais un dossier patient) ; autosave (debounce + tick + `pagehide` keepalive) anti-perte au changement de page ; un deck vierge n'est pas enregistré tant qu'il n'est pas édité | ADR-0026 |
| Module Rédaction d'article médical (2026-07) | Actif | Étudiants + professionnels vérifiés (et admins) | Page autonome `public/article.html` (éditeur par sections avec gabarits par type de document — article original IMRaD / abstract / cas clinique / revue / thèse —, conseils de rédaction par section, check-list qualité par type, compteurs caractères avec/hors espaces + mots par section et globaux avec limites éditables et jauges, bibliographie par DOI/PMID via CrossRef/Europe PMC + saisie manuelle, appels `[@id]` rendus `[1]` Vancouver (ordre d'apparition, renumérotation auto) ou `(Auteur, année)` APA, alertes appels orphelins/références non citées, aperçu assemblé, exports Word (.doc Times 12 double interligne)/Markdown/copie, autosave + panneau « Mes articles » — aucune librairie externe), embarquée en iframe par `app/(chat)/article.tsx` (RoleGate + token postMessage) ; aides IA `app/api/article+api.ts` (modes `assist`/`reduce`/`originality`) ; module pur `src/article/articleDocument.ts` (validation storage, comptage de référence, ordre des citations, formatage Vancouver/APA, contexte IA minimisé, parseur rapport d'originalité — test `tests/unit/article-document.test.ts`) ; CRUD cloud `app/api/article-docs+api.ts` ; table `article_documents` (migration `0033`) | Rédaction/compteurs/bibliographie/exports 100 % client et gratuits ; 3 features IA `article_assist`/`article_reduce`/`article_originality` (web_search ON pour la dernière) — l'IA n'invente JAMAIS fait, chiffre ni référence (`[référence à ajouter]`), les appels de citation sont préservés (rendu `[n]` avant envoi, ré-ancrage `[@id]` à l'application), texte proposé TOUJOURS appliqué explicitement par l'utilisateur (drawer Appliquer/Refuser), réduction re-comptée côté serveur (`withinLimit` déterministe, jamais sur parole de l'IA), contrôle d'originalité INDICATIF (disclaimer : ne remplace pas Compilatio/iThenticate ; parseur fail-closed) ; garde persona serveur étudiant/pro/admin (`resolveChatPersona`, refus 403) + rate-limit (compteur étudiant) ; minimisation (une section + plan, jamais les auteurs ni le manuscrit entier) ; références = métadonnées réelles CrossRef/Europe PMC ou saisie de l'auteur, jamais générées par IA (exemple embarqué explicitement fictif) ; RLS own-row stricte (test `tests/rls/article-documents.test.ts`) ; jamais de donnée identifiante de patient (rappel UI + item de check-list) | ADR-0031 |
| Module CV Builder (2026-06) | Actif | Étudiants + professionnels vérifiés (et admins) | Page autonome `public/cv-builder.html` (éditeur structuré, aperçu A4 live, gabarit médical 2 colonnes fidèle, export PDF généré côté client via html2canvas+jsPDF — plein cadre A4, sans en-tête/pied de page navigateur, bande latérale pleine hauteur —, import d'un CV existant, relecture IA, historique cloud), embarquée en iframe par `app/(chat)/cv-builder.tsx` (RoleGate + token de session par postMessage) ; relecture IA `app/api/cv+api.ts` (feature `cv_review`) ; import `app/api/cv-import+api.ts` (feature `cv_import`, texte extrait client par pdf.js/mammoth) ; CRUD cloud `app/api/cv-docs+api.ts` ; validation + minimisation + normalisation d'import pures `src/cv/cvDocument.ts` (test `tests/unit/cv-document.test.ts`) ; table `cv_documents` (migrations `0029`+`0030`) | Création/édition/aperçu/export PDF 100% client et gratuits ; relecture IA + import = jamais de réécriture/invention (le prompt n'invente aucun fait ni date ; import = structure fidèle du texte fourni) — garde persona serveur étudiant/pro/admin (`resolveChatPersona`, refus 403 sinon), rate-limit (compteur étudiant) ; minimisation RGPD `sanitizeCvForAi` (jamais la photo ni les coordonnées des référents par défaut) ; photo jamais importée ; RLS own-row stricte (test `tests/rls/cv-documents.test.ts`) ; un CV = donnée personnelle, jamais un dossier patient | ADR-0028 |
| Scores médicaux (calculateurs cliniques, 2026-07) | Actif | Étudiants + professionnels vérifiés (et admins) | Écran natif `app/(chat)/scores.tsx` (recherche + chips de catégories + fiche interactive : boutons de choix / saisies numériques → valeur + interprétation colorée par niveau de risque) ; moteur PUR `src/scores/` (`types.ts` fabriques `additiveScore`/`yesNo`/`bandFor`, catalogue `catalog/*` — cardio/thrombose/pneumo/urgences/néphro/hépato/neuro/**gériatrie**/anesthésie/général —, recherche par NOM **et** par FONCTION `search.ts`, test `tests/unit/scores.test.ts`) ; ~75 scores (CHA₂DS₂-VASc, CHADS₂, HAS-BLED, HEART, NYHA/Killip, QTc, Wells/Genève/PERC, PESI, CURB-65, qSOFA, SOFA/SIRS, STOP-BANG, Glasgow, NEWS2, CKD-EPI, Cockcroft, MELD/MELD-Na, Child-Pugh, Blatchford/Rockall, Alvarado, FIB-4, NIHSS, ABCD², Hunt&Hess, mRS, ICH, **gériatrie : G8, mini-GDS, GDS-15, MMSE, MoCA, ADL/IADL, MNA, CAM, Clinical Frailty, TUG, Braden, Charlson**, RCRI, Apfel, ASA, Mallampati, Aldrete, IMC, **Ganzoni (déficit en fer)**, AUDIT-C, Fagerström…) ; feature `scores` dans `featureVisibility.ts` (RoleGate) | Calcul 100 % CLIENT et DÉTERMINISTE (aucune IA, aucun réseau, aucune persistance, aucune migration) ; critères/seuils figés et couverts par tests (exactitude des points ET des formules) ; résultat marqué « incomplet » si champ requis manquant (jamais de valeur trompeuse) ; recherche par fonction pour retrouver un score dont on a oublié le nom ; disclaimer « aide à la décision, jamais un diagnostic » ; masquage UI jamais l'unique barrière (RoleGate persona étudiant/pro/admin) | — (outil client, cf. Analyse des partiels) |

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
| `0031_pubmed_agent.sql` | Sous-agent PubMed du chat pro : seed `ai_model_config` de la feature `pubmed_agent` (claude-sonnet-4-6, anthropic). Aucune table (synthèse renvoyée à l'orchestrateur, jamais archivée séparément) | Non (références bibliographiques) | Service role only (hérite du verrou 0011) | Délégation gpt-5.2 → Claude pour monter le connecteur MCP PubMed ; le POST admin fait un UPDATE, la ligne doit préexister ; ADR-0030 |
| `0032_blog_agent_subagents.sql` | Sous-agents qualité du pipeline hebdo du blog : seed `ai_model_config` des features `blog_fact_check` (web_search ON) et `blog_copyedit`. Aucune table | Non (articles d'information générale) | Service role only (hérite du verrou 0011) | Sous-agents fail-open ; `blog_review` reste la barrière fail-closed ; le POST admin fait un UPDATE, les lignes doivent préexister ; ADR-0025 (addendum 2026-07) |
| `0033_article_writer.sql` | Module Rédaction d'article : table own-row `article_documents` (`title`, `doc_type` original/abstract/case_report/review/thesis, `document` jsonb = métadonnées/sections/références/check-list) + seed `ai_model_config` des features `article_assist`, `article_reduce` et `article_originality` (web_search ON) | Non (manuscrit scientifique de son auteur ; jamais un dossier patient — rappel UI anonymat) | Own-row stricte (CRUD propriétaire via client scopé au token, route `/api/article-docs`) ; seeds service role only (hérite du verrou 0011) | Test `tests/rls/article-documents.test.ts` ; le POST admin fait un UPDATE, les lignes doivent préexister ; ADR-0031 |
| `0034_chat_step_metrics.sql` | Instrumentation latence du chat : colonnes `steps` (int, nombre d'étapes LLM de la boucle agentique) + `tool_calls` (jsonb, décompte d'appels par NOM d'outil) sur `ai_interactions` | Non (noms d'outils seulement — jamais leurs arguments ni aucun contenu de message) | Service role only (hérite du verrou 0002 : RLS sans policy) | Diagnostic de la balance rapidité/qualité (où part le temps : sous-agent PubMed, lectures séquentielles, rédaction) ; renseignées par `/api/chat` via `src/ai/logging/stepMetrics.ts` (pur, testé) ; appliquée sur le projet via MCP le 2026-07-08 |
| `0036_qcm_generate.sql` | Section QCM du chatbot étudiant : seed `ai_model_config` de la feature `qcm_generate` (claude-sonnet-4-6, anthropic). Aucune table (génération à la demande, notation déterministe côté client) | Non (QCM d'entraînement sur connaissances générales) | Service role only (hérite du verrou 0011) | Le POST admin fait un UPDATE, la ligne doit préexister ; appliquée via MCP le 2026-07-15 ; ADR-0024 |
| `0037_ecos_cases_annales_2024.sql` | Corpus ECOS « Annales 2024 » : insert idempotent de 15 stations ECOS FICTIVES (couvrant les SDD des annales 2024) dans `ecos_cases` | Non (cas pédagogiques fictifs, aucun contenu tiers copyrighté) | Lecture cas publiés (RLS 0013 inchangée) ; écriture service_role | Miroir de `data/ecos-cases.json` ; ON CONFLICT (slug) DO UPDATE ; appliquée via MCP le 2026-07-15 ; ADR-0017 |
| `0038_ecos_cases_cleanup_legacy.sql` | Nettoyage ECOS : DELETE idempotent des 17 cas de démonstration antérieurs (placeholder 0013 + corpus de démo) pour ne garder que les 15 stations « Annales 2024 » (0037) | Non (cas fictifs) | Écriture service_role ; RLS 0013 inchangée | Les passages `ecos_attempts` référencent le slug en texte (pas de FK) → historique des notes conservé ; appliquée via MCP le 2026-07-15 ; décision Hugo |
| `0035_ecos_attempts.sql` | Dashboard ECOS : table `ecos_attempts` (`case_slug`, `case_title`, `specialty`, `score` numeric CHECK 0–20 nullable, `evaluation` markdown) — historique des passages avec note | Non (entraînement sur cas FICTIFS ; la transcription de la simulation n'est jamais conservée) | Own-row stricte select/insert/delete (client anon → RLS) ; passage IMMUABLE : aucun UPDATE (ni policy ni grant) | Test `tests/rls/ecos-attempts.test.ts` ; note extraite du markdown par `src/ecos/score.ts` (null si introuvable, jamais inventée) ; appliquée sur le projet via MCP le 2026-07-08 ; ADR-0032 |
| `0039_ai_interactions_conversation.sql` | Coût par conversation : colonne `conversation_id` (uuid, nullable) sur `ai_interactions` pour rattacher les tokens du chat à leur conversation (onglet Coûts admin) | Non (identifiant de conversation + compteurs de tokens seulement — jamais de contenu ni de titre) | Service role only (hérite du verrou 0002 : RLS sans policy) | NULL hors chat / anonyme ; renseignée par `/api/chat` ; nourrit `groupConversationUsage`/`aggregateConversationCosts` (`src/admin/cost.ts`, testé) ; appliquée via MCP le 2026-07-21 |
| `0040_ai_interactions_cached_tokens.sql` | Justesse des coûts (item K) : colonne `cached_tokens_in` (integer, nullable) sur `ai_interactions` — part de `tokens_in` lue depuis le cache du provider (facturée ~10 %), pour ne plus tarifer les tokens cachés au plein prix (l'onglet Coûts sur-estimait l'entrée) | Non (compteur de tokens seulement — jamais de contenu) | Service role only (hérite du verrou 0002 : RLS sans policy) | NULL si non renseigné ; renseignée par `/api/chat` (`usage.inputTokenDetails.cacheReadTokens`) ; tarifée via `CACHED_INPUT_DISCOUNT` dans `src/admin/cost.ts` (testé) ; appliquée via MCP le 2026-07-23 |
| `0041_chat_orchestrator_split.sql` | Split orchestrateur/rédacteur (audit 2026-07) : seed `ai_model_config` de la feature `chat_researcher` (gpt-5-mini, openai, web_search ON) — modèle bon marché qui rassemble un dossier de preuves ; la rédaction reste sur `chat` (gpt-5.2). Activé par le flag serveur `CHAT_ORCHESTRATOR_SPLIT` (OFF par défaut) | Non | Service role only (hérite du verrou 0011) | `on conflict do nothing` (le POST admin fait un UPDATE) ; phase 1 = `generateText`(mini)+outils dans `/api/chat`, phase 2 = `streamText`(gpt-5.2) sans outils depuis le dossier ; fail-open (recherche KO → repli mono-modèle) ; appliquée via MCP le 2026-07-23 |

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

Onglets : Modèles IA · Prompts · Cas ECOS · Blog · **Coûts** (2026-07). L'onglet Coûts
agrège `ai_interactions` (tokens réels) par feature/chatbot × modèle ET **par
conversation** sur 7/30/90 jours (`app/api/admin/costs+api.ts`, `requireAdmin` + service
role, ne lit que persona/modèle/`conversation_id`/compteurs de tokens — jamais de
contenu ni de titre). Grille de prix ÉDITABLE `src/admin/cost.ts` : prix EXACT pour les
modèles courants + repli PAR FAMILLE (mini/nano/pro/flash…) pour couvrir tous les
modèles configurables, module pur testé `tests/unit/admin-cost.test.ts`. Coût INDICATIF
(un modèle sans prix — ex. Whisper à la minute — est compté 0 $ et signalé).
**Justesse des coûts (audit 2026-07, item K)** : `costUsd` intègre désormais (1) la
**facturation par appel de recherche web** (`web_search`/`google_search`, lue depuis
`tool_calls` — le chatbot pro faisait ~3-4 recherches/réponse, auparavant non comptées →
sous-estimation) et (2) le **rabais des cached tokens** (`tokens_in` INCLUT les tokens
d'entrée lus depuis le cache du provider, facturés ~10 % — auparavant tarifés au plein
prix → sur-estimation) : la part cachée est loguée (`cached_tokens_in`, migration `0040`,
renseignée par `/api/chat` depuis `usage.inputTokenDetails.cacheReadTokens`) et tarifée à
`CACHED_INPUT_DISCOUNT`. Prix par appel web `WEB_SEARCH_PER_CALL_USD` et rabais ÉDITABLES.
**Instrumentation complète (2026-07)** : toutes les routes IA loguent via le helper
`src/ai/logging/logFeatureUsage.ts` — chat (+ `conversation_id`), chat_meta, sous-agent
PubMed, analyze, ECOS (simulate/evaluate), présentation, CV (review/import), article
(assist/reduce/originality), QCM, révision, audio (diarize/report). Reste non instrumenté :
le pipeline blog hebdo (faible fréquence). Migration `0039` (colonne `conversation_id`),
aucun appel LLM ajouté.

## Fonctionnalités IA actuelles

| Feature key | Route API | Modèle par défaut | Audience |
|-------------|-----------|-------------------|----------|
| `chat` | `/api/chat` | gpt-5.2 (web_search ON) | Tous — 3 chatbots (prompts `public`/`student`/`professional`) ; public → chat public seul, étudiant/pro vérifiés → les 3. En mode split : **rédacteur** (phase 2, écrit la réponse depuis le dossier de preuves) |
| `chat_researcher` | `/api/chat` (phase 1) | gpt-5-mini (web_search ON) | **Split orchestrateur/rédacteur** (flag `CHAT_ORCHESTRATOR_SPLIT`, OFF par défaut) : modèle bon marché qui porte la boucle d'outils et rassemble un dossier de preuves vérifié ; la rédaction clinique reste sur `chat` (gpt-5.2). ~-29 % de coût estimé. `src/ai/chat/split.ts` (pur, testé), migration `0041` |
| `chat_meta` | `/api/chat-meta` | gemini-2.5-flash | Tous (titre + catégorie d'une conversation) |
| `qcm_generate` | `/api/qcm` | claude-sonnet-4-6 | Étudiant + Professionnel (section QCM/QCS type EDN générée à la demande depuis le chat étudiant ; notation déterministe côté client) |
| `pubmed_agent` | `/api/chat` (sous-appel) | claude-sonnet-4-6 (anthropic only) | Professionnel — sous-agent PubMed délégué par l'orchestrateur quand le modèle du chat n'est pas Claude (connecteur MCP `pubmed.mcp.claude.com`) |
| `analyze` | `/api/analyze` | claude-sonnet-4-6 | Grand public — texte collé, PDF ou photo ; modes analyse (`analyze`) et traduction (`analyze_translate`) |
| `ecos_simulate` | `/api/ecos` | claude-sonnet-4-6 | Étudiant |
| `ecos_evaluate` | `/api/ecos` | claude-sonnet-4-6 | Étudiant |
| `audio_diarize` | `/api/transcribe` | gpt-4o-mini | Professionnel |
| `audio_report` | `/api/transcribe` | gpt-4o-mini | Professionnel |
| `presentation_generate` | `/api/presentation` | claude-sonnet-4-6 | Étudiant + Professionnel (mode IA du générateur de présentations) |
| `revision_plan_assist` | `/api/revision` | claude-sonnet-4-6 | Étudiant (coup de pouce planning du dashboard de révision ; conseils d'organisation, jamais médical) |
| `cv_review` | `/api/cv` | claude-sonnet-4-6 | Étudiant + Professionnel (relecture du CV : suggestions à valider, jamais de réécriture auto) |
| `cv_import` | `/api/cv-import` | claude-sonnet-4-6 | Étudiant + Professionnel (import d'un CV existant PDF/Word : structure le texte extrait, n'invente rien) |
| `article_assist` | `/api/article` | claude-sonnet-4-6 | Étudiant + Professionnel (aide à la rédaction d'une section de manuscrit : améliorer/corriger/clarifier/transition/traduction/titres/structure — n'invente jamais fait/chiffre/référence) |
| `article_reduce` | `/api/article` | claude-sonnet-4-6 | Étudiant + Professionnel (réduction d'une section à la limite caractères/mots ; recompte serveur déterministe) |
| `article_originality` | `/api/article` | claude-sonnet-4-6 (web_search ON) | Étudiant + Professionnel (contrôle d'originalité indicatif : formulations trop proches de sources publiées ; ne remplace pas un anti-plagiat institutionnel) |
| `blog_generate` | `/api/admin/blog` | claude-sonnet-4-6 | Admin (articles publiés visibles de tous) ; aussi appelé par l'agent hebdo |
| `blog_topic` | `/api/cron/weekly-blog` | claude-sonnet-4-6 (web_search ON) | Cron hebdo (choix du sujet de la semaine) |
| `blog_fact_check` | `/api/cron/weekly-blog` | claude-sonnet-4-6 (web_search ON) | Cron hebdo (sous-agent : vérification des faits, chiffres et sources de l'article ; fail-open) |
| `blog_copyedit` | `/api/cron/weekly-blog` | claude-sonnet-4-6 | Cron hebdo (sous-agent : relecture rédactionnelle, forme uniquement ; fail-open) |
| `blog_review` | `/api/cron/weekly-blog` | claude-sonnet-4-6 | Cron hebdo (relecture finale publish/revise/reject avant publication, informée du rapport de vérification) |

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
> `src/ui/Reveal.tsx`). Titres de page en Source Serif 4 (`tokens.font.serif`), jamais en corps de
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
| Rédaction d'article | — | ✅ | ✅ | ✅ |
| Scores médicaux (calculateurs cliniques) | — | ✅ | ✅ | ✅ |

Application :
- Barre d'onglets custom `src/ui/AppTabBar.tsx` (refonte lisibilité mobile 2026-07) : au plus
  `TAB_BAR_MAX` (4) entrées — outils prioritaires du rôle (`tabBarFeatures()` dans
  `featureVisibility.ts`, module pur testé) + bouton « Outils » ouvrant un panneau bas
  (grille de cartes icône + description avec tous les outils du rôle, + Mon compte/Accueil/Admin).
  Un rôle dont tout tient en ≤ 4 onglets n'a pas de panneau ; le visiteur (chat seul) n'a
  plus de barre du tout. Onglet non autorisé toujours retiré via `href: null` dans
  `app/(chat)/_layout.tsx` (+ `<RoleGate>` en défense en profondeur).
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
