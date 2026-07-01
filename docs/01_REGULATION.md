# MedInfo AI — Doctrine Réglementaire (Source de Vérité)

```yaml
title: Regulatory Doctrine
version: 1.3.0
owner: Hugo Bettembourg
status: Active
date: 2026-06-30
authority: SOURCE DE VÉRITÉ — tout autre document doit être cohérent avec celui-ci
linked_to: [00_CHARTER.md, 02_ARCHITECTURE.md, 04_CHATBOT.md, 06_BILLING.md]
```

> **Règle d'or.** Ce document prime sur tous les autres. En cas de conflit entre une décision technique, commerciale ou design et ce document, ce document gagne. Toute modification ici incrémente la version et déclenche une revue des documents liés.

> **Révision 1.3.0 (2026-06-30, ADR-0029).** Précision de la **frontière grand public** : le chatbot public est une **encyclopédie conversationnelle** — il peut poser des questions de *cadrage* pour mieux répondre, tant que la sortie reste **générale et jamais individualisée** (ni diagnostic, ni décision/triage, ni orientation personnalisée). Sections touchées : §2, §3, §4, §5, §7, §10. Le bloc verbatim §1 (intended purpose) est **inchangé**. Cette révision déclenche la revue de `04_CHATBOT.md` et `CLAUDE.md`.

---

## 1. Énoncé d'intended purpose (verbatim — identique partout)

Pièce maîtresse de la défense réglementaire. Doit apparaître **mot pour mot identique** dans : CGU, mentions légales, descriptions App Store / Play Store, écran d'onboarding, et le `regulatory_scope` des prompts.

> *MedInfo AI est une plateforme conversationnelle d'information et de référence éducative fournissant des informations médicales et pharmacologiques générales tirées de la littérature médicale française et européenne publiquement disponible (HAS, ANSM, VIDAL, Thériaque, PubMed). Elle ne fournit aucune recommandation diagnostique, pronostique ou thérapeutique individuelle. Elle n'est pas destinée à remplacer, compléter ou influencer les décisions cliniques concernant un patient identifiable. Le produit n'est pas destiné à être un dispositif médical au sens de l'article 2(1) du règlement (UE) 2017/745 et n'est pas qualifié de logiciel-dispositif médical (MDSW).*

**EN (App Store / Play Store) :**
> *MedInfo AI is a conversational educational medical information platform providing general medical and pharmacological information derived from publicly available French and European medical literature. It does not provide any individualized diagnostic, prognostic, or therapeutic recommendation. It is not intended to qualify as Medical Device Software (MDSW) under Regulation (EU) 2017/745.*

---

## 2. La ligne rouge MDR

**Base légale :** Règlement (UE) 2017/745 (MDR), Annexe VIII Règle 11 + MDCG 2019-11 Rev.1 (juin 2025).

Un logiciel est MDSW dès qu'il réunit **cumulativement** :
1. une **action sur les données** au-delà de stockage/transmission/recherche simple,
2. au **bénéfice d'un patient individuel identifiable**,
3. dans une **finalité médicale** (art. 2(1) MDR).

La Règle 11 classe alors **a minima Classe IIa** (IIb si erreur → détérioration grave, III si décès).

**Stratégie MedInfo :** rompre le critère 2 (jamais de patient identifiable) ET le critère 1 (jamais de synthèse interprétative individualisée).

**Poser des questions ≠ diagnostiquer.** Le fait de poser des questions n'est pas, en soi, un déclencheur MDSW. Ce qui déclenche la qualification, c'est le **couple** « action interprétative sur des données » (critère 1) **+** « bénéfice d'un patient individuel identifiable » (critère 2). D'où la distinction opératoire :

- ✅ **Cadrage d'information générale** — poser une question pour *désambiguïser le sujet* et *sélectionner l'information pertinente* (ex. « parlez-vous d'une douleur thoracique chez l'adulte ou chez l'enfant ? »), puis livrer une **information générale** (causes fréquentes en population, signes d'alerte, quand consulter en termes généraux). La sortie s'applique à une **catégorie / situation type**, jamais à *ce patient-ci* → critères 1 **et** 2 non réunis → **non-MDSW**.
- ❌ **Recueil clinique → synthèse individualisée** — collecter un profil clinique (anamnèse) pour produire une **évaluation, une orientation ou un différentiel propres à la personne** (« dans *votre* cas, cela évoque… », « *pour vous*, consultez sous 48 h »). Critères 1 **et** 2 réunis → **MDSW (IIa+)**.

Règle-pivot : **les questions servent au cadrage de l'information, jamais à l'évaluation d'un cas individuel ; la sortie reste générale, jamais individualisée.** (cf. §3, ADR-0029)

> **Un disclaimer ne renverse JAMAIS une qualification MDSW.** Seule la finalité réelle — exprimée par le code, les réponses effectives, le marketing — compte (doctrine Commission/CJUE, jurisprudence ANSM). Marquage CE Classe IIa = **80 000–300 000 € + 12-18 mois** : totalement incompatible avec le budget. La seule voie viable est la safe-box.

---

## 3. Décisions feature-par-feature (contraignant)

| Fonctionnalité | MDSW ? | Décision | Couche d'application |
|---|---|---|---|
| Chatbot encyclopédique (sans aucune question) | Non | **Autorisé** | — |
| **Encyclopédie conversationnelle** (questions de *cadrage* → **information générale**) | Non | **Autorisé** | Sortie toujours générale, jamais individualisée ; minimisation des données (§5) |
| Utilisateur décrit ses symptômes → **orientation / triage / différentiel individualisé** | Oui (IIa+) | **Interdit** | Prompt + (à réintroduire) classifieur + validation |
| Profile wizard (démo/allergies/traitements) | **Oui — déclencheur** | **SUPPRIMÉ** | Absent du repo |
| Calculateur clinique interprétatif | Oui | **SUPPRIMÉ (public+pro)** | Absent du repo |
| Interaction médicamenteuse avec avis | Oui | **Interdit** | Classifieur + validation |
| Diagnostic différentiel individualisé | Oui | **Interdit** | Classifieur + validation |
| Cas EDN/ECOS fictifs scriptés | Non | **Autorisé** | Persona étudiant, fictif only |
| RAG citant HAS/ANSM/VIDAL verbatim | Non | **Autorisé** | Vérifier licences VIDAL/Thériaque |

**Invariant :** toute fonctionnalité « Interdit »/« Supprimé » apparaissant dans le code = build CI rouge.

> **Frontière grand public (ADR-0029) — encyclopédie conversationnelle.** La ligne « Utilisateur décrit SES symptômes → refus déterministe » (doctrine antérieure) est **précisée**, pas supprimée : décrire un symptôme n'entraîne plus un refus *par principe*. Le bot public **peut** poser des questions de cadrage et répondre — tant qu'il reste une **encyclopédie** (information générale, causes fréquentes en population, signes d'alerte, quand consulter en termes généraux). Ce qui reste **interdit**, c'est de basculer vers l'**orientation/triage/diagnostic individualisé** (« dans *votre* cas… », « *pour vous*, consultez sous 48 h »). Cf. la règle-pivot §2.
>
> **⚠️ Non-conformité connue (à corriger — suivi prompt, hors périmètre de la révision doc).** Le prompt `src/ai/prompts/public.v3.ts` tombe aujourd'hui du **mauvais côté** de cette frontière : il impose un **RECUEIL MINIMUM OBLIGATOIRE** (âge, sexe, tabac, alcool, antécédents personnels + familiaux sur 2 tours forcés) *avant* de répondre, puis produit une section **« CE QUE CELA PEUT ÉVOQUER »** (1 à 3 hypothèses individualisées) et **« QUE FAIRE MAINTENANT »** (orientation personnalisée). C'est un recueil clinique → synthèse individualisée = ligne rouge §2. **À réaligner** sur l'encyclopédie conversationnelle dans une branche dédiée (décision Hugo : docs d'abord).

---

## 4. Doctrine du refus — defense-in-depth (3 couches)

> ⚠️ **Note de dépréciation temporaire (ADR-0024, refonte 2026-06)** : les couches 1 (classifieur pré-LLM) et 3 (validation de sortie) sont **retirées du code** ; le chat est un appel LLM direct. Cette doctrine reste la cible et sera réintroduite après validation de l'ébauche par Hugo.

Le refus ne repose **jamais** sur le seul prompt. Implémentation dans `04_CHATBOT.md`.

> **Recalage frontière (ADR-0029).** Poser une question de **cadrage** n'est **pas** un déclencheur de refus : l'encyclopédie conversationnelle a le droit de questionner puis de répondre en **information générale** (§2, §3). Ce que les couches doivent bloquer/rediriger de façon déterministe, c'est (a) la **demande d'un acte individualisé** (diagnostic, triage, orientation « pour vous », modification de traitement) et (b) l'**urgence / red flag** (→ message canonique + 15/112). Le simple fait qu'un utilisateur mentionne un symptôme ne suffit plus à déclencher un refus *par principe* — c'est l'**individualisation de la sortie** qui est la ligne rouge.

**Couche 1 — Classifieur pré-LLM (déterministe).** Chaque message → catégorie `general_info`/`individualized_request`/`emergency`/`out_of_scope`/`ambiguous`. Si `individualized_request`/`emergency` → message canonique, **LLM principal jamais appelé** ; `ambiguous` → clarification (cadrage) plutôt que refus sec. (La catégorie n'est plus « tout symptôme personnel » mais « demande d'acte individualisé ».)

**Couche 2 — Contrainte prompt.** Réaffirme les interdits (ceinture + bretelles) : sortie générale uniquement, jamais d'orientation/diagnostic individualisés.

**Couche 3 — Validation de sortie.** Marqueurs de diagnostic/orientation individualisés (« vous avez probablement », « dans votre cas, consultez sous… ») → réponse bloquée + remplacée + incident loggé.

**Message de refus standard canonique (verbatim, source unique) :**
> *MedInfo AI fournit de l'information médicale générale et ne peut pas analyser une situation personnelle ni orienter un diagnostic individuel. Si vous ressentez des symptômes ou une inquiétude qui vous concerne, vous ou un proche, consultez un professionnel de santé. En cas d'urgence, composez le 15 (SAMU) ou le 112. En cas de détresse psychologique ou d'idées suicidaires, composez le 3114. Pour un besoin de soins non programmés, le 116 117 peut orienter selon votre territoire ; pour une pharmacie de garde, le 3237 peut être utile selon disponibilité locale.*

**Règle d'usage :** les autres documents, prompts, snapshots et composants UI doivent réutiliser ce message ou une référence explicite à ce message canonique. Aucun autre message de refus concurrent ne doit être introduit.

---

## 5. Données de santé & HDS (art. L.1111-8 CSP)

**Principe CNIL/ANS :** l'autodéclaration de symptômes **crée des données de santé** (RGPD Art. 9). Le framing « éducatif » ne change pas la nature de la donnée. Ceci reste vrai même lorsque la réponse demeure une information générale : une question de cadrage qui recueille un symptôme, un âge ou un antécédent traite bien une donnée Art. 9.

**Minimisation (conséquence directe de la frontière §2/§3).** Puisque les questions de cadrage touchent à des données Art. 9, elles doivent :
- collecter le **strict minimum** utile à *sélectionner l'information générale* (ce qui change vraiment la réponse encyclopédique), jamais un profil clinique complet ;
- **proscrire la moisson systématique** de facteurs sensibles (tabac, alcool, antécédents personnels/familiaux, traitements) en préalable obligatoire — cette anamnèse imposée est à la fois une dérive MDSW (§3) *et* une collecte Art. 9 non minimisée ;
- rester **stateless / anonyme** côté public (aucune conservation attribuable → HDS non déclenché, ligne « Voie MVP » ci-dessous) ;
- rester couvertes par l'**AIPD/DPIA** obligatoire (§7).

> Autrement dit : la minimisation des données et le caractère stateless sont les **garde-fous RGPD** qui accompagnent l'assouplissement produit (l'IA peut questionner) — ils empêchent que « poser des questions » ne devienne « constituer un dossier ».

| Scénario | Données santé conservées ? | HDS requis ? | Statut |
|---|---|---|---|
| Public stateless anonyme, suppression immédiate | Non | **Non** | **Voie MVP** |
| Étudiant, cas fictifs scriptés | Non | **Non** | **Autorisé** |
| Compte + historique + symptômes attribuables | Oui | **Oui** | Post-revue |
| Wizard / triage stocké | Oui | **Oui + MDSW IIa** | **Interdit** |

**Hostinger n'est PAS HDS** (vérifié esante.gouv.fr). Tant que « stateless anonyme » tient → HDS non requis. Si persistance santé activée → **Scalingo / Scaleway / OVHcloud Healthcare** (~100-300 €/mois) AVANT activation.

**LLM tiers :** OpenAI Project en **EU Data Residency + Zero Data Retention**, DPA + SCC Module 2. Alternative souveraine : **Mistral La Plateforme**.

---

## 6. EU AI Act

**Position :** hors MDSW → **« risque limité »** → seul **art. 50(1)** (informer interaction IA). Applicable **2 août 2026**. Sanction ≤ 15 M€ / 3% CA.

**Disclosure AI Act (avant 1ʳᵉ interaction) — le système nommé doit refléter le modèle réellement servi.**
Le projet peut servir **deux providers** (Anthropic et OpenAI, cf `02_ARCHITECTURE §5` et `src/ai/providers`). La disclosure ne fige donc aucun fournisseur : elle nomme le système actif quand il est connu (contexte serveur), sinon les deux providers possibles (contexte UI statique). Source unique : `src/compliance/disclosures.ts` (`getAiDisclosure`).

- Forme UI statique (onboarding, sign-in) :
> *Vous interagissez avec un système d'intelligence artificielle (Claude (Anthropic) ou GPT (OpenAI) selon le modèle servi). Les réponses sont générées automatiquement et peuvent contenir des erreurs.*
- Forme serveur (modèle connu, ex. réponse chat) : le libellé exact du modèle actif est injecté (ex. *« …(claude-sonnet-4-6, Anthropic)… »* ou *« …(gpt-5.x, OpenAI)… »*) via `getActiveSystemLabel()`.

GPAI (Art. 51-55) → **le ou les providers GPAI** (OpenAI et/ou Anthropic), pas MedInfo. Bascule auto en haut-risque (Art. 6(1)) si MedInfo devient MDSW.

> **À valider côté juridique (Hugo) :** deux providers = **deux DPA / SCC + résidence EU** à couvrir (Anthropic ET OpenAI, cf §5), pas un seul.

---

## 7. Couche française

- **ANSM GIO** : demander **opinion qualification écrite** (gratuit, 2-6 sem). À envoyer **Mois 0**. Dérisquage le moins cher.
- **CNIL** : **AIPD obligatoire avant lancement**. Outil gratuit : logiciel PIA CNIL. Risque résiduel élevé → consultation préalable Art. 36.
- **Art. L.4161-1 CSP** : Hugo non thésé → risque pénal **personnel** (1 an + 30 000 €) si diagnostic individuel, indépendamment du statut. **Nuance frontière (ADR-0029)** : cadrer une information générale (« s'agit-il d'un adulte ou d'un enfant ? ») ≠ « établir un diagnostic » au sens de l'exercice illégal. L'infraction naît de la **conclusion / orientation individualisée** (« vous avez probablement… », « voici quoi faire dans votre cas »), pas du fait de poser une question ou d'exposer des causes générales.
- **Charte qualité santé** : HONcode supprimé (déc. 2022) → publier sa propre charte (8 principes).
- **Référentiels HAS à aligner / vérifier (à confirmer côté juridique — ne pas présumer acquis)** : (a) le **référentiel HAS des applications et objets connectés en santé hors dispositif médical** (cadre qualité information/contenu/sécurité/confidentialité pour une app santé non-DM) ; (b) le cadre HAS émergent sur l'**IA générative en santé destinée aux usagers**. À utiliser comme grille d'auto-évaluation de la posture « information santé, pas DM » ; l'intitulé et le périmètre exacts restent à confirmer avant de s'en prévaloir publiquement.

---

## 8. Mentions obligatoires (checklist)

- [ ] Mentions légales (LCEN art. 6 : éditeur + hébergeur)
- [ ] Politique confidentialité (RGPD Art. 13 + OpenAI sous-traitant Art. 28 + transferts hors UE)
- [ ] CGU avec intended purpose verbatim (§1)
- [ ] Charte qualité santé (8 principes type HONcode)
- [ ] Bandeau cookies (délibération CNIL 2020-091)
- [ ] Disclaimer médical permanent (§4)
- [ ] Disclosure AI Act Art. 50 (§6)

---

## 9. Statut juridique — règle de bascule

**Rester EI/micro** tant que strictement éducatif anonyme.
**Basculer SASU** (~300-400 €) AVANT : (a) données patient identifiables, (b) cible HCP commerciale, (c) publication app stores sous marque « MedInfo AI » (enrôlement Apple Organization → D-U-N-S).

**RCP cyber + pro 1-2 M€** (~400-800 €/an) : **avant tout lancement public**.

---

## 10. Zones d'incertitude (revue trimestrielle → docs/DECISIONS/)

1. **Avis GIO ANSM** — peut resserrer/desserrer. Bloquant tier Pro.
2. **Transfert UE-US OpenAI post-Schrems** — peut forcer migration Mistral/Azure EU sous 12-18 mois.
3. **Digital Omnibus AI Act** — peut repousser échéances haut-risque 2027→2028.
4. **Frontière « encyclopédie conversationnelle » (ADR-0029)** — la limite entre « cadrage d'information générale » et « orientation individualisée » est **qualitative** ; un LLM peut déraper (d'où couches 2/3 à réintroduire). Risque résiduel à surveiller par revue d'échantillons + tests adverses. Une **qualification formelle** (avis GIO ANSM et/ou avocat e-santé) reste recommandée **avant lancement public**.

> **Benchmark informel — positionnement type « Doctolib ».** Ligne de sûreté visée pour le public : *information médicale + questions de clarification (cadrage) + repérage des red flags + orientation prudente (15/112), sans jamais « vous avez probablement X » ni « prenez Y » ni écarter une urgence.* ⚠️ Ce benchmark est un **repère produit, pas un safe harbor juridique** : le fait qu'un acteur établi (mieux armé — RGPD, HDS, DPO, DPA) procède ainsi **ne qualifie pas** notre propre statut réglementaire. Il ne remplace ni l'AIPD, ni l'avis GIO ANSM, ni une analyse d'un juriste e-santé.
