# ADR-0025 — Agent éditorial hebdomadaire du blog (sujet → rédaction → relecture → publication)

```yaml
status: Accepted
date: 2026-06-13
owner: Hugo Bettembourg (demande produit)
extends: ADR-0024 (blog santé + génération d'articles IA)
```

## Contexte

Le blog santé (migration `0022_blog_posts.sql`, ADR-0024) repose sur une génération
manuelle depuis le panel admin : un admin déclenche `blog_generate`, relit le
brouillon dans l'éditeur, puis publie. Hugo souhaite **une publication automatique
par semaine, pour tous**, sans intervention manuelle : un agent choisit un sujet
médical intéressant, le transmet à un agent rédacteur, puis à un relecteur, et
l'article est publié sur le blog.

## Décision

1. **Pipeline en 3 étapes IA** (`src/blog/weeklyAgent.ts`), déclenché par un
   **cron Vercel hebdomadaire** (lundi 06:00 UTC, `vercel.json` → `crons`) sur la
   route `GET /api/cron/weekly-blog` :
   - **Choix du sujet** — feature `blog_topic` (web_search ON par défaut : actualité
     santé, saison). Reçoit les 40 derniers titres/catégories du blog pour éviter
     les doublons et varier les catégories. En cas de réponse inexploitable, le
     rédacteur choisit librement (comme la génération manuelle sans sujet).
   - **Rédaction** — feature `blog_generate`, **logique partagée** avec la
     génération manuelle admin (`src/blog/serverGeneration.ts` → `writeArticle()`),
     même prompt, même exigence de fond (information générale, jamais de conseil
     individuel, disclaimer final).
   - **Relecture** — feature `blog_review` : vérifie sécurité (pas de conseil
     individuel/posologie/diagnostic), exactitude (HAS/ANSM/OMS, pas de source
     inventée) et forme (structure `##`, disclaimer). Verdict :
     `publish` → publication immédiate ; `revise` → publication de la version
     corrigée renvoyée en entier ; `reject` (ou réponse inexploitable, ou `revise`
     sans article corrigé) → l'article reste en **brouillon** pour arbitrage humain
     dans le panel admin. **Fail-closed : on ne publie jamais sans relecture
     exploitable.**
2. **Auto-publication encadrée.** La publication « manuelle admin » (ADR-0024)
   reste la règle pour les articles créés depuis le panel ; l'agent hebdomadaire
   est la seule exception, gardée par le relecteur IA. Les admins gardent la main
   a posteriori : dépublication, édition et suppression inchangées dans l'onglet
   Blog du panel admin.
3. **Traçabilité + anti-doublon.** Migration `0024_weekly_blog_agent.sql` :
   colonne `blog_posts.source` (`'admin'` | `'weekly_agent'`, défaut `'admin'`).
   La route saute l'exécution si un article `weekly_agent` a été créé dans les
   6 derniers jours (re-déclenchements sans effet). RLS inchangée (lecture
   publique des publiés uniquement, zéro écriture client).
4. **Sécurité de la route.** `GET /api/cron/weekly-blog` accepte :
   le cron Vercel (`Authorization: Bearer ${CRON_SECRET}` — refusé si la variable
   n'est pas configurée, fail-closed) ; ou un token admin Supabase (`requireAdmin`)
   pour les tests manuels (`?force=1` saute la garde anti-doublon).
5. **Convention admin respectée** : `blog_topic` et `blog_review` sont déclarées
   dans `AI_FEATURES`, `FEATURE_DEFAULTS` (claude-sonnet-4-6, anthropic),
   `PROMPT_DEFAULTS` et seedées dans `ai_model_config` (migration 0024) —
   modèles, réglages et prompts modifiables depuis le panel admin.

## Conséquences

- Un article d'information générale est publié chaque semaine sans intervention,
  avec le même disclaimer et les mêmes exigences que la génération manuelle.
- Les articles rejetés par le relecteur apparaissent en brouillon dans le panel
  admin (l'onglet Blog existant suffit pour les arbitrer).
- `vercel.json` : `maxDuration: 300` sur la fonction API (3 appels LLM + image
  de couverture best-effort dépassent les 60 s par défaut).
- **Action requise (Vercel)** : définir `CRON_SECRET` dans les variables
  d'environnement du projet, sinon le déclenchement automatique est refusé.

## Suivi

- Si la qualité des publications automatiques déçoit, repasser `publish` →
  brouillon + notification admin (changer une ligne dans `weeklyAgent.ts`).
- Optionnel plus tard : stocker les notes du relecteur (colonne dédiée) et les
  afficher dans l'éditeur admin.

## Addendum 2026-07-04 — Sous-agents qualité (fact-check, relecture rédactionnelle, illustration du corps)

Le pipeline passe de 3 étapes séquentielles à un pipeline multi-agents : après la
rédaction, trois travaux s'exécutent EN PARALLÈLE (pas d'allongement notable de la
chaîne, `maxDuration: 300` inchangé) :

1. **`blog_fact_check`** (web_search ON, migration `0032`) : vérifie les
   affirmations chiffrées, les attributions (HAS/ANSM/OMS/études) et les URLs de
   l'article contre les sources réelles ; produit un rapport `ok`/`issues`
   (parseur pur `parseFactCheckJson`). **Fail-open** : en échec, le rapport est
   « indisponible » et le relecteur final est invité à redoubler de vigilance.
2. **`blog_copyedit`** : relecture rédactionnelle (orthographe, style, structure
   markdown, disclaimer) qui renvoie l'article entier corrigé — interdiction de
   toucher au fond. **Fail-open** : en échec, la version du rédacteur continue.
3. **Illustrations** (best-effort, comme la couverture) : le rédacteur propose un
   `body_image_prompt` optionnel ; l'image du corps est insérée avant la deuxième
   section « ## » (`insertBodyImage`, pur). Chemins d'images sur slug provisoire
   (le titre peut encore changer en relecture finale).

La relecture finale `blog_review` reçoit l'article relu ET le rapport du
vérificateur ; elle reste l'unique barrière **fail-closed** (reject → brouillon).
Convention admin respectée pour les 2 nouvelles features (AI_FEATURES,
FEATURE_DEFAULTS, PROMPT_DEFAULTS, seed migration `0032_blog_agent_subagents.sql`).

### Résilience d'exécution (2026-07-04, suite au premier run muet)

Le pipeline complet peut approcher `maxDuration` (300 s) : quand la fonction est
tuée, l'insertion en toute fin de pipeline n'a jamais lieu et le run ne laisse
AUCUNE trace (ni article, ni log — la route avalait aussi les erreurs). Trois
correctifs :

1. **Brouillon inséré dès la rédaction** (statut `draft`, `source =
   'weekly_agent'`), puis mis à jour/publié en fin de pipeline. Un échec ou un
   timeout tardif laisse toujours un brouillon visible dans le panel admin, et
   la garde anti-doublon voit le run. Le slug est figé sur le titre du rédacteur.
2. **Timeout par étape** (`STEP_TIMEOUT_MS` : sujet 60 s, fact-check/copyedit/
   relecture 90 s ; rédaction 150 s ; images 90 s) : un appel LLM qui traîne
   n'épuise plus le budget total. Étapes fail-open avortées silencieusement ;
   relecture finale avortée → brouillon (fail-closed).
3. **Logs** : chaque étape (`[weekly-blog] … (+Ns)`) et le résultat/erreur de la
   route sont tracés dans les logs runtime Vercel.
