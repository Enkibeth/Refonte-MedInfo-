-- Migration 0038 — Nettoyage des cas ECOS de démonstration antérieurs.
--
-- Décision Hugo (2026-07-15) : ne garder que les 15 stations « Annales 2024 »
-- (migration 0037, source de vérité data/ecos-cases.json). On supprime donc les cas
-- de démonstration seedés auparavant (placeholder de la migration 0013 + corpus de
-- démo appliqué sur le projet) qui n'appartiennent pas à ce corpus.
--
-- Idempotent : DELETE par slug (une ligne absente = no-op). Sur une base neuve, 0013
-- insère ses 4 placeholders, 0037 insère les 15 stations, puis ce DELETE retire les
-- placeholders → il ne reste que les 15 stations. Aucune donnée de santé (cas fictifs).
-- Les passages archivés (ecos_attempts) référencent le slug en texte (pas de clé
-- étrangère) : l'historique des notes des étudiants est conservé.

delete from public.ecos_cases
where slug in (
  'acidocetose-diabetique',
  'douleur-thoracique',
  'cephalees-febriles',
  'dyspnee-aigue',
  'douleur-abdominale',
  'douleur-abdominale-geu',
  'exacerbation-bpco',
  'avc-ischemique',
  'syndrome-depressif',
  'convulsions-febriles-pediatrie',
  'colique-nephretique',
  'hemorragie-digestive-haute',
  'arthrite-septique',
  'erysipele-cellulite',
  'pneumothorax-spontane',
  'fracture-hanche-personne-agee',
  'crise-angoisse'
);
