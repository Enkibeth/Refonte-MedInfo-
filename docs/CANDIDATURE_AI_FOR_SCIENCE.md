# Candidature — Anthropic « AI for Science » Program

```yaml
status: Brouillon prêt à soumettre (à compléter par Hugo : affiliation + éléments personnels)
date: 2026-07-02
owner: Hugo Bettembourg
```

## Le programme en bref (vérifié le 2026-07-02)

- **Quoi** : jusqu'à **20 000 $ de crédits API Anthropic**, valables **6 mois**, pour des
  projets scientifiques à fort impact — priorité **biologie / sciences de la vie**.
- **Qui** : chercheurs **rattachés à une institution de recherche** (académique ou à but
  non lucratif). Âge ≥ 18 ans, hors pays sous sanctions.
- **Évaluation** : mérite scientifique, impact potentiel, faisabilité technique (valeur
  réelle de Claude pour le cas d'usage), crédibilité de l'équipe (domaine + IA), et
  **screening biosécurité**. Les dossiers sont examinés **le premier lundi de chaque mois**.
- **Formulaire** :
  <https://docs.google.com/forms/d/e/1FAIpQLSfwDGfVg2lHJ0cc0oF_ilEnjvr_r4_paYi7VLlr5cLNXASdvA/viewform>
- Pages officielles : <https://support.claude.com/en/articles/11199177-anthropic-s-ai-for-science-program>
  et <https://www.anthropic.com/ai-for-science-program-rules>

## ⚠️ Évaluation honnête de l'éligibilité

Le programme vise des **travaux de recherche portés par une institution**, pas des produits
commerciaux. MedInfo, présenté comme un produit/SaaS, a peu de chances d'être retenu tel quel.
Deux angles crédibles :

1. **Angle recherche (recommandé)** : candidater via ton affiliation universitaire
   (faculté de médecine / CHU — *à compléter*), en présentant le volet **recherche**
   du projet : évaluation de la fiabilité, de la vérifiabilité et de la sécurité de
   l'information médicale générée par LLM pour trois publics (patients, étudiants,
   cliniciens) — avec MedInfo comme plateforme d'expérimentation. Idéalement avec un
   co-porteur senior (PU-PH / directeur de thèse) pour le critère « crédibilité de
   l'équipe ».
2. **Angle pédagogique/thèse** : si le projet s'inscrit dans une thèse d'exercice ou un
   M2, le dire explicitement (protocole, encadrant, calendrier).

Si aucune affiliation n'est mobilisable, alternatives : le programme **startups**
d'Anthropic (crédits via accélérateurs/VC partenaires) ou les crédits d'essai standard.

## Projet de réponses (anglais, prêtes à coller — compléter les [crochets])

> Ton : factuel, orienté recherche, sans marketing. Le screening biosécurité est
> automatique : le dossier insiste sur l'information générale (pas de diagnostic
> individuel) et la vérifiabilité des sources.

**Applicant / team**

> [Hugo Bettembourg], medical student/physician-in-training at [Faculté de médecine /
> CHU — to complete], project lead of MedInfo, an open research platform for reliable
> AI-generated medical information. Advised by [senior researcher — to complete].
> The team combines clinical training with hands-on LLM engineering (multi-model
> orchestration, retrieval, guardrail design, evaluation harnesses).

**Project title**

> Grounded and verifiable AI health information: measuring and improving citation
> fidelity of LLM answers for patients, medical students and clinicians.

**Project description**

> Misinformation and unverifiable AI answers are a documented risk in consumer health.
> We built MedInfo, a French-language platform delivering AI-generated *general* medical
> information to three audiences (patients, medical students, physicians), with an
> agentic pipeline that grounds every answer: real bibliographic retrieval (Europe PMC,
> ClinicalTrials.gov, PubMed via Anthropic's MCP connector), automated dead-link
> verification of every cited source before the answer is rendered, and Anthropic's
> Citations API to anchor document analyses to the exact source passages.
> With API credits we will (1) run systematic evaluations of citation fidelity and
> factual grounding across model families and prompting strategies on a golden set of
> French clinical questions; (2) quantify how tool-augmented generation (literature
> search + link verification + anchored citations) reduces hallucinated references
> versus web-search-only baselines; (3) publish the evaluation harness and results.
> The platform never provides individual diagnosis or treatment decisions; outputs are
> general information with mandatory sourcing (HAS, ANSM, ESC, PubMed).

**How will you use Claude / why is Claude valuable?**

> Claude models are central: document analysis uses Claude with the Citations API
> (page-anchored citations, chars/pages), and the professional chatbot uses Claude with
> the hosted PubMed MCP connector. Credits would fund large-scale evaluation runs
> (hundreds of questions × models × pipeline variants), regression testing of safety
> behaviours, and continued operation of the grounded pipeline during the study.

**Expected impact**

> Reusable, published methodology and metrics for verifiable AI health information in
> a non-English (French) healthcare context; practical guidance for deploying grounded
> medical LLM assistants; reduced patient exposure to fabricated references.

**Estimated credit usage**

> ~[X]k requests/month across evaluation and platform usage; majority Claude Sonnet-class
> with Citations + MCP tools; estimated $[Y]/month over 6 months. [Ajuster avec les
> vrais volumes une fois connus.]

## Check-list avant envoi

- [ ] Compléter affiliation + co-porteur senior (sinon, angle thèse/M2).
- [ ] Chiffrer l'usage estimé de crédits (volumes réels du projet).
- [ ] Soumettre via un compte organisationnel (recommandé par Anthropic).
- [ ] Viser un envoi avant le **premier lundi du mois**.
