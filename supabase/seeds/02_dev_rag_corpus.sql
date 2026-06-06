-- Seed RAG dev généré par supabase/seeds/generate-rag-seed.mjs (deterministic).
-- Source de vérité : src/rag/corpus/*.json. Ne pas éditer à la main.
-- Aucune donnée utilisateur ni donnée de santé identifiable.

insert into public.rag_sources (id, title, emitter, source_url, publication_date, license)
values
  ('ameli-vaccination-2026', 'Vaccination : pour les enfants et les adultes aussi', 'ameli.fr', 'https://www.ameli.fr/assure/sante/assurance-maladie/campagnes-vaccination/calendrier-vaccinations-adulte-enfant', '2026-04-28', 'ameli.fr réutilisation publique avec attribution'),
  ('ansm-ains-bon-usage-2013', 'Rappel des règles de bon usage des anti-inflammatoires non stéroïdiens', 'ANSM', 'https://ansm.sante.fr/uploads/2021/01/07/rappel-bonusageains130821.pdf', '2013-07-01', 'ANSM réutilisation publique avec attribution'),
  ('ansm-antibiotiques-bon-usage-2023', 'Préserver l’efficacité des antibiotiques en améliorant le bon usage', 'ANSM', 'https://ansm.sante.fr/uploads/2023/12/19/20231219-recommandations-bon-usage-des-antibiotiques.pdf', '2023-12-19', 'ANSM réutilisation publique avec attribution'),
  ('ansm-grossesse-medicaments-2021', 'Médicaments et grossesse : les bons réflexes', 'ANSM', 'https://ansm.sante.fr/uploads/2021/06/01/grossesse-medic-gd-public-web-v14-2.pdf', '2021-06-01', 'ANSM réutilisation publique avec attribution'),
  ('has-dt2-parcours-2025', 'Parcours de soins du patient adulte vivant avec un diabète de type 2', 'HAS', 'https://www.has-sante.fr/jcms/p_3634754/fr/parcours-de-soins-du-patient-adulte-vivant-avec-un-diabete-de-type-2', '2025-07-16', 'HAS réutilisation publique avec attribution'),
  ('has-hta-adulte-2016', 'Prise en charge de l’hypertension artérielle de l’adulte', 'HAS', 'https://www.has-sante.fr/jcms/c_2059286/fr/prise-en-charge-de-l-hypertension-arterielle-de-l-adulte', '2016-10-27', 'HAS réutilisation publique avec attribution'),
  ('has-obesite-adulte-parcours-2023', 'Guide du parcours de soins : surpoids et obésité de l''adulte', 'HAS', 'https://www.has-sante.fr/jcms/p_3408871/fr/guide-du-parcours-de-soins-surpoids-et-obesite-de-l-adulte', '2023-02-09', 'HAS réutilisation publique avec attribution'),
  ('has-tabac-sevrage-2014', 'Arrêter de fumer et ne pas rechuter : la recommandation 2014 de la HAS', 'HAS', 'https://www.has-sante.fr/jcms/c_1719643/fr/arreter-de-fumer-et-ne-pas-rechuter-la-recommandation-2014-de-la-has', '2014-01-21', 'HAS réutilisation publique avec attribution')
on conflict (id) do update set
  title = excluded.title,
  emitter = excluded.emitter,
  source_url = excluded.source_url,
  publication_date = excluded.publication_date,
  license = excluded.license;

insert into public.rag_chunks (
  chunk_id,
  parent_doc_id,
  section_path,
  content,
  has_grade,
  edn_item_id,
  edn_rang,
  specialty,
  license,
  validation_hash
)
values
  ('ameli-vaccination-2026-adultes-002', 'ameli-vaccination-2026', 'Vaccination des adultes et rattrapage', 'Pour les adultes, Ameli souligne l’importance de vérifier les rappels et les rattrapages vaccinaux, notamment diphtérie-tétanos-poliomyélite, coqueluche, ROR et vaccinations saisonnières ou ciblées. Le point vaccinal peut être réalisé avec les professionnels habilités selon les recommandations en vigueur.', 'NA', '143', 'A', 'Santé publique', 'ameli.fr réutilisation publique avec attribution', 'sha256:c99a00dff75cfa13a1b586e587de14bcac9926c3eaf8cae49720adc8d47cba61'),
  ('ameli-vaccination-2026-calendrier-001', 'ameli-vaccination-2026', 'Calendrier vaccinal et protection collective', 'Ameli rappelle que le calendrier des vaccinations est actualisé chaque année après avis de la HAS et fixe les vaccinations obligatoires ou recommandées selon l’âge. La vaccination protège la personne vaccinée et contribue à réduire la circulation de maladies infectieuses graves dans la population.', 'NA', '143', 'A', 'Santé publique', 'ameli.fr réutilisation publique avec attribution', 'sha256:110686c765b659a2b6d713c1fe6cb96179faced650915a54d3ffa6b2b3b4b442'),
  ('ansm-ains-bon-usage-2013-001', 'ansm-ains-bon-usage-2013', 'Lors de la prescription', 'L''ANSM rappelle que les anti-inflammatoires non stéroïdiens doivent être utilisés à la dose minimale efficace et pendant la durée la plus courte possible. Elle insiste sur le respect des indications, l''information sur les risques et les contre-indications.', 'NA', '326', 'A', 'Pharmacologie', 'ANSM réutilisation publique avec attribution', 'sha256:b4134a91ce4fffa113e12675d46e9a6968b9d6f74ac2a8e600e70c0e65bb91e8'),
  ('ansm-antibiotiques-bon-usage-2023-prescription-002', 'ansm-antibiotiques-bon-usage-2023', 'Principes de juste prescription', 'Pour préserver l’efficacité des antibiotiques, l’ANSM recommande de mieux prévenir les infections, d’éviter les prescriptions lorsqu’elles ne sont pas indiquées, de privilégier l’antibiotique le plus adapté et de respecter posologies et durées. L’information du patient inclut l’absence d’intérêt des antibiotiques dans les infections virales.', 'NA', '173', 'A', 'Infectiologie', 'ANSM réutilisation publique avec attribution', 'sha256:ca5a2e3bbba73c8883b06605833d3596eb48c1f47070cf9cc4da8c587043ac66'),
  ('ansm-antibiotiques-bon-usage-2023-resistance-001', 'ansm-antibiotiques-bon-usage-2023', 'Antibiorésistance et santé publique', 'L’ANSM présente l’antibiorésistance comme un enjeu majeur de santé publique : l’exposition aux antibiotiques sélectionne des bactéries résistantes, transmissibles en ville comme à l’hôpital. Les antibiotiques traitent les infections bactériennes, mais ne sont pas efficaces contre les virus ou les champignons.', 'NA', '173', 'A', 'Infectiologie', 'ANSM réutilisation publique avec attribution', 'sha256:19c1e67674e40be0481cc2ae9be93b73711b9122de17bce80e47f1b48ed7b33a'),
  ('ansm-grossesse-medicaments-2021-pictogramme-001', 'ansm-grossesse-medicaments-2021', 'Pictogrammes grossesse et conseil professionnel', 'L’ANSM rappelle que la prise de médicaments pendant la grossesse doit être discutée avec un professionnel de santé, y compris pour les médicaments sans ordonnance. Les pictogrammes grossesse signalent un risque possible ou une interdiction, mais ne remplacent pas l’évaluation médicale du rapport bénéfice-risque.', 'NA', '26', 'A', 'Pharmacologie', 'ANSM réutilisation publique avec attribution', 'sha256:b7fcf3592c8aeff73d9b7daaffaabf888049c461c32d37aa5c9784144a79e09b'),
  ('has-dt2-parcours-2025-prevention-001', 'has-dt2-parcours-2025', 'Mesure de prévention en cas de prédiabète', 'La HAS décrit le parcours de soins de l''adulte vivant avec un diabète de type 2. En cas de prédiabète, elle recommande une sensibilisation au risque de diabète de type 2 ultérieur, des mesures de prévention centrées sur le mode de vie et une surveillance annuelle.', 'NA', '245', 'A', 'Endocrinologie-diabétologie', 'HAS réutilisation publique avec attribution', 'sha256:34b359eb773d1b10927eb31e1c0127e7c73aa7863622505dae1c3c5a90b5b6d8'),
  ('has-dt2-parcours-2025-prise-en-charge-002', 'has-dt2-parcours-2025', 'Prise en charge thérapeutique globale', 'La HAS place la prise en charge non médicamenteuse au premier plan après le bilan initial du diabète de type 2 : diminution de la sédentarité, activité physique régulière et plan de soins diététique personnalisé sans restriction alimentaire excessive.', 'NA', '245', 'A', 'Endocrinologie-diabétologie', 'HAS réutilisation publique avec attribution', 'sha256:1794022af3a7f42803bf92030696d26a0ccd53e705e1ab1ff893f955ccb096f8'),
  ('has-hta-adulte-2016-confirmation-001', 'has-hta-adulte-2016', 'Confirmation du diagnostic d’HTA', 'La HAS recommande de confirmer l’hypertension artérielle avant d’instaurer un traitement antihypertenseur, sauf urgence hypertensive. La confirmation repose sur des mesures hors cabinet, par automesure tensionnelle ou mesure ambulatoire de la pression artérielle, afin de limiter les erreurs de classement.', 'NA', '224', 'A', 'Cardiologie', 'HAS réutilisation publique avec attribution', 'sha256:d9208e1ab9cd810e958e6cf1d626013d328bd4d7d295fdfbaf4f954e7ffa67f7'),
  ('has-hta-adulte-2016-suivi-002', 'has-hta-adulte-2016', 'Suivi et adhésion thérapeutique', 'Dans le suivi de l’hypertension contrôlée, la HAS décrit une consultation régulière centrée sur la pression artérielle, la tolérance, l’adhésion au traitement et les mesures hygiéno-diététiques. Les contrôles biologiques et l’ECG sont adaptés au contexte clinique et aux comorbidités.', 'NA', '224', 'A', 'Cardiologie', 'HAS réutilisation publique avec attribution', 'sha256:55992b439d15fc43565ed2b8dc61a23070e4b871dadf7da062b5b22cbe162c7b'),
  ('has-obesite-adulte-parcours-2023-001', 'has-obesite-adulte-parcours-2023', 'Parcours de soins et accompagnement', 'La HAS présente le surpoids et l''obésité de l''adulte comme des situations nécessitant une évaluation globale, un accompagnement gradué et une coordination entre professionnels selon les besoins, sans réduire la prise en charge au seul poids.', 'NA', '251', 'A', 'Nutrition', 'HAS réutilisation publique avec attribution', 'sha256:3c4c3db9e3cc6c78217310d069185a07d42b6fe0bd487698f21626f4bb855a79'),
  ('has-tabac-sevrage-2014-depistage-001', 'has-tabac-sevrage-2014', 'Dépistage et conseil d’arrêt', 'La HAS place le médecin traitant et les professionnels de premier recours au cœur de l’aide à l’arrêt du tabac. Le repérage systématique du statut tabagique, l’évaluation de la dépendance et de la motivation, puis un conseil clair d’arrêt structurent l’entrée dans le parcours de sevrage.', 'NA', '73', 'A', 'Addictologie', 'HAS réutilisation publique avec attribution', 'sha256:946e6d0a0e131b2ba877439f42b26d8e3371c94d9c4b49ac39f7d265fc277b30'),
  ('has-tabac-sevrage-2014-traitements-002', 'has-tabac-sevrage-2014', 'Accompagnement et traitements de sevrage', 'Selon la HAS, le suivi dédié associe soutien psychologique, conseils personnalisés et suivi médical pour favoriser l’arrêt du tabac et prévenir les rechutes. Les substituts nicotiniques constituent un traitement de première intention, tandis que la varénicline et le bupropion relèvent d’une seconde intention.', 'NA', '73', 'A', 'Addictologie', 'HAS réutilisation publique avec attribution', 'sha256:b47e310ac7a3e3d68e08a6b844f022b5369cedb948d6a76e3954b63aed0b41b8')
on conflict (chunk_id) do update set
  parent_doc_id = excluded.parent_doc_id,
  section_path = excluded.section_path,
  content = excluded.content,
  has_grade = excluded.has_grade,
  edn_item_id = excluded.edn_item_id,
  edn_rang = excluded.edn_rang,
  specialty = excluded.specialty,
  license = excluded.license,
  validation_hash = excluded.validation_hash;
