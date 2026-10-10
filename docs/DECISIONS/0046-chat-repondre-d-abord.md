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
