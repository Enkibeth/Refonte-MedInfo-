# ADR-0024 — Refonte chat 2026-06 : chat direct, 3 chatbots, prompts produit v3, historique IA

```yaml
status: Accepted
date: 2026-06-10
owner: Hugo Bettembourg (arbitrage produit)
supersedes: ADR-0023 (safe-box neutralisée par interrupteur) ; relâche temporairement la doctrine 01_REGULATION §4 / 04_CHATBOT §4
```

## Contexte

L'ADR-0023 avait neutralisé la safe-box du chat par interrupteur (`MEDINFO_GUARDRAILS`)
en conservant le code des couches 1 et 3. Même neutralisée, l'architecture
(orchestrateur, classifieur 2 étages, gate de streaming, RAG injecté, directives de
réponse) restait lourde à maintenir et inadaptée à la nouvelle vision produit :
Hugo a fourni **3 prompts produit complets** (un par audience) qui portent eux-mêmes
le comportement attendu (sources réelles vérifiables, formats structurés, ton).

Décision produit : repartir d'une **ébauche propre et fonctionnelle**, validée par
Hugo, avant de réintroduire les couches de sécurité par-dessus.

## Décision

1. **Chat direct.** `/api/chat` (`app/api/chat+api.ts`) devient un appel LLM direct :
   plus de classifieur pré-LLM, plus de guardrails/validation de sortie, plus de RAG
   injecté, plus de rate-limit sur le chat. Modèle par défaut : `gpt-5.2` (openai)
   avec `web_search` ON (migration `0021_ai_model_config_refonte.sql`) — les prompts
   v3 exigent des sources réelles vérifiables (HAS/ESC/PubMed…).
2. **3 chatbots = 3 prompts produit.** `src/ai/prompts/public.v3.ts`, `student.v3.ts`,
   `professional.v2.ts` (clés promptStore `public` / `student` / `professional`,
   éditables via panel admin, table `ai_prompts`). Le client choisit son chatbot
   (`body.chatbot`) ; côté serveur, `allowedChatbotsFor(persona vérifiée)` :
   public → chat public seulement ; étudiant/professionnel (et admins) → les 3 chats.
   Contexte profil (prénom/âge/sexe) injecté via `src/ai/chat/chatContext.ts`.
3. **Modules supprimés** (et non plus seulement désactivés, contrairement à ADR-0023) :
   `src/ai/orchestrator.ts`, `src/ai/classifier/*`, `src/ai/guardrails/*`,
   `src/ai/skills/*`, `src/ai/ui/*`, `src/ai/chat/responseDirectives.ts`,
   `generationSettings.ts`, anciens prompts v1/v2, tests
   classifier/guardrails/prompt-regression, `scripts/eval/classifier-goldenset.mjs`,
   `validate-prompts.mjs`. `src/ai/rateLimit/` est conservé (utilisé par
   `/api/analyze` et `/api/ecos` uniquement). Scripts package.json
   `test:prompt-regression` / `validate:prompts` / `eval:classifier` supprimés ;
   `compliance` = `compliance:grep` + `test:rls` + `validate:rag`.
4. **Rendu interactif des réponses.** Parseur `src/ai/chat/parseAssistantMessage.ts`
   (formats SOURCES `SRCn::`, badges OFFICIEL/GUIDELINE/ÉTUDE/RCP, APPROFONDISSEMENTS,
   QUESTIONS_PATIENT, INTERACTION, AUTO-RÉFLEXION, `<!--CALC:…-->`, `[1]+[2]+[3]`
   étudiant) + rendu `src/ui/chat/AssistantBlocks.tsx` ; switch de chatbot
   `src/ui/chat/ChatbotSwitcher.tsx`.
5. **Historique des conversations + IA de métadonnées.** Tables `chat_conversations`
   et `chat_messages` (migration `0020_chat_history.sql`, RLS own-row stricte, test
   `tests/rls/chat-history.test.ts`) ; client `src/chat/history.ts`, panneau
   `src/ui/chat/HistoryPanel.tsx` ; export PDF `src/chat/exportChatPdf.ts`.
   Nouvelle feature IA `chat_meta` (`app/api/chat-meta+api.ts`) : titre + catégorie
   d'une conversation, défaut `gemini-2.5-flash` (provider google ajouté à
   featureModel/featureRuntime).
6. **UI.** Plus d'emojis dans la navigation (icônes ligne) ; accueil rôle-aware
   (étudiant/pro voient les 3 chats + leurs outils ; le public voit son chat).

Ce qui est **conservé** :
- La **disclosure passive** AI Act (information, pas barrière bloquante).
- L'autorisation **persona côté serveur** (`serverPersona.ts`) — le body ne donne
  jamais de droits.
- Le rate-limit sur `/api/analyze` et `/api/ecos`.
- Le corpus et le retrieval RAG (`src/rag/retrieval.ts`, tables `rag_*`) — non
  branchés sur le chat, réutilisables lors de la réintroduction de la sécurité.

## Conséquences

- ⚠️ Régression de sûreté **assumée et temporaire** : le chat peut répondre à des
  messages que la safe-box aurait refusés (y compris formulations personnelles).
  Choix produit explicite (arbitrage Hugo), pas un bug.
- La règle CLAUDE.md #2 (« ne jamais dégrader la safe-box ») reste **relâchée**, par
  cet ADR (qui remplace ADR-0023). L'interrupteur `MEDINFO_GUARDRAILS` n'existe plus :
  la réintroduction de la sécurité passera par du **nouveau code**, pas par un flag.
- L'historique du chat persiste du contenu potentiellement sensible (questions de
  santé) : RLS own-row stricte obligatoire, testée dans `tests/rls/`.
- Les docs `04_CHATBOT.md` et `07_CLASSIFIER.md` décrivent l'architecture
  pré-refonte ; elles restent comme référence pour la réintroduction de la sécurité.

## Suivi (sécurité à réintroduire après validation de l'ébauche par Hugo)

1. Validation de l'ébauche produit par Hugo (3 chatbots, formats v3, historique).
2. Conception d'une nouvelle couche de sécurité adaptée au chat direct (sans
   sur-refus) : garde d'entrée légère, validation de sortie ciblée, ré-ancrage
   sources (RAG ou web search vérifié).
3. Réintroduction progressive + tests de refus, puis clôture de cet ADR et
   rétablissement de la règle CLAUDE.md #2.
