# ADR-0029 — Frontière grand public : encyclopédie conversationnelle

```yaml
status: Accepted
date: 2026-06-30
owner: Hugo Bettembourg
deciders: Hugo
supersedes: []
related: [ADR-0003, ADR-0005, ADR-0023, ADR-0024]
```

## Contexte

Deux constats ont convergé.

1. **Contradiction doctrine ↔ produit.** La doctrine (`docs/01_REGULATION.md` §3/§5) posait
   un **refus déterministe** dès que l'utilisateur décrit ses symptômes (donnée de santé Art. 9,
   MDSW IIa+). Or le prompt public `src/ai/prompts/public.v3.ts` fait l'**inverse** : il impose un
   **RECUEIL MINIMUM OBLIGATOIRE** (âge, sexe, tabac, alcool, antécédents personnels + familiaux
   sur 2 tours forcés) *avant* de répondre, puis produit une section **« CE QUE CELA PEUT ÉVOQUER »**
   (1 à 3 hypothèses individualisées avec probabilités) et **« QUE FAIRE MAINTENANT »** (orientation
   personnalisée). C'est un recueil clinique → synthèse individualisée, soit précisément la ligne
   rouge §2.

2. **Sur-refus de la posture antérieure.** L'audit Council 2026-06 (F5/F8/F9) relevait qu'en refusant
   « tout symptôme personnel », l'encyclopédie refusait la quasi-totalité des questions légitimes.
   Une analyse externe (ChatGPT, benchmark type Doctolib) confirmait qu'une IA **peut** poser des
   questions et exposer des causes générales sans basculer dans le dispositif médical — la ligne
   dangereuse étant le **diagnostic / triage / la décision individualisés**, pas la question elle-même.

Il fallait trancher « jusqu'où peut aller » le chatbot grand public, entre deux extrêmes également
inconfortables : refus systématique (produit inutilisable) vs anamnèse + orientation (dérive MDSW).

## Décision

Le chatbot **grand public** est une **encyclopédie conversationnelle**.

- ✅ **Autorisé** : poser des questions de **cadrage** pour désambiguïser le sujet et sélectionner
  l'information pertinente, puis livrer une **information générale** (causes fréquentes en population,
  signes d'alerte, quand consulter en termes généraux, comment préparer sa consultation). La sortie
  s'applique à une **catégorie / situation type**, **jamais** à *ce patient-ci*.
- ❌ **Interdit** : diagnostic, décision/**triage**, **orientation individualisée** (« dans *votre*
  cas… », « *pour vous*, consultez sous 48 h »), posologie détaillée, modification de traitement,
  temporalité de consultation personnalisée.
- 🚑 **Red flag / urgence** : interruption immédiate → **message de refus canonique** (§4) + 15 / 112.

**Règle-pivot (inscrite en `01_REGULATION` §2)** : *les questions servent au cadrage de
l'information, jamais à l'évaluation d'un cas individuel ; la sortie reste générale, jamais
individualisée.*

Cette décision **précise** (ne supprime pas) la ligne « Utilisateur décrit SES symptômes » de §3 :
décrire un symptôme n'entraîne plus un refus *par principe* ; c'est l'**individualisation de la
sortie** qui est la ligne rouge. Corollaire RGPD : les questions de cadrage sont soumises à la
**minimisation** (pas de moisson systématique de facteurs Art. 9) et au caractère **stateless /
anonyme** côté public (`01_REGULATION` §5).

## Conséquences

- `docs/01_REGULATION.md` passe en **1.3.0** : §2 (règle-pivot « poser des questions ≠
  diagnostiquer »), §3 (scission de la ligne symptômes + note de frontière), §4 (le classifieur vise
  désormais `individualized_request`/`emergency`, plus « tout symptôme personnel »), §5
  (minimisation), §7 (nuance L.4161-1 + référentiels HAS à confirmer), §10 (risque résiduel +
  benchmark Doctolib cadré comme non-safe-harbor).
- **Non-conformité connue tracée** : `public.v3` dépasse aujourd'hui la frontière (recueil
  obligatoire + « ce que cela peut évoquer » + orientation). Son **réalignement** (questions rendues
  optionnelles et de cadrage, suppression de l'anamnèse imposée et de l'orientation individualisée,
  sortie maintenue générale) est un **suivi séparé** — décision Hugo : mettre à jour les docs
  d'abord. Voir `docs/STATUS.md`.
- La **réintroduction des couches techniques** neutralisées par ADR-0024 (couche 1 classifieur
  pré-LLM recadré sur `individualized_request`/`emergency` ; couche 3 validation de sortie sur les
  marqueurs d'individualisation) reste en attente et devient le complément naturel de cette
  frontière : sans elles, la frontière ne tient que par le prompt (défense insuffisante, §4).
- Le **benchmark Doctolib** est un repère produit, **pas** un blanc-seing juridique : AIPD, avis GIO
  ANSM et/ou avis d'un juriste e-santé restent recommandés avant lancement public (§10).
- Personas étudiant / professionnel : inchangés ici (leur périmètre documentaire reste régi par
  ADR-0005 / `04_CHATBOT.md`) ; la présente frontière vise le **public**.

## Statut

Accepted.
