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

- Les **3 prompts produit** (`public.v3`, `student.v4`, `professional.v2`) — conservés dans
  leur intention et leur structure, toujours éditables depuis le panel admin ; deux d'entre
  eux sont retouchés là où ils décrivaient l'ancienne architecture (voir « Révision des
  prompts » ci-dessous).
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

### Révision des prompts (même livraison)

Retirer les outils imposait de relire les trois prompts produit : un modèle à qui l'on
prescrit un outil absent ne se contente pas de l'ignorer, il s'invente une conformité.

- **`student.v4`** — quatre mentions d'outils disparus (« tes outils de recherche
  documentaire », « vérifie les liens avec ton outil ») remplacées par la recherche web.
  La **garde anti-lien-mort** du prompt public y est reprise (formats stables DOI/PubMed,
  repli `scholar.google.com/scholar?q=…` quand le lien exact n'est pas connu) : c'est ce
  qui remplace `verify_source_links` — le modèle ne peut pas tester un lien, donc il ne
  doit écrire que des liens dont il est certain, ou un repli toujours fonctionnel.
- **`public.v3`** — deux incohérences internes corrigées, sans toucher au fond clinique :
  (1) « minimum 2 tours de QUESTIONS_PATIENT » contredisait « maximum 1 bloc » du mode
  Symptôme ; tranché à **un tour par défaut, un second seulement si une donnée
  déterminante manque** — cohérent avec l'objectif de rapidité, et deux allers-retours de
  formulaire avant la moindre réponse étaient de toute façon coûteux pour l'utilisateur ;
  (2) l'exigence « minimum 4 sources » pouvait pousser à combler la liste : il est
  désormais écrit que **le minimum est un objectif, jamais un quota** — citer trois
  sources vaut mieux qu'en inventer une quatrième.
- **`professional.v2`** — aucune correction nécessaire : il ne référençait aucun outil et
  portait déjà sa propre politique de liens (« ne jamais inventer un lien », URL stable de
  l'organisme ou PubMed certain).

### Seconde passe sur les prompts : les règles GPT-5.6

Le [guide de prompting GPT-5.6](https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6)
(9 juillet 2026) est explicite sur un point qui nous concerne directement : « GPT-5-class
models follow prompt contracts closely, so conflicting rules can create more instability than
missing detail. » La chasse aux contradictions est donc la modification la plus rentable, avant
toute réécriture stylistique. Il demande aussi de **garder** les critères de succès et les
conditions d'arrêt, les contraintes de preuve et la forme de sortie — ce que nos prompts
avaient en partie, sans jamais dire quand s'arrêter.

- **Contradictions levées** : `public.v3` — « minimum 2 tours de QUESTIONS_PATIENT » contre
  « maximum 1 bloc » du mode Symptôme, et le quota de 4 sources requalifié en objectif ;
  `professional.v2` — `AUTO-REFLEXION` imposait « 5 lignes maximum » puis listait **neuf**
  items, contrat impossible à tenir : les items sont priorisés et conditionnés, et le « score
  de complétude en pourcentage » (un chiffre que rien n'ancre) cède la place à ce qui manque,
  nommé explicitement.
- **Conditions d'arrêt** ajoutées aux trois prompts, dans la formulation du guide : résoudre
  avec le minimum de recherches utiles, *sans* laisser cette économie primer sur l'exactitude
  ou les citations ; ne pas relancer une recherche pour reformuler ; et un critère de fin
  explicite (« tu as terminé quand… n'ajoute rien après »).
- **Structure lisible** : `professional.v2` numérotait « 1. » quinze listes et titres
  différents (artefact de markdown) — le modèle reçoit ce texte littéralement. Renuméroté, y
  compris les gabarits de sortie qui poussaient à produire « 1. / 1. / 1. ».

Ce qui n'a **pas** été touché : le fond clinique des trois prompts, leur intention pédagogique
et leurs formats de sortie, qui sont le contrat avec le parseur client.

### `searchContextSize` : 'low' → 'medium'

L'audit latence de juillet avait bridé le contenu web injecté à `low` parce que la boucle
enchaînait 3 à 5 recherches par réponse. Il n'y en a plus qu'une, et la recherche web est
devenue la SEULE source du chat : `medium` redonne au modèle de quoi citer des sources
réelles plutôt que de combler avec des liens devinés. Le surcoût est marginal sur
gpt-5.6-luna (0,20 $ / 1 M tokens d'entrée).

### Indicateur de progression : l'anneau remplace la timeline

La timeline « Étapes » retirée laissait l'attente nue. Elle est remplacée par un anneau de
progression (`src/ui/chat/ChatStatusRing`) qui matérialise les trois moments réellement
perçus : **raisonnement → recherche sur Internet → rédaction**. Le modèle des phases est un
module PUR testé (`src/ai/chat/statusPhases.ts`) : libellé, icône, fraction de l'anneau, et
surtout une progression **monotone** — le flux peut réordonner ses signaux, mais un anneau
qui recule se lit comme un bug.

Deux implémentations, selon le pattern maison (`icons.web.tsx`, `CountryFlag.web.tsx`) : sur
le **web**, un SVG inline `stroke-dasharray` donne un arc exact qui se remplit ; en **natif**,
faute de `react-native-svg`, un arc de longueur arbitraire demanderait deux demi-disques
masqués et pivotés — géométrie fragile et invérifiable sans appareil — on s'en tient à un
anneau dont un quart tourne, l'évolution restant portée par l'icône, le libellé et les trois
pastilles. L'anneau ne se referme jamais pendant l'attente : un cercle complet dirait
« terminé » alors que la réponse s'écrit encore. Mouvement coupé sous `prefers-reduced-motion`.

### Quitter Safari sans perdre la réponse

Le chemin serveur était déjà bon et a été vérifié plutôt que supposé : `onFinish` est appelé
dans un `flush` que le SDK **attend** avant de fermer le stream, donc
`keepAlive(result.consumeStream())` couvre bien l'archivage ; `teeStream()` fait un vrai
`.tee()`, donc la déconnexion du client n'interrompt pas la branche drainée côté serveur ; et
le serveur Node n'impose pas de durée maximale à la requête.

Le trou était côté client. La reprise existante ne se déclenche que si une réponse est encore
attendue — or iOS peut couper le flux **sans erreur** : `useChat` repasse en « prêt » avec une
réponse tronquée à l'écran, et plus rien ne va chercher la version complète. L'utilisateur
reste devant un texte coupé au milieu d'une phrase, sans le moindre signal.

Ajout d'une **resynchronisation silencieuse** : quand l'app passe en arrière-plan pendant une
génération, on le note ; au retour, on compare la dernière réponse affichée à celle archivée
par le serveur et on la remplace si l'archive est manifestement la même réponse en plus
complet. La règle vit dans un module pur testé (`src/chat/resume.ts`) et se garde d'un piège :
comparer les seules longueurs ferait écraser une régénération courte par l'archive, plus
longue, de la réponse précédente — d'où la comparaison de préfixe.

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

## Addendum 2026-09 — le chat passe sur GPT-6 Luna (migration 0046)

**Décision Hugo** (« je valide gpt 6 Luna ») : `chat` passe de gpt-5.6-luna à **gpt-6-luna**,
sans évaluation préalable. L'architecture de cet ADR est inchangée : un prompt par catégorie,
un appel LLM, la recherche web du provider.

- **Prix officiels** relus le 2026-09-26, en $ par million de tokens (entrée / entrée en cache /
  sortie) :
  - gpt-6-luna : 0,10 / 0,01 / 0,50 ;
  - gpt-5.6-luna : 0,20 / 0,02 / 1,20.
  - Recherche web : inchangée (10 $ les 1 000 appels). Au volume mesuré sur 30 jours, elle
    représente jusqu'aux trois quarts du coût d'une réponse.
- **Ce que le code doit faire pour GPT-6**, vérifié sur la requête HTTP réellement émise par le
  SDK (`tests/unit/llm-request-shape.test.ts`) :
  - pas de `minimal` dans GPT-6 : on traduit `minimal` → `none` pour Sol et Luna, ce qui garde
    le comportement du chat grand public, plafonné à `minimal` ;
  - le SDK installé (@ai-sdk/openai 3.0.67) ignore que GPT-6 est un modèle à raisonnement : sans
    `forceReasoning`, il jetait l'effort sans erreur et envoyait le prompt système en rôle
    `system` ;
  - température jamais envoyée (capability `false`).
- **Non documenté par OpenAI :** la prise en charge de `text.verbosity` par GPT-6. La version la
  plus récente du SDK (3.0.118), qui retire explicitement les paramètres refusés par GPT-6,
  transmet la verbosité telle quelle. Elle est donc gardée, et vérifiée en réel sur les 3 modes
  juste après la bascule.
- **Ordre de déploiement :** la config vit en base, partagée par tous les environnements. La
  migration 0046 ne s'applique qu'une fois ce code en ligne partout : tous les
  environnements qui lisent la table. Un runtime plus ancien traiterait gpt-6-luna comme un modèle inconnu, donc chat
  sans recherche web ni effort.
- **Qualité non évaluée** avant la bascule : OpenAI ne publie aucune donnée médicale sur GPT-6.
  À surveiller en usage réel, comme pour la 5.6 : exactitude, sources réelles, prudence.
  Retour arrière = une ligne dans le panel admin (modèle `gpt-5.6-luna`).
- **Constaté après la bascule (2026-09-27, 0046 appliquée après déploiement du code sur tous
  les environnements) :**
  - 13 réponses réelles sans erreur (10 sur la recette, 3 en production), toutes servies par
    `gpt-6-luna`.
  - La verbosité et les efforts `none`, `low` et `high` sont acceptés.
  - Le format produit est tenu : section SOURCES en `SRCn ::`.
  - Premier mot : 1 à 2,5 s en mode rapide, 4 à 8 s en classique, jusqu'à 19 à 24 s en
    approfondi pro.
  - Coût dominé par la recherche web.
  - Détail : CHANGELOG_AI, addendum du 2026-09-27.

## Addendum 2026-10 — réponses vides en mode Approfondi, coupures au-delà d'une minute

**Signalement Hugo (2026-10-01, captures iPhone)** : avec la réflexion avancée, une image jointe
semble « invisible » pour le modèle, et une réponse qui dépasse la minute « coupe » sans rien
produire.

**Constat en production** (`ai_interactions` + `chat_messages`, métadonnées seulement) :

- 6 des 12 derniers appels du chatbot Pro arrêtés à **exactement 4 096 tokens de sortie** — le
  `maxOutputTokens` du mode Approfondi — et **aucune réponse archivée** pour 4 d'entre eux. Les
  deux captures correspondent à deux de ces appels (20:37:56 et 20:55:42, heure de Paris).
- L'image était bien transmise au premier envoi. C'est la réponse qui était vide : la
  réflexion `high` et les recherches web consommaient tout le budget, réponse comprise
  (`max_output_tokens` les compte ensemble chez OpenAI). L'écran restait muet : `MessageRow`
  n'affiche rien pour un message sans texte, sans erreur ni bouton. L'utilisateur envoyait
  alors « ? », et le document, qui n'accompagnait que le premier envoi, n'était plus transmis :
  « je ne vois pas le contenu de IMG_0847.png ».
- Les tokens d'entrée passaient de 46 000 à 228 000 en neuf tours d'une même conversation.
  Le SDK rejouait la réflexion et les recherches web de chaque tour précédent en
  `item_reference` (option `store` d'OpenAI).

**Décisions** (aucune couche de régulation touchée, aucun appel LLM ajouté, aucune migration) :

1. **Budget de sortie = réponse visible + réserve de réflexion**
   (`REASONING_OUTPUT_RESERVE`, `featureRuntime.ts`).
   - Réserve par effort, sur OpenAI et Claude en réflexion adaptative : `low` 4 096,
     `medium` 12 288, `high` 28 672.
   - Mode Approfondi Pro : 32 768 tokens au total. OpenAI recommande au moins 25 000 ; le
     plafond de gpt-6-luna est de 128 000 (fiche modèle).
   - Mode Rapide inchangé (pas de réflexion), Classique inchangé (aucun plafond posé).
2. **Historique transmis au modèle : texte seul** (`src/ai/chat/modelHistory.ts`).
   - Plus de réflexion ni de recherches web des tours précédents.
   - Le modèle relance une recherche si un tour l'exige.
   - Effets voulus : un rôle `system` ou une part `file` fournis par le client n'atteignent plus
     le modèle. La garde de la pièce jointe ne peut donc plus être contournée par cette voie.
3. **Battement de cœur SSE** (`src/server/sseHeartbeat.ts`).
   - Un commentaire `: keep-alive` part après 15 s de silence, ignoré par le parseur du client.
   - Il couvre la réflexion longue désormais possible face au délai d'inactivité, non
     documenté, du CDN et de LiteSpeed.
   - Mesuré à travers le vrai serveur Node : battements à 20 s puis à 35 s pendant 40 s de
     silence du fournisseur.
4. **Plus jamais d'écran muet** (`turnOutcome`, `src/chat/resume.ts`).
   - Réponse terminée sans texte : bandeau « La réponse n'a pas pu être rédigée » avec
     « Réessayer ».
   - Flux clos sans son fragment final : reprise depuis l'historique, puis le bandeau si rien
     n'arrive.
5. **« Réessayer » ne détruit plus la réponse du tour précédent.**
   - `replaceLast` ne supprime que si le dernier message archivé est une réponse.
   - Avant, réessayer un tour resté sans réponse effaçait la réponse du tour d'avant.

**Suivi** :

- Dans `ai_interactions`, plus aucun `tokens_out` égal à 4 096 en Approfondi ; surveiller ceux
  qui atteignent 32 768.
- Surveiller la chute des `tokens_in` sur les conversations longues.
- `/api/analyze` et `/api/ecos` diffusent du texte brut, sans battement possible sans changer
  leur protocole. Le risque est faible tant qu'ils commencent à écrire en moins d'une minute.
