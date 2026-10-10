# ADR-0046 — Chat : répondre d'abord, prendre position, trame pathologie

- Date : 2026-10-10
- Statut : Accepted (demande de Hugo : « réponses trop orientées vers poser des questions,
  aucune prise de décision, non informatives sur la pathologie »)

## Contexte

Mesures en production (30-60 derniers jours, comptages sans lecture de contenu) :
- chat grand public : 2 premières réponses sur 2 = formulaire `QUESTIONS_PATIENT` seul
  (« POUR MIEUX VOUS AIDER »), ~690 tokens de sortie en moyenne ;
- chat étudiant : ~1 000 tokens de sortie en moyenne, réflexion comprise, pour un prompt
  qui exige pourtant une réponse « exhaustive » ;
- chat professionnel : ~3 350 tokens, mais la règle « clarifier si une donnée manque »
  laissait le modèle questionner au lieu de trancher.

Cause principale : le prompt public imposait un RECUEIL MINIMUM OBLIGATOIRE (« si ces données
manquent, tu ne réponds pas : tu utilises QUESTIONS_PATIENT »). Aucun override en base
(`ai_prompts` vide) : les prompts du dépôt sont bien ceux servis.

## Décision

Modification des trois prompts produit, sans changement de code ni de modèle :
1. **Répondre d'abord** : toujours une réponse de fond au premier message ; si une donnée
   manque, réponse pour le cas le plus fréquent + ce qui change selon le profil ; les
   questions viennent en FIN de réponse pour affiner, jamais à la place. Seule exception :
   message sans aucun sujet identifiable (une phrase, pas de formulaire).
2. **Prendre position** : hypothèses hiérarchisées (la plus fréquente d'abord, la grave à ne
   pas manquer), première intention énoncée clairement ; pro : « Conduite recommandée » en
   tête, raisonnement par branches si/alors au lieu d'une question de clarification.
3. **Trame pathologie** dès qu'une maladie est en jeu : définition, épidémiologie,
   physiopathologie, symptômes/diagnostic positif, diagnostics différentiels, évolution et
   complications, prise en charge/traitement, prévention (+ pièges EDN pour l'étudiant,
   « quand consulter / 15 » pour le grand public). Pro : niveau 2 minimum pour ces questions.

Invariants figés par `tests/unit/chat-prompts-answer-first.test.ts` (absence du verrou,
présence de la trame, titres compatibles avec `parseAssistantMessage`).

## Addendum 2026-10-10 — deux boucles de vérification sur sorties réelles

Banc de 13 questions (7 pro, 3 étudiant, 3 public) sur gpt-6-luna, assemblage du `system`
identique à `/api/chat` (mode Classique). Boucle 1 : plus de questionnaire seul, mais le chat
pro restait VAGUE (« un score validé », « aucune posologie ne peut être proposée », triage
« indéterminé », ancienneté d'ESC 2019 mise en avant) et ignorait la trame ; INTERACTION
obligatoire = 5-6 questions en fin de réponse. Causes : règle d'abstention lue comme globale,
triage imposé même sans cas, seuil de fraîcheur, INTERACTION obligatoire. Corrections pro :
règle SPÉCIFICITÉ CLINIQUE (scores nommés avec seuils, DCI + schéma usuel de l'adulte sourcé,
branches au lieu de « données manquantes »), abstention bornée à la VALEUR introuvable,
triage seulement si un cas est décrit, recommandation en vigueur = référence quelle que soit sa
date (ancienneté signalée dans AUTO-REFLEXION seulement), trame à intitulés exacts,
INTERACTION facultative (≤ 2 questions décisionnelles), « Conduite recommandée » même sans
indication (situation la plus fréquente d'abord). Étudiant : démarche de clinicien, jamais de
conseils grand public. Public : trame complète dès qu'une maladie est nommée, références
`(SRCx)` sans crochets ni lien dans le corps.

Boucle 2 : pro → trame 6-7/7 sur les questions de pathologie, « Conduite recommandée » 4/4,
3 questions de fin (approfondissements) au lieu de 5-6, schémas AOD chiffrés et justes
(apixaban 10 mg ×2 7 j puis 5 mg ×2 ; rivaroxaban 15 mg ×2 21 j puis 20 mg ; ≥ 3 mois).
Latence pro ~25-35 s (contre ~20-27 s) pour des réponses plus complètes.

## Addendum 2026-10-10 (2) — plus de réponse ni de conversation coupée

Décision Hugo : « aucune limite, au moins 10-15 000 tokens ».
- Budget de RÉPONSE `CHAT_ANSWER_TOKEN_BUDGET = 16 000` (`src/ai/chat/responseMode.ts`) pour
  Approfondi et Rapide (auparavant 4 096 et 3 000), réserve de réflexion en plus. Classique ne
  fixe toujours aucun plafond (128 000 pour gpt-6-luna). Les zones de coupure réelles étaient
  l'Approfondi grand public (4 096 + 4 096 de réserve) et le Rapide (3 000) ; l'Approfondi
  pro/étudiant disposait déjà de 32 768 au total. Mesure réelle (Approfondi) : 12 900 et
  14 100 tokens de sortie, ~18 000 caractères, `finish = stop`, en 2,5 min environ.
- Historique : l'ADR-0045 REFUSAIT la requête au-delà de 120 000 caractères (413). Avec les
  réponses longues, une conversation pro se bloquait en quelques échanges. Désormais
  `fitHistoryToBudget` (`src/ai/chat/modelHistory.ts`) garde les messages les plus récents dans
  un budget de 240 000 caractères / 100 messages : la conversation continue, les échanges les
  plus anciens sont oubliés par le modèle. Refus seulement si le dernier message seul dépasse.
  Le plafond d'essai invité compte toujours les messages BRUTS du client (non contournable).

## Conservé

Signes sentinelles et orientation 15/112 en tête, pas de diagnostic certain, pas de posologie
détaillée pour le grand public, sources obligatoires, anti-hallucination, cloisonnement des
chatbots par persona.

## Conséquences et points de vigilance

- Réponses plus longues → coût et latence en hausse (attendu ; à suivre dans l'onglet Coûts).
  Le mode Approfondi plafonne la réponse visible à 4 096 tokens : surveiller les réponses
  tronquées sur les trames complètes du chat pro/étudiant.
- Grand public : hiérarchiser « ce qui est le plus fréquent dans ce type de tableau » rapproche
  la réponse d'une orientation. La formulation reste populationnelle (« en général »), jamais
  un diagnostic pour la personne ; à réexaminer lors de la réintroduction de la sécurité
  (ADR-0024, `docs/01_REGULATION.md`).
- Validation réelle à faire sur quelques questions types (pathologie, symptôme, résultat)
  dans chacun des trois chats après déploiement.
