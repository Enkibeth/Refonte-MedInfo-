# ADR-0019 — Analyseur de classement de promo + dictée vocale

```yaml
status: Accepted
date: 2026-06-07
owner: Hugo Bettembourg
linked_to: [04_CHATBOT §student, 01_REGULATION §5, ADR-0011, ADR-0018]
supersedes_note: "Remplace la 1re version « coach de révision LLM » (incorrecte) du même ADR."
```

## Contexte
Première interprétation erronée : un « analyseur de partiel » = coach de révision LLM (corrige des QCM,
plan de révision). En réalité, l'outil attendu (repris du projet **medoutils** / QCM-quizz) est un
**analyseur de classement de promo** : l'étudiant importe le fichier des notes de toute sa promo et
obtient son **rang**, des statistiques, et peut **comparer** avec un autre numéro étudiant.

## Décision
1. **Analyseur de classement** (onglet étudiant `Classement`, écran `app/(chat)/partiel.tsx`) :
   - Traitement **100 % côté client** : le fichier (CSV/Excel) est parsé dans le navigateur ; les notes
     des autres étudiants **ne quittent jamais l'appareil**, **aucune IA**, aucune persistance.
   - Sorties prévues : rang, moyenne/médiane/percentile, comparaison par numéro étudiant, classement par
     matière + petites stats.
   - **Statut : en conception** — l'écran actuel est un placeholder de cadrage, en attente de la
     spécification exacte de medoutils (format de fichier, colonnes, « petites fonctionnalités »).
   - La version LLM précédente (`partiel_analyze`, route `/api/partiel`, prompt, migration `0017`) est
     **retirée** : pas de dispositif médical, pas de doublon de feature IA.
2. **Dictée vocale** : composant `src/ui/DictationButton.tsx` ajouté aux saisies de chat et ECOS.
   Voix → texte via Whisper (`/api/transcribe`, nouveau mode `raw` = transcription brute sans
   diarisation). Le texte dicté repasse par la safe-box normale de la route cible.

## Conséquences
- Confidentialité renforcée : le classement n'envoie aucune donnée (RGPD : données de tiers traitées
  localement). Aucune donnée de santé.
- L'analyseur reste un **slot visible** (onglet `Classement`, persona étudiant) jusqu'à livraison.
- La dictée est non bloquante (web only ; le clavier reste disponible).

## Rollback
Masquer l'onglet `Classement` (retirer `partiel` de `featureVisibility`). Retirer `DictationButton`
des saisies et le mode `raw` de `/api/transcribe` (le compte rendu audio pro est inchangé).
