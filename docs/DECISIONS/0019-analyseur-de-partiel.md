# ADR-0019 — Analyseur de partiel (feature `partiel_analyze`)

```yaml
status: Accepted
date: 2026-06-07
owner: Hugo Bettembourg
linked_to: [04_CHATBOT §student, 01_REGULATION §1 §4 §5, ADR-0005, ADR-0011, ADR-0017, ADR-0018]
```

## Contexte
Le persona étudiant disposait du chat pédagogique, des QCM (`render_qcm`) et des stations ECOS, mais
pas d'outil pour exploiter ses **résultats de partiels/QCM** (annales, sessions d'entraînement type
« medoutils »). Le besoin : un outil qui analyse une performance et oriente la révision, sans devenir
un dispositif médical ni traiter de patient réel.

## Décision
Nouvelle fonctionnalité IA `partiel_analyze` (route `POST /api/partiel`, écran `app/(chat)/partiel.tsx`),
réservée aux **étudiants vérifiés** (persona dérivée du profil serveur ; admin pour test). L'étudiant
colle ses résultats (QCM + réponses, score par matière, items ratés) ; l'IA renvoie en markdown :
synthèse de performance, analyse par item EDN/R2C, erreurs typiques à corriger, plan de révision priorisé.

Cadre réglementaire (non-MDSW) inscrit dans le prompt système (`promptStore.ts`, clé `partiel_analyze`) :
contexte exclusivement éducatif/fictif, **refus** si le contenu décrit un patient réel/identifiant,
aucun avis médical individualisé, fidélité aux référentiels (Collèges/EDN/HAS), pas d'invention.
Suit la convention 6 étapes (AI_FEATURES, FEATURE_DEFAULTS, migration `0017`, PROMPT_DEFAULTS, runtime,
commentaire de convention). Aucune donnée de santé persistée.

## Conséquences
- Outil de révision à forte valeur pour l'étudiant, cohérent avec ECOS et les QCM existants.
- Configurable depuis le panel admin (modèle + réglages) comme toute feature IA.
- Garde d'audience serveur (403 si non étudiant/admin) + `RoleGate` côté écran (ADR-0018).
- Périmètre volontairement limité aux annales/QCM pédagogiques ; aucune extension vers du suivi
  longitudinal/dossier sans ADR dédiée (donnée de santé attribuable → HDS).

## Rollback
Retirer l'onglet/écran et la route ; la ligne `ai_model_config` (`0017`) peut rester (inerte) ou être
supprimée. Le reste de l'app étudiant (chat, ECOS, QCM) est inchangé.
