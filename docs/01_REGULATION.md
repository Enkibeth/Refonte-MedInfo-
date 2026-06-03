# MedInfo AI — Doctrine Réglementaire (Source de Vérité)

```yaml
title: Regulatory Doctrine
version: 1.1.0
owner: Hugo Bettembourg
status: Active
date: 2026-06-03
authority: SOURCE DE VÉRITÉ — tout autre document doit être cohérent avec celui-ci
linked_to: [00_CHARTER.md, 02_ARCHITECTURE.md, 04_CHATBOT.md, 06_BILLING.md]
```

> **Règle d'or.** Ce document prime sur tous les autres. En cas de conflit entre une décision technique, commerciale ou design et ce document, ce document gagne. Toute modification ici incrémente la version et déclenche une revue des documents liés.

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

> **Un disclaimer ne renverse JAMAIS une qualification MDSW.** Seule la finalité réelle — exprimée par le code, les réponses effectives, le marketing — compte (doctrine Commission/CJUE, jurisprudence ANSM). Marquage CE Classe IIa = **80 000–300 000 € + 12-18 mois** : totalement incompatible avec le budget. La seule voie viable est la safe-box.

---

## 3. Décisions feature-par-feature (contraignant)

| Fonctionnalité | MDSW ? | Décision | Couche d'application |
|---|---|---|---|
| Chatbot encyclopédique (sans input patient) | Non | **Autorisé** | — |
| Utilisateur décrit SES symptômes | Oui (IIa+) | **Refus déterministe** | Classifieur pré-LLM |
| Profile wizard (démo/allergies/traitements) | **Oui — déclencheur** | **SUPPRIMÉ** | Absent du repo |
| Calculateur clinique interprétatif | Oui | **SUPPRIMÉ (public+pro)** | Absent du repo |
| Interaction médicamenteuse avec avis | Oui | **Interdit** | Classifieur + validation |
| Diagnostic différentiel individualisé | Oui | **Interdit** | Classifieur + validation |
| Cas EDN/ECOS fictifs scriptés | Non | **Autorisé** | Persona étudiant, fictif only |
| RAG citant HAS/ANSM/VIDAL verbatim | Non | **Autorisé** | Vérifier licences VIDAL/Thériaque |

**Invariant :** toute fonctionnalité « Interdit »/« Supprimé » apparaissant dans le code = build CI rouge.

---

## 4. Doctrine du refus — defense-in-depth (3 couches)

Le refus ne repose **jamais** sur le seul prompt. Implémentation dans `04_CHATBOT.md`.

**Couche 1 — Classifieur pré-LLM (déterministe).** Chaque message → catégorie `general_info`/`personal_symptoms`/`emergency`/`out_of_scope`/`ambiguous`. Si `personal_symptoms`/`emergency`/`ambiguous` → refus canonique, **LLM principal jamais appelé**.

**Couche 2 — Contrainte prompt.** Réaffirme les interdits (ceinture + bretelles).

**Couche 3 — Validation de sortie.** Marqueurs de diagnostic individualisé (« vous avez probablement ») → réponse bloquée + remplacée + incident loggé.

**Message de refus standard canonique (verbatim, source unique) :**
> *MedInfo AI fournit de l'information médicale générale et ne peut pas analyser une situation personnelle ni orienter un diagnostic individuel. Si vous ressentez des symptômes ou une inquiétude qui vous concerne, vous ou un proche, consultez un professionnel de santé. En cas d'urgence, composez le 15 (SAMU) ou le 112. En cas de détresse psychologique ou d'idées suicidaires, composez le 3114. Pour un besoin de soins non programmés, le 116 117 peut orienter selon votre territoire ; pour une pharmacie de garde, le 3237 peut être utile selon disponibilité locale.*

**Règle d'usage :** les autres documents, prompts, snapshots et composants UI doivent réutiliser ce message ou une référence explicite à ce message canonique. Aucun autre message de refus concurrent ne doit être introduit.

---

## 5. Données de santé & HDS (art. L.1111-8 CSP)

**Principe CNIL/ANS :** l'autodéclaration de symptômes **crée des données de santé** (RGPD Art. 9). Le framing « éducatif » ne change pas la nature de la donnée.

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

**Disclosure AI Act (verbatim, avant 1ʳᵉ interaction) :**
> *Vous interagissez avec un système d'intelligence artificielle (GPT-5.x, OpenAI). Les réponses sont générées automatiquement et peuvent contenir des erreurs.*

GPAI (Art. 51-55) → OpenAI, pas MedInfo. Bascule auto en haut-risque (Art. 6(1)) si MedInfo devient MDSW.

---

## 7. Couche française

- **ANSM GIO** : demander **opinion qualification écrite** (gratuit, 2-6 sem). À envoyer **Mois 0**. Dérisquage le moins cher.
- **CNIL** : **AIPD obligatoire avant lancement**. Outil gratuit : logiciel PIA CNIL. Risque résiduel élevé → consultation préalable Art. 36.
- **Art. L.4161-1 CSP** : Hugo non thésé → risque pénal **personnel** (1 an + 30 000 €) si diagnostic individuel, indépendamment du statut.
- **Charte qualité santé** : HONcode supprimé (déc. 2022) → publier sa propre charte (8 principes).

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
