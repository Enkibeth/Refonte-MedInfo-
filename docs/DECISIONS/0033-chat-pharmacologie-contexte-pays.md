# ADR-0033 — Chats étudiant/pro : renfort pharmacologie + contexte pays

```yaml
status: Accepted
date: 2026-07-17
owner: Hugo Bettembourg
deciders: Hugo
supersedes: []
related: [ADR-0024, ADR-0030]
```

## Contexte

Retour d'usage Hugo : une question d'**équivalence pharmacologique** a reçu une réponse peu
satisfaisante. Besoin exprimé : que les chats étudiant/professionnel répondent de façon
**fiable et sourcée** aux questions médicamenteuses (posologies, équivalences de doses,
interactions, contre-indications, grossesse/allaitement…), en s'appuyant sur les **bonnes
ressources européennes**, avec une réponse **adaptée à la complexité** (courte si simple,
détaillée si complexe) et le principe de **délégation à des sous-agents** (recherche de la
littérature + vérification des liens) déjà en place.

Besoin complémentaire : pouvoir indiquer **dans quel pays** on se trouve, en haut du chat, et
injecter cette information à l'assistant pour **adapter les ressources** recherchées.

Constat d'architecture : le chatbot **professionnel possède déjà** le pipeline *evidence-first*
(ADR-0030) — sous-agents Europe PMC / PubMed, essais cliniques, `verify_source_links`, workflow
« rechercher → lire → vérifier → rédiger ». Par ailleurs, les sources pharmacologiques
européennes officielles (ANSM/BDPM, RCP, EMA, thésaurus des interactions) ne sont **pas exposées
via des API REST publiques propres** (fichiers/documents, pas de JSON stable), contrairement à la
littérature (Europe PMC, ClinicalTrials.gov) déjà câblée.

## Décision (arbitrage Hugo : 1B / 2 = A+C+D / 3 = B)

1. **Pas de 4e chatbot** : on **greffe** une spécialisation pharmacologie sur le pipeline
   existant (option **B**), plutôt qu'une nouvelle route/onglet. Aucune nouvelle feature IA
   admin, aucune migration : c'est un **renfort du system prompt** de la feature `chat`, au
   même titre que la section « workflow de recherche » (`buildChatToolsSection`).

2. **Renfort pharmacologie** (`src/ai/chat/pharmacology.ts`, pur, testé) : pour les questions
   médicamenteuses, section injectée (étudiant/professionnel seulement — vide pour le grand
   public) imposant, **via le workflow evidence-first déjà présent** :
   - priorisation des sources **officielles** : agence du médicament + RCP du pays (ANSM +
     base-donnees-publique.medicaments.gouv.fr en France, EMA au niveau européen), **interactions**
     (thésaurus ANSM), grossesse/allaitement (Le CRAT), preuves (PubMed/Europe PMC + HAS/sociétés
     savantes), puis `verify_source_links` ;
   - **profondeur adaptée** : réponse courte pour une question simple, structurée/détaillée pour
     une question complexe ;
   - **cadrage sûr des équivalences de doses** : fourchettes **sourcées** avec la base de
     conversion, rappel des limites (variabilité, tolérance croisée incomplète, marge étroite),
     interdiction d'inventer un chiffre, et rappel que la conversion est **indicative, à valider
     par le prescripteur** selon le RCP et le contexte — **jamais** une prescription individualisée.
   - Choix des ressources = **A (Europe : ANSM/BDPM, RCP, EMA) + C (interactions) + D (PubMed/
     Europe PMC)**. Les sources **US** (openFDA/DailyMed/RxNorm) ne sont pas ciblées pour l'instant.

3. **Contexte pays** (`src/ai/chat/country.ts`, pur, testé ; `src/ui/chat/CountrySelector.tsx`) :
   sélecteur en haut du chat (les 3 chats), envoyé dans le **body** de `/api/chat` (comme
   `personalInfo`, jamais une source de vérité serveur), coercé serveur (`coerceCountry`) et
   injecté (`buildCountryContextSection`) pour prioriser les sources officielles du pays et
   signaler que l'information (AMM, nom commercial, dose) peut différer d'un pays à l'autre.
   Persistance `localStorage` (`medinfo:chatCountry`), web-first. Livré **dans la même branche**
   que le renfort pharmaco (option **B** de la question 3).

4. **Assemblage** (`app/api/chat+api.ts`) :
   `system = template + userContext + countryContext + toolsSection(workflow) + pharmacologySection`.

## Conséquences

- **Réutilise** entièrement le pipeline evidence-first + la vérification de liens (ADR-0030) :
  pas de nouvel appel LLM, pas d'outil fragile, pas de migration.
- **Sécurité/conformité** : information pharmacologique **générale et sourcée** ; les équivalences
  de doses restent **indicatives** (validation prescripteur) — pas de CAT individualisée (cohérent
  avec les règles de reprise). Disclosure IA inchangée. Cloisonnement persona inchangé (section
  vide pour le grand public).
- **Limite assumée** : la fiabilité repose sur `web_search` + littérature orientés vers les
  domaines officiels, **pas** sur des connecteurs REST déterministes vers ANSM/BDPM/EMA (qui n'ont
  pas d'API publique propre). Étape suivante possible : outils REST déterministes dédiés (les
  sources **US** openFDA/DailyMed/RxNorm ont, elles, des API propres — à rouvrir si besoin), et un
  référentiel d'interactions structuré.

## Suivi

- Vérifier sur des cas réels d'équivalence (opioïdes, corticoïdes, benzodiazépines) que les
  réponses citent des sources vérifiées et rappellent la validation prescripteur.
- Envisager la persistance du pays au profil (migration dédiée + ADR) si le besoin se confirme.
