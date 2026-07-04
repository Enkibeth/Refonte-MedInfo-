# ADR-0031 — Module Rédaction d'article médical (étudiant + professionnel)

```yaml
status: Accepted
date: 2026-07-04
owner: Hugo Bettembourg
deciders: Hugo
supersedes: []
related: [ADR-0018, ADR-0026, ADR-0028]
```

## Contexte

Les étudiants en santé (thèse d'exercice, mémoire, premiers abstracts) et les professionnels
(articles originaux, cas cliniques, revues) rédigent des manuscrits scientifiques avec des
contraintes très concrètes : structure IMRaD, limites de caractères/mots imposées par les
revues et congrès, bibliographie Vancouver numérotée dans l'ordre d'apparition, exigence
d'originalité (contrôle anti-plagiat institutionnel avant dépôt).

Demande Hugo : un module complet d'aide à la rédaction — rédaction, bibliographie, compteurs
de caractères, réduction de caractères, aide à la détection de plagiat.

Contraintes internes : conventions du dépôt (page autonome + iframe pour les outils riches,
convention feature IA/panel admin, cloisonnement persona, RLS own-row + test, minimisation
des données envoyées à l'IA, honnêteté scientifique : ne jamais inventer fait/chiffre/référence).

## Décision

1. **Architecture = page autonome + iframe**, sur le modèle du CV Builder (jumeau le plus
   proche : éditeur riche web-first, gratuit côté client, IA optionnelle serveur).
   - `public/article.html` : éditeur par sections avec gabarits par type de document
     (article original IMRaD, abstract de congrès, cas clinique, revue de littérature,
     thèse/mémoire), conseils de rédaction par section, check-list qualité par type,
     3 vues (Rédaction / Bibliographie / Aperçu), exports Word (.doc, Times 12 double
     interligne) / Markdown / copie. **Aucune librairie externe** (page auto-suffisante).
   - `app/(chat)/article.tsx` : wrapper (ToolsMenu + titre Fraunces, iframe, token par
     `postMessage`, fallback natif, `<RoleGate feature="article">`).

2. **Compteurs déterministes, jamais l'IA.** Caractères (espaces comprises / hors espaces)
   et mots, par section et globaux, avec limites éditables (jauges vert/orange/rouge) et
   presets par type (résumé 250 mots, abstract 2 500 caractères). Référence du comptage :
   module pur `src/article/articleDocument.ts` (`countText`), miroir JS dans la page.

3. **Bibliographie ancrée sur des métadonnées réelles.** Ajout par DOI (CrossRef REST) ou
   PMID (Europe PMC REST) côté client — jamais de référence générée par IA — plus saisie
   manuelle. Appels dans le texte via tokens stables `[@id]`, rendus `[n]` (Vancouver,
   ordre de première apparition) ou `(Auteur, année)` (APA) dans l'aperçu et les exports ;
   renumérotation automatique, alertes appels orphelins / références jamais citées.

4. **Trois features IA distinctes sur `/api/article`** (configurables au panel admin,
   convention 0011, seeds migration `0033`) :
   - `article_assist` : améliorer/corriger/clarifier/transition/traduction scientifique/
     titres/avis de structure sur UNE section — texte proposé, appliqué explicitement par
     l'utilisateur (drawer Appliquer/Refuser), jamais de réécriture silencieuse ;
   - `article_reduce` : réduction à la limite demandée, **recompte serveur déterministe**
     (`withinLimit` vérifié par `countText`, jamais sur parole de l'IA) ;
   - `article_originality` : contrôle d'originalité par recherche web (formulations trop
     proches de sources publiées, rapport JSON parsé fail-closed) — INDICATIF, l'UI
     rappelle qu'il ne remplace pas Compilatio/iThenticate.
   Garde persona serveur étudiant/pro/admin (`resolveChatPersona`, jamais le body),
   rate-limit (compteur étudiant). Contexte IA MINIMISÉ (`buildAiSectionContext` : une
   section + plan + métadonnées de cadrage, jamais les auteurs ni le manuscrit entier) ;
   les appels `[@id]` sont rendus `[n]` avant envoi puis ré-ancrés au retour (`detokenize`)
   pour ne jamais perdre l'ancrage des citations.

5. **Historique cloud own-row** : table `article_documents` (migration `0033`), CRUD
   `/api/article-docs` via client Supabase scopé au token (RLS = barrière réelle), autosave
   débouncé + sauvegarde locale de secours, panneau « Mes articles ».
   Test `tests/rls/article-documents.test.ts`.

6. **Visibilité par rôle** : étudiant + professionnel (+ admins), entrée `article` dans
   `featureVisibility.ts` (icône ligne `penLine`), onglet retiré via `href: null` sinon,
   RoleGate en défense en profondeur. Grand public : invisible.

## Honnêteté scientifique (règles produit)

- L'IA n'invente JAMAIS un fait, un chiffre, une statistique ni une référence ; une
  affirmation à sourcer devient `[référence à ajouter]` (prompts `article_*`).
- Les références viennent de CrossRef/Europe PMC ou de la saisie de l'auteur — jamais du LLM.
- L'exemple embarqué est explicitement FICTIF (revues « Rev Exemple Cardiol », mention
  « données fictives ») pour ne jamais montrer de fausse référence plausible.
- Un manuscrit n'est pas un dossier patient : l'UI rappelle de n'inclure aucune donnée
  identifiante de patient ; la check-list qualité inclut l'anonymat.

## Conséquences

- +3 features IA au panel admin (`article_assist`, `article_reduce`, `article_originality`,
  web_search ON pour la dernière seulement).
- +1 table own-row (`article_documents`) avec test RLS ; aucune donnée de santé.
- Le contrôle d'originalité dépend de la qualité de la recherche web du provider : verdict
  indicatif, jamais présenté comme une certification anti-plagiat.
- Réintroduction future de la sécurité chat (ADR-0024) : ce module n'est pas concerné
  (pas de conseil médical individualisé ; information scientifique de l'auteur lui-même).

## Suivi

- [ ] Presets de limites par revue/congrès (base de gabarits) si demande.
- [ ] Export .docx natif (OOXML) si les revues refusent le .doc HTML.
- [ ] Import BibTeX/RIS de bibliographies existantes.
