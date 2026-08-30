# ADR-0037 — Retour à la base du chat : un prompt, un appel, la réponse

```yaml
status: Accepted
date: 2026-08-30
owner: Hugo Bettembourg
linked_to: [ADR-0024, ADR-0030, ADR-0033, ADR-0034, 01_REGULATION, 03_SECURITY §6]
supersedes_note: "Retire le pipeline agentique d'ADR-0030 (outils serveur Europe PMC / ClinicalTrials.gov / plan_research / verify_source_links, sous-agent PubMed, split orchestrateur/rédacteur, timeline « Étapes ») et le mode Rapide à second modèle. Les prompts produit des 3 chatbots, l'autorisation persona serveur, l'essai invité, la pièce jointe (ADR-0034) et le renfort pharmacologie (ADR-0033) sont CONSERVÉS."
```

## Contexte

Décision Hugo, 2026-08-30 : « on a trop complexifié le chatbot, revenons à la base — GPT-5.6
Luna, 1 prompt par catégorie puis génération de la réponse avec les questions, liens, etc.,
mais plus toutes ces étapes rendant la réponse longue +++ ».

Le chat avait accumulé, couche après couche, un pipeline agentique complet :

1. **Split orchestrateur/rédacteur** (ADR-0041/0044) — un premier appel LLM rassemblait un
   « dossier de preuves », un second le rédigeait. Deux modèles en série pour une réponse.
2. **Boucle agentique multi-étapes** (ADR-0030) — jusqu'à 5 étapes en mode standard, 8 en
   approfondi, chaque étape étant un appel LLM complet.
3. **Outils serveur déterministes** — `europe_pmc_search`, `europe_pmc_article`,
   `clinical_trials_search`, `plan_research`, `verify_source_links`, plus un **sous-agent
   PubMed** (un appel LLM Claude supplémentaire délégué par l'orchestrateur).
4. **Timeline « Étapes »** — data parts streamées pour rendre l'attente visible.

Chaque couche visait la qualité des sources. Aucune n'était gratuite : l'instrumentation de
prod (`ai_interactions.steps`, migration 0034) a montré une **latence linéaire dans le nombre
d'étapes, de l'ordre de 15-18 s par étape**. La couche 4 est révélatrice : on avait fini par
construire une interface pour rendre l'attente supportable, plutôt que par supprimer l'attente.

Deux incidents ont montré que la complexité produisait ses propres pannes : le plafond
d'étapes pouvait couper le modèle **avant qu'il n'écrive un mot** (flux HTTP 200 sans texte,
rien d'archivé — « rien n'est généré »), ce qui a demandé une garde `forceFinalAnswerStep` ;
et le mode « Rapide » enchaînait deux modèles, ce qui en faisait le chemin le plus lent.

## Décision

**Un prompt par catégorie, un appel LLM, la réponse.**

```
requête ──▶ prompt du chatbot (public / student / professional)
             + contexte utilisateur + pays + pharmaco + mode + outils de sortie
        ──▶ UN streamText (gpt-5.6-luna, recherche web du provider)
        ──▶ la réponse, avec ses SOURCES, APPROFONDISSEMENTS, QUESTIONS_PATIENT…
```

### Retiré

| Élément | Fichiers supprimés | Configuration |
|---|---|---|
| Split orchestrateur/rédacteur | `src/ai/chat/split.ts` | feature + prompt `chat_researcher` |
| Outils serveur du chat | `src/ai/chat/tools/` (7 fichiers) | — (aucune ligne de config) |
| Sous-agent PubMed | `src/ai/chat/tools/pubmed.ts` | feature + prompt `pubmed_agent` |
| Timeline « Étapes » | `src/ai/chat/researchTimeline.ts`, `src/ui/chat/ResearchTimeline.tsx` | — |
| Mode Rapide à second modèle | — | feature `chat_fast` |
| Boucle agentique | `stopWhen`/`stepCountIs`, `forceFinalAnswerStep`, `maxSteps` | — |

Les kill-switches devenus sans objet (`CHAT_ORCHESTRATOR_SPLIT`, `PUBMED_MCP_URL`) ne sont
plus lus. La migration `0045` bascule `chat` sur `gpt-5.6-luna` et supprime les trois lignes
de configuration devenues orphelines.

### Conservé

- Les **3 prompts produit** (`public.v3`, `student.v4`, `professional.v2`) — inchangés, et
  toujours éditables depuis le panel admin.
- La **recherche web du provider** (voir « Conséquences » : c'est ce qui tient les liens).
- L'**autorisation persona serveur** (`allowedChatbotsFor`), l'**essai invité** (1 message),
  la **pièce jointe** (ADR-0034), le **renfort pharmacologie** (ADR-0033), le **contexte pays**,
  les **outils de sortie** (diagramme / points clés / tableau) et les **3 modes de réponse**.
- L'**archivage serveur** + `keepAlive` (résilience hors-ligne) et l'**instrumentation des
  coûts** (`ai_interactions`, dont `tool_calls` qui facture les recherches web).
- Le **parseur de blocs** et tout le rendu client : la réponse garde ses SOURCES cliquables,
  ses APPROFONDISSEMENTS à cocher, ses QUESTIONS_PATIENT, ses diagrammes.

### Modèle

`chat` passe sur **gpt-5.6-luna** (0,20 $ / 1 M tokens d'entrée, 1,20 $ / 1 M en sortie —
contre 1,25 $ / 10 $ pour gpt-5.2), le tier le plus rapide de la famille GPT-5.6. Capacités
vérifiées contre l'API Responses : `temperature` REFUSÉE (capability à `false`, et remise à
`null` en base par 0045), `text.verbosity` acceptée, effort de raisonnement `minimal`
REMPLACÉ par `none` (traduction au bord dans `openaiReasoningEffort`).

Les 3 modes de réponse empruntent désormais le même chemin : `fast` coupe la recherche web,
`standard` applique la config admin, `deep` monte l'effort (public plafonné à `medium`).

## Conséquences

**Ce qu'on gagne.** Une réponse = un aller-retour. La latence ne dépend plus du nombre
d'étapes ni de la disponibilité de quatre API tierces (Europe PMC, ClinicalTrials.gov, PubMed
MCP, vérification HEAD/GET des liens). Le coût par réponse baisse d'un facteur important
(un seul appel, sur le tier le moins cher). Trois classes de pannes disparaissent avec le code
qui les portait : réponse vide par plafond d'étapes atteint, repli mono-modèle silencieux à
double coût, et blocage sur une API tierce lente.

**Ce qu'on perd, explicitement.** C'est le point à surveiller, et il concerne la qualité des
sources :

- Les **métadonnées d'études réelles** (journal, type de publication, nombre de citations,
  PMID/DOI issus d'Europe PMC) ne sont plus affichées dans les fiches sources : elles venaient
  d'un appel REST déterministe qui n'existe plus. La modale de source n'affiche donc plus que
  ce que le parseur extrait de la réponse — jamais un enrichissement fabriqué côté client.
- La **vérification HEAD/GET des liens avant rédaction** disparaît : un lien mort redevient
  possible dans la section SOURCES. C'était la garantie « zéro lien mort » d'ADR-0030.
- Le **chatbot professionnel perd l'accès direct à PubMed** (connecteur MCP / sous-agent) et
  aux **NCT réels de ClinicalTrials.gov**.

La fiabilité des sources repose maintenant sur deux choses : la recherche web du provider, et
les exigences des prompts produit eux-mêmes (ne citer qu'une source réellement consultée, avec
son URL exacte ; ne jamais reconstruire une URL de mémoire). C'est un cran en dessous d'une
vérification déterministe, et c'est un arbitrage assumé : le produit était devenu trop lent
pour être utilisé.

**Ce que ça ne change pas.** Aucune couche de RÉGULATION n'est retirée : le workflow
evidence-first était une couche de QUALITÉ, pas de conformité (ADR-0030 le disait déjà). La
disclosure AI Act, l'autorisation persona serveur, le cloisonnement des chatbots, le
non-stockage des pièces jointes et les règles RLS sont inchangés. Le bandeau ADR-0024 (chat
direct sans safe-box, sécurité à réintroduire après validation) reste en vigueur.

## Suivi

- Surveiller sur quelques jours, dans l'onglet Coûts : latence moyenne, `steps` (doit être 1)
  et coût par conversation, pour confirmer le gain.
- Surveiller la qualité des liens produits par la seule recherche web (liens morts, sources
  génériques). Si le taux de liens invalides est visible en usage réel, la réintroduction
  ciblée d'une **vérification de liens** — un appel REST, pas une étape LLM — est le premier
  candidat au retour, avant tout le reste.
- Le corpus RAG HAS/ANSM (ADR-0014, conservé non branché) reste la piste de fond pour ancrer
  les sources sans multiplier les appels LLM.
