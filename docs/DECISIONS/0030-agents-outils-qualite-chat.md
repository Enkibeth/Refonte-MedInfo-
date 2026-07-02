# ADR-0030 — Workflow agents du chat orienté qualité (outils Europe PMC, ClinicalTrials.gov, vérification des liens)

```yaml
status: Accepted
date: 2026-07-02
owner: Hugo Bettembourg
linked_to: [ADR-0024, ADR-0029]
```

> Numéroté 0030 pour ne pas entrer en collision avec l'ADR-0029 (« réintroduction
> sécurité pipeline gardé », PR #103, branche non fusionnée). Les deux chantiers sont
> **complémentaires et indépendants** : l'ADR-0029 réintroduit la régulation (garde
> d'entrée, rate-limit) ; le présent ADR ne touche QUE la qualité de réponse et l'UX.

## Contexte

Retour de Hugo après la première ébauche d'orchestrateur (PR #103) : la session
précédente s'est trop concentrée sur la **régulation** (garde d'entrée, refus,
rate-limit). Ce qu'il voulait explorer en priorité : un workflow avec agent
orchestrateur et **sous-agents qui améliorent la qualité de la réponse et
l'expérience utilisateur** — recherche documentaire réelle, vérification des liens,
etc. La trame d'une autre session identifiait déjà les pistes au meilleur rapport
valeur/effort : outil Europe PMC universel (fonctionne avec gpt-5.2 comme avec
Claude, contrairement au connecteur PubMed MCP réservé à l'API Anthropic) et outil
ClinicalTrials.gov pour le chatbot professionnel (« essais en cours » est une vraie
demande de médecins).

Problèmes de qualité constatés avec le chat direct (ADR-0024, web_search seule) :
- les références d'études ([ÉTUDE]) reposent uniquement sur la recherche web
  générique — métadonnées (auteurs, journal, année, DOI) parfois approximatives ;
- les URLs de la section SOURCES ne sont jamais vérifiées → liens morts possibles,
  alors que l'UI (modale « Accéder à la source ») en dépend directement ;
- aucune source structurée pour les essais cliniques en cours (chatbot pro).

## Décision

**Le modèle du chat devient l'orchestrateur d'une boucle agentique** (AI SDK,
`stopWhen: stepCountIs(8)`) qui délègue à des **outils serveur déterministes**
(les « sous-agents »), dans `src/ai/chat/tools/` :

1. **`europe_pmc_search`** (les 3 chatbots) — API REST publique Europe PMC
   (PubMed/MEDLINE + PMC, sans clé). Renvoie titre, auteurs, journal, année, type,
   DOI/PMID, URL stable, nombre de citations. Consigne : ne jamais citer une étude
   non retrouvée par cet outil ou la recherche web. Voie **universelle** : marche
   avec tous les providers (gpt-5.2 par défaut, Claude, Gemini) — le connecteur
   PubMed MCP d'Anthropic reste une amélioration possible quand le modèle configuré
   est Claude.
2. **`clinical_trials_search`** (chatbot professionnel uniquement) — API REST v2
   publique de ClinicalTrials.gov. Renvoie NCT, titre, statut de recrutement, phase,
   conditions, promoteur, URL officielle ; filtre « recrutement en cours » optionnel.
3. **`verify_source_links`** (les 3 chatbots) — vérifie que les URLs candidates de la
   section SOURCES répondent réellement (HEAD puis repli GET, redirections suivies,
   timeout 6 s, 8 URLs max, appel unique avant rédaction de SOURCES). Toute URL
   cassée doit être remplacée (DOI, page officielle de niveau supérieur) ou retirée.
   **Anti-SSRF** (`urlSafety.ts`) : URLs http(s) publiques nommées uniquement —
   jamais d'IP littérale, d'hôte interne/mono-label ni de credentials.

Principes :
- **Pas une couche de régulation** : aucun refus, aucun classifieur, aucun quota ici.
  Les prompts produit de Hugo (public.v3/student.v3/professional.v2) restent la
  source de vérité du comportement ; la section système ajoutée
  (`buildChatToolsSection`) explique seulement QUAND déléguer aux outils et ne change
  rien au format de réponse.
- **Aucune nouvelle feature IA admin** : les outils sont des appels REST déterministes
  exécutés au sein de la feature `chat` (aucun appel LLM supplémentaire, aucune
  migration). La convention en 6 points ne s'applique pas.
- **UX** : la bulle de statut du chat affiche l'activité réelle de l'agent
  (« Recherche dans la littérature scientifique… », « Recherche d'essais
  cliniques… », « Vérification des liens sources… ») via le nom de l'outil dans le
  stream.
- **Archivage multi-étapes** : en boucle agentique, `onFinish.text` ne contient que la
  dernière étape → l'archivage serveur concatène le texte de toutes les étapes
  (fidèle à ce que le client affiche).
- **Compatibilité Gemini** : Google n'accepte pas de mélanger `googleSearch` et des
  function tools ; si l'admin configure le chat sur un modèle Google avec web_search,
  la recherche web du provider est conservée et les outils custom désactivés.

## Alternatives écartées

- **Sous-agent LLM relecteur** (2ᵉ appel LLM qui critique/réécrit la réponse) :
  double coût et latence sur CHAQUE message streamé, gain incertain — écarté pour
  cette itération ; possible plus tard en non-bloquant.
- **Connecteur PubMed MCP (Anthropic)** : réservé aux modèles Claude alors que le
  chat tourne sur gpt-5.2 par défaut → Europe PMC d'abord, MCP en complément futur.
- **bioRxiv/medRxiv** : existe en connecteur, mais le prompt pro interdit les
  preprints — non branché par cohérence produit.

## Conséquences

- `app/api/chat+api.ts` : fusion outils provider (web_search) + outils qualité,
  boucle bornée à 8 étapes, archivage multi-étapes.
- `src/ai/chat/tools/` : logique pure (construction d'URL, formatage, verdicts,
  garde URL) séparée du réseau, testée dans `tests/unit/chat-tools.test.ts`
  (30 tests, fetch mocké — anti-SSRF vérifié : l'URL interne n'est jamais fetchée).
- Latence : la vérification des liens ajoute quelques secondes avant la section
  SOURCES d'une réponse substantielle ; jugé acceptable (la bulle de statut
  l'explique) et borné (timeout + appel unique).
- Les tests RLS ne sont pas concernés (aucune table/policy touchée).

## Suivi

- ✅ **Connecteur PubMed MCP** (2026-07-02) : `pubmedMcpServers()` dans
  `src/ai/chat/tools/index.ts` — serveur hébergé Anthropic
  `https://pubmed.mcp.claude.com/mcp` (sans auth), injecté via
  `providerOptions.anthropic.mcpServers` UNIQUEMENT quand le modèle configuré du chat
  est Claude ET pour le chatbot professionnel ; beta `mcp-client` ajoutée
  automatiquement par `@ai-sdk/anthropic` ; `PUBMED_MCP_URL=off` pour désactiver.
  Europe PMC reste la voie universelle (gpt-5.2 par défaut).
- ✅ **API Citations d'Anthropic pour `/api/analyze`** (2026-07-02) : quand le modèle de
  la feature `analyze` est Claude, les PDF et le texte collé deviennent des blocs
  `document` avec `citations: {enabled: true}` ; les passages cités (page du PDF ou
  extrait exact) sont sérialisés en pied de flux `<!--CITATIONS:…-->`
  (`src/document/citations.ts`, pur, testé), détachés par le client et rendus dans une
  section « Passages du document cités » ; le pied est archivé avec le résultat →
  l'historique ré-affiche la même section. Images non éligibles ; autres providers
  inchangés.
- ✅ **Candidature « AI for Science »** (2026-07-02) : dossier prêt à soumettre dans
  `docs/CANDIDATURE_AI_FOR_SCIENCE.md` (programme vérifié : ≤ 20 k$ de crédits / 6 mois,
  évaluation le 1er lundi du mois ; éligibilité = chercheur rattaché à une institution —
  angle recherche recommandé, affiliation à compléter par Hugo).
- Évaluer un vérificateur de sources non-bloquant post-réponse (PR3 de l'ADR-0029) en
  cohérence avec la réintroduction de la sécurité.
