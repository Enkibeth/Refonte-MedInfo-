# MedInfo AI — Project Charter

```yaml
title: Project Charter
version: 2.0.0
owner: Hugo Bettembourg
status: Active
date: 2026-06-02
authority: Constitution du projet — prime sur tout sauf 01_REGULATION.md
```

> **Hiérarchie d'autorité.** En cas de conflit : `01_REGULATION.md` > `00_CHARTER.md` > tout autre document. La conformité réglementaire prime toujours sur la technique, le design et le commercial.

---

## 1. Mission

Plateforme conversationnelle d'information médicale éducative, fondée sur la littérature française et européenne publiquement disponible (HAS, ANSM, VIDAL, Thériaque, PubMed). Ne fournit **aucune** recommandation diagnostique, pronostique ou thérapeutique pour un individu identifiable. Non destinée à être un MDSW au sens du Règlement (UE) 2017/745.

Trois audiences : **grand public** (information santé), **étudiants en médecine** (pédagogie EDN/ECOS sur cas fictifs), **professionnels de santé** (référence documentaire sourcée).

## 2. Doctrine réglementaire (non négociable)

Safe-box non-MDSW. Le système DOIT, **par architecture et non par promesse** :
- refuser tout raisonnement diagnostique individualisé (couche classifieur + prompt + validation sortie)
- refuser le triage symptomatique (refus déterministe pré-LLM)
- ne jamais synthétiser d'avis sur interaction médicamenteuse
- ne stocker aucune donnée de santé identifiable hors infrastructure HDS
- maintenir la cohérence intended-purpose ↔ comportement réel (vérifiée en CI)

Toute fonctionnalité contredisant cette doctrine est interdite ET bloquée par CI. Détail dans `01_REGULATION.md`.

## 3. Doctrine architecturale

Regulatory-first, **executable-compliance**. Les invariants réglementaires sont des tests CI bloquants, pas des conventions humaines.

Stack TypeScript unifiée : **Expo** (une app, web+iOS+Android), **Supabase** (Postgres+Auth+pgvector), **Vercel AI SDK**, **Stripe web-first**. Zéro WordPress. Zéro fragmentation multi-langage backend. Détail dans `02_ARCHITECTURE.md`.

## 4. Protocole de modification IA

Toute PR (humaine ou agent Codex/Claude Code) doit passer **5 gates CI** : `compliance-grep`, `refusal-regression`, `rls-isolation`, `prompt-contract`, `rag-license`. Une PR qui ne passe pas un gate ne peut pas merger. **Pas de template à remplir à la main** — la conformité est testée, pas déclarée. Détail dans `03_SECURITY.md` et `.github/workflows/`.

## 5. Gouvernance des prompts

Les prompts sont des **artefacts TypeScript versionnés** avec contrat (`regulatory_scope`, `forbidden_outputs`, `mandatory_sections`, `eval_threshold`). Aucun prompt n'est éditable en production : il n'existe plus de production éditable, les prompts sont buildés dans l'app. Double couverture de test : **regression** (stabilité du refus) + **LLM-as-judge** (qualité, factualité, sourçage). Détail dans `04_CHATBOT.md`.

## 6. Gouvernance des données

Catégories : auth, usage éducatif, métadonnées d'interaction. **AUCUN** stockage de donnée de santé identifiable sans revue réglementaire explicite ET hébergement HDS. RLS active et testée sur toute table utilisateur.

## 7. Critères de succès (6 mois) — par ordre de priorité

1. **[RÉGLEMENTAIRE]** Safe-box intacte, zéro feature diagnostique en prod, avis GIO ANSM intégré.
2. **[TECHNIQUE]** MVP web déployé, suites regression + eval opérationnelles, RLS testées.
3. **[BUSINESS]** 500 utilisateurs actifs, feedback positif d'au moins 20 étudiants vérifiés.

La priorité 1 prime toujours sur 2 et 3 en cas de conflit.

## 8. Modes de défaillance critiques

- Marketing contredisant l'intended purpose (détecté par `compliance-grep`)
- Feature diagnostique atteignant la prod (bloquée par `refusal-regression`)
- Tests de refus désactivés (interdit ; toute désactivation = revue obligatoire consignée)
- Agent IA modifiant l'architecture sans passer les gates
- Stockage de donnée santé identifiable sur infra non-HDS

## 9. Principe directeur

La cohérence entre **intention légale, implémentation technique et comportement visible par l'utilisateur** est obligatoire et testée en continu. La dérive architecturale est une menace systémique, traitée comme un incident.
