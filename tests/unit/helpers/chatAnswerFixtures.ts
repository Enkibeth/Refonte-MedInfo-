/**
 * Réponses de chat SYNTHÉTIQUES reproduisant la forme réellement émise par les modèles
 * (relevée en recette le 2026-09-27 sur GPT-6 Luna) : titres de section en markdown
 * (`### SOURCES`), espaces de fin de ligne (écrits `\x20` pour rester visibles), citations en liens markdown avec
 * `utm_source`, groupes `(SRC1, SRC2)`, relances étudiantes APRÈS la section SOURCES.
 * Le contenu est volontairement neutre (aucune donnée médicale, aucune vraie référence) :
 * seule la FORME est testée.
 */

/** Chatbot étudiant, format prompt v4 tel que produit : relances après SOURCES. */
export const STUDENT_REAL_FORMAT = `## Titre de test

Résumé de test en deux phrases (SRC1). Seconde phrase de test.

### Fiche mémo

- **Premier point de test.**
- Deuxième point de test (SRC1, SRC2)

### FIABILITÉ

- **Statut : SOURCÉ.**
- **Limites :** limites de test.

### SOURCES

SRC1 :: [GUIDELINE] Organisme :: Auteurs A :: Titre de test un :: 2021\x20\x20
https://example.org/un\x20\x20
Justification : première justification de test.

SRC2 :: [GUIDELINE] Organisme :: Auteurs B :: Titre de test deux :: 2022\x20\x20
https://example.org/deux\x20\x20
Justification : seconde justification de test.

1. Première question de relance ?
2. Deuxième question de relance ?
3. Troisième question de relance ?

[1] + [2] + [3]`;

/** Chatbot grand public : citations en liens markdown, un lien répété, sections finales. */
export const PUBLIC_REAL_FORMAT = `TITRE DE TEST

RÉPONSE SIMPLE

Premier paragraphe de test avec une source ([exemple.org](https://example.org/a?utm_source=openai)).

Deuxième paragraphe de test avec **du gras** et une autre source ([exemple.net](https://example.net/b?utm_source=openai)).

À RETENIR

- Premier point à retenir.
- Second point à retenir.

Niveau de preuve : phrase de test ([exemple.org](https://example.org/a?utm_source=openai))

SOURCES

SRC1 :: [OFFICIEL] Organisme :: Organisme :: Titre de test :: 2025
https://example.org/a
Justification : justification de test.

APPROFONDISSEMENTS
1. Titre un :: Description un. :: Question un ?
2. Titre deux :: Description deux. :: Question deux ?
3. Titre trois :: Description trois. :: Question trois ?

INTERACTION
[Option A]
[Option B]

AUTO-RÉFLEXION
- Niveau de preuve global : test
- Limites principales : test`;

/** Chatbot professionnel : grade + source, tableau, marqueur CALC sur sa ligne avant SOURCES. */
export const PRO_FORMAT = `## Titre de test

Paragraphe de test (Classe I · SRC1).

| Critère | Valeur |
|---|---|
| Ligne A | 1 (SRC1) |
| Ligne B | 2 |

Dernier paragraphe de test.

<!--CALC:chads-->

SOURCES
SRC1 :: Organisme :: Organisme :: Titre de test :: 2024
https://example.org/pro

APPROFONDISSEMENTS
1. Titre :: Description. :: Question ?`;

/** Relances étudiantes dans le corps, sans section finale (format dégradé). */
export const STUDENT_BODY_FOLLOWUPS = `Réponse courte de test.

1. Question A ?
2. Question B ?
3. Question C ?

[1] + [2] + [3]`;

export const CHAT_ANSWER_FIXTURES = {
  STUDENT_REAL_FORMAT,
  PUBLIC_REAL_FORMAT,
  PRO_FORMAT,
  STUDENT_BODY_FOLLOWUPS,
} as const;
