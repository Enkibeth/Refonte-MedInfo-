# ADR-0018 — Visibilité des fonctionnalités par rôle (persona)

```yaml
status: Accepted
date: 2026-06-07
owner: Hugo Bettembourg
linked_to: [02_ARCHITECTURE §2 §4, 05_DESIGN, ADR-0006, ADR-0011, ADR-0019]
```

## Contexte
Jusqu'ici, tous les utilisateurs authentifiés voyaient les 4 mêmes onglets (Chat, Document, Audio,
ECOS) quel que soit leur rôle. Or les outils n'ont pas la même audience : l'analyse de document est
grand public, ECOS et l'analyseur de partiel sont étudiants, le compte rendu audio de consultation
est professionnel. Afficher tout à tout le monde brouille l'usage et expose des surfaces hors-rôle.

## Décision
On adapte le visuel **strictement par rôle** : chaque persona ne voit QUE ses outils.

| Outil | Grand public | Étudiant | Professionnel | Admin |
|---|:---:|:---:|:---:|:---:|
| Chat santé | ✅ | ✅ | ✅ | ✅ |
| Analyse de document | ✅ | — | — | ✅ |
| ECOS | — | ✅ | — | ✅ |
| Analyseur de partiel | — | ✅ | — | ✅ |
| Audio (compte rendu) | — | — | ✅ | ✅ |

Source de vérité unique : `src/ai/routing/featureVisibility.ts` (module pur, testé). Application :
barre d'onglets `app/(chat)/_layout.tsx` (`href: null` pour masquer), garde d'écran
`src/ui/RoleGate.tsx` sur chaque outil, et section « Mes outils » de l'écran Compte.

## Conséquences
- UI lisible et orientée audience ; le grand public ne voit plus les outils étudiant/pro et inversement.
- **Le masquage UI n'est jamais l'unique barrière de sécurité** : l'autorisation réelle reste dérivée
  du profil vérifié côté serveur (`serverPersona.ts`, garde persona des routes IA). Le gel des features
  cliniques pro (ADR-0006) n'est pas levé : l'onglet Audio reste un outil de productivité non clinique.
- L'admin court-circuite la matrice (accès à tout pour gestion/test).

## Rollback
Rendre `isFeatureVisible` toujours `true` (retour à l'affichage de tous les onglets). Aucun impact
schéma/serveur — la matrice est purement côté présentation.
