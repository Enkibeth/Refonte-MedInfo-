import type { RagChunk } from '../types';

/**
 * Petit corpus MVP étape 5 — sources officielles françaises uniquement.
 * Les contenus sont des résumés courts/attribués, pas une copie intégrale des documents.
 */
export const MVP_RAG_CHUNKS: RagChunk[] = [
  {
    chunk_id: 'has-dt2-parcours-2025-prevention-001',
    parent_doc_id: 'has-dt2-parcours-2025',
    title: 'Parcours de soins du patient adulte vivant avec un diabète de type 2',
    emitter: 'HAS',
    section_path: 'Mesure de prévention en cas de prédiabète',
    source_url:
      'https://www.has-sante.fr/jcms/p_3634754/fr/parcours-de-soins-du-patient-adulte-vivant-avec-un-diabete-de-type-2',
    publication_date: '2025-07-16',
    has_grade: 'NA',
    edn_item_id: '245',
    edn_rang: 'A',
    specialty: 'Endocrinologie-diabétologie',
    license: 'HAS réutilisation publique avec attribution',
    validation_hash: 'sha256:34b359eb773d1b10927eb31e1c0127e7c73aa7863622505dae1c3c5a90b5b6d8',
    content:
      "La HAS décrit le parcours de soins de l'adulte vivant avec un diabète de type 2. En cas de prédiabète, elle recommande une sensibilisation au risque de diabète de type 2 ultérieur, des mesures de prévention centrées sur le mode de vie et une surveillance annuelle.",
  },
  {
    chunk_id: 'has-dt2-parcours-2025-prise-en-charge-002',
    parent_doc_id: 'has-dt2-parcours-2025',
    title: 'Parcours de soins du patient adulte vivant avec un diabète de type 2',
    emitter: 'HAS',
    section_path: 'Prise en charge thérapeutique globale',
    source_url:
      'https://www.has-sante.fr/jcms/p_3634754/fr/parcours-de-soins-du-patient-adulte-vivant-avec-un-diabete-de-type-2',
    publication_date: '2025-07-16',
    has_grade: 'NA',
    edn_item_id: '245',
    edn_rang: 'A',
    specialty: 'Endocrinologie-diabétologie',
    license: 'HAS réutilisation publique avec attribution',
    validation_hash: 'sha256:1794022af3a7f42803bf92030696d26a0ccd53e705e1ab1ff893f955ccb096f8',
    content:
      "La HAS place la prise en charge non médicamenteuse au premier plan après le bilan initial du diabète de type 2 : diminution de la sédentarité, activité physique régulière et plan de soins diététique personnalisé sans restriction alimentaire excessive.",
  },
  {
    chunk_id: 'has-obesite-adulte-parcours-2023-001',
    parent_doc_id: 'has-obesite-adulte-parcours-2023',
    title: "Guide du parcours de soins : surpoids et obésité de l'adulte",
    emitter: 'HAS',
    section_path: 'Parcours de soins et accompagnement',
    source_url: 'https://www.has-sante.fr/jcms/p_3408871/fr/guide-du-parcours-de-soins-surpoids-et-obesite-de-l-adulte',
    publication_date: '2023-02-09',
    has_grade: 'NA',
    edn_item_id: '251',
    edn_rang: 'A',
    specialty: 'Nutrition',
    license: 'HAS réutilisation publique avec attribution',
    validation_hash: 'sha256:3c4c3db9e3cc6c78217310d069185a07d42b6fe0bd487698f21626f4bb855a79',
    content:
      "La HAS présente le surpoids et l'obésité de l'adulte comme des situations nécessitant une évaluation globale, un accompagnement gradué et une coordination entre professionnels selon les besoins, sans réduire la prise en charge au seul poids.",
  },
  {
    chunk_id: 'ansm-ains-bon-usage-2013-001',
    parent_doc_id: 'ansm-ains-bon-usage-2013',
    title: 'Rappel des règles de bon usage des anti-inflammatoires non stéroïdiens',
    emitter: 'ANSM',
    section_path: 'Lors de la prescription',
    source_url: 'https://ansm.sante.fr/uploads/2021/01/07/rappel-bonusageains130821.pdf',
    publication_date: '2013-07-01',
    has_grade: 'NA',
    edn_item_id: '326',
    edn_rang: 'A',
    specialty: 'Pharmacologie',
    license: 'ANSM réutilisation publique avec attribution',
    validation_hash: 'sha256:b4134a91ce4fffa113e12675d46e9a6968b9d6f74ac2a8e600e70c0e65bb91e8',
    content:
      "L'ANSM rappelle que les anti-inflammatoires non stéroïdiens doivent être utilisés à la dose minimale efficace et pendant la durée la plus courte possible. Elle insiste sur le respect des indications, l'information sur les risques et les contre-indications.",
  },
];
