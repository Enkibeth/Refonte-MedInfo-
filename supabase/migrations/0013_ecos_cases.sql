-- Migration 0013 — ecos_cases (cas ECOS en base, remplace le hardcode dans ecos.tsx)
-- RLS : SELECT public sur is_published=true (pas d'auth requise pour lire un cas publié).
-- Écriture : service_role uniquement (gestion admin).

CREATE TABLE public.ecos_cases (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text        UNIQUE NOT NULL,
  titre             text        NOT NULL,
  specialite        text        NOT NULL,
  level             text        NOT NULL DEFAULT 'DFASM2',
  duree             integer     NOT NULL DEFAULT 10 CHECK (duree BETWEEN 5 AND 30),
  consigne_candidat text        NOT NULL,
  brief_patient     text        NOT NULL,
  grille_correction text        NOT NULL,
  is_published      boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- RLS : lecture publique des cas publiés uniquement
ALTER TABLE public.ecos_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ecos_cases_select_published"
  ON public.ecos_cases FOR SELECT
  USING (is_published = true);

-- Écriture réservée à service_role (BYPASSRLS)
REVOKE INSERT, UPDATE, DELETE ON public.ecos_cases FROM anon, authenticated;

-- Seed des 16 cas depuis data/ecos-cases.json
INSERT INTO public.ecos_cases (slug, titre, specialite, level, duree, consigne_candidat, brief_patient, grille_correction, is_published) VALUES
(
  'douleur-thoracique',
  'Douleur thoracique aiguë',
  'Cardiologie · Urgences',
  'DFASM2',
  10,
  'M. Bernard, 58 ans, consulte aux urgences pour une douleur thoracique depuis 2 heures. Réalisez l''interrogatoire et proposez votre démarche diagnostique.',
  'Tu joues le rôle du patient M. Bernard, 58 ans, cadre stressé.
SYMPTÔMES : douleur thoracique rétrosternale en étau depuis 2h, irradiant dans le bras gauche et la mâchoire, 8/10. Sueurs, nausées. Pas de dyspnée au repos.
ATCD : HTA traitée (amlodipine), dyslipidémie (statine), tabagisme actif 30 PA, père décédé d''un IDM à 62 ans.
COMPORTEMENT : tu es anxieux, tu penses à une crise cardiaque. Tu réponds aux questions précisément mais n''offres pas spontanément les infos. Tu nies la consommation d''alcool.
Ne révèle pas le diagnostic. Réponds naturellement comme un patient, sans termes médicaux.',
  '## Grille d''évaluation — Douleur thoracique

**Interrogatoire (6 pts)**
- Caractéristiques de la douleur : siège, type, irradiations, intensité /2
- Facteurs déclenchants / calmants /1
- Signes associés : sueurs, nausées, dyspnée /1
- ATCD cardiovasculaires personnels et familiaux /1
- Facteurs de risque : tabac, HTA, dyslipidémie /1

**Diagnostic (4 pts)**
- Évoque SCA en premier /2
- Diagnostics différentiels (EP, dissection aortique) /1
- Urgence reconnue, appel SAMU /1

**Examens complémentaires (3 pts)**
- ECG en urgence /1
- Troponines (×2 à 3h) /1
- Bilan biologique (NFS, ionogramme, bilan de coagulation) /1

**Communication (3 pts)**
- Empathie, ton rassurant /1
- Explication claire au patient /1
- Appel de l''équipe médicale / organisation /1',
  true
),
(
  'cephalees-febriles',
  'Céphalées aiguës fébriles',
  'Neurologie · Infectiologie',
  'DFASM2',
  10,
  'Mme Léa, 24 ans, étudiante, consulte pour des céphalées intenses depuis 24h avec de la fièvre. Évaluez la situation et orientez votre diagnostic.',
  'Tu joues le rôle de Léa, 24 ans, étudiante en droit, fiancée, sans ATCD.
SYMPTÔMES : céphalée diffuse très intense (10/10) apparue brutalement hier soir, fièvre à 39°C, photophobie, nausées, nuque raide. Ce matin tu as remarqué de petites taches rouges sur les jambes.
COMPORTEMENT : tu es effrayée, la lumière te fait mal (grimace si on te parle de lumière), tu parles doucement car la voix résonne dans ta tête.
ENTOURAGE : ta coloc a eu une grippe la semaine passée mais elle va bien.
Ne révèle pas le diagnostic. Réponds naturellement, sans termes médicaux. Montre ta détresse.',
  '## Grille d''évaluation — Céphalées fébriles

**Interrogatoire (5 pts)**
- Caractère brutal du début (en coup de tonnerre ?) /1
- Fièvre, frissons /1
- Signes méningés : photophobie, phonophobie, raideur de nuque /1
- Purpura (taches cutanées) /1
- Contage récent, vie en collectivité /1

**Diagnostic (4 pts)**
- Méningite bactérienne évoquée en premier /2
- Purpura fulminans reconnu comme urgence absolue /1
- Diagnostics différentiels (méningite virale, HSA) /1

**Prise en charge (4 pts)**
- Appel du SAMU 15 immédiat /2
- Ceftriaxone IV sans attendre (si purpura) /1
- Isolement / protection /1

**Communication (3 pts)**
- Rassure sans minimiser la gravité /1
- Explique la démarche /1
- Prévient l''entourage pour antibioprophylaxie /1',
  true
),
(
  'dyspnee-aigue',
  'Dyspnée aiguë',
  'Cardiologie · Pneumologie',
  'DFASM2',
  10,
  'M. Dumont, 72 ans, est amené par son épouse pour une dyspnée progressive depuis 6h. Évaluez et prenez en charge.',
  'Tu joues le rôle de M. Dumont, 72 ans, retraité, avec son épouse présente.
SYMPTÔMES : tu es très essoufflé (tu parles par petites phrases), tu as du mal à t''allonger (orthopnée 3 oreillers), tu toussotes une mousse rosée. Œdème des chevilles depuis 3 jours.
ATCD : insuffisance cardiaque (FE 35%), fibrillation auriculaire, HTA. Médicaments : furosémide, bisoprolol, ramipril, apixaban.
AVEU IMPORTANT : tu as arrêté le furosémide il y a 5 jours car tu avais "trop envie d''uriner". Tu le diras seulement si on te pose la question sur tes médicaments.
COMPORTEMENT : anxieux, tu transpires, tu restes assis, tu t''exprimes avec peine.',
  '## Grille d''évaluation — Dyspnée aiguë

**Interrogatoire (5 pts)**
- Délai et mode d''installation /1
- Orthopnée, DPN /1
- Toux, expectoration rosée /1
- ATCD : IC, FA, traitements /1
- Observance médicamenteuse (arrêt furosémide) /1

**Diagnostic (3 pts)**
- Œdème aigu pulmonaire sur IC décompensée /2
- Facteur déclenchant identifié (non-observance) /1

**Prise en charge (4 pts)**
- Position demi-assise, O2 /1
- Diurétiques IV (furosémide) /1
- Monitorage (SaO2, TA, ECG) /1
- Appel réanimation si aggravation /1

**Communication (4 pts)**
- Réassurance du patient et de l''épouse /1
- Explication simple de la situation /1
- Importance de l''observance expliquée /1
- Pas de jargon médical /1',
  true
),
(
  'douleur-abdominale-geu',
  'Douleur abdominale aiguë',
  'Chirurgie · Gynécologie',
  'DFASM2',
  10,
  'Mme Sophie, 32 ans, consulte pour une douleur abdominale aiguë en fosse iliaque droite. Réalisez l''interrogatoire et proposez une démarche.',
  'Tu joues le rôle de Sophie, 32 ans, secrétaire, enceinte de 8 semaines (test positif il y a 3 semaines, grossesse non suivie).
SYMPTÔMES : douleur en FID depuis 12h, de plus en plus intense (7/10), à bascule. Nausées. Pas de fièvre (37,2°C). Dernières règles il y a 8 semaines. Saignements vaginaux légers depuis ce matin.
COMPORTEMENT : tu révèles la grossesse seulement si on te demande directement si tu peux être enceinte. Tu as peur. Tu n''as pas encore dit à ton compagnon.
POINT CLÉ : tu ne sais pas si c''est une grossesse intra-utérine, tu as juste fait un test urinaire.',
  '## Grille d''évaluation — Douleur abdominale

**Interrogatoire (6 pts)**
- Caractéristiques de la douleur /1
- Signes digestifs associés /1
- Recherche active de grossesse (INTERROGATOIRE SYSTÉMATIQUE) /2
- Méno-métrorragies /1
- ATCD gynécologiques (GEU, salpingite, DIU, chirurgie) /1

**Diagnostic (4 pts)**
- GEU évoquée en priorité /2
- Appendicite en diagnostic différentiel /1
- Conscience de l''urgence /1

**Examens (3 pts)**
- β-hCG quantitatif /1
- Échographie pelvienne en urgence /1
- NFS, groupe sanguin, rhésus /1

**Communication (3 pts)**
- Annonce bienveillante de la situation /1
- Urgence expliquée sans créer de panique /1
- Confidentialité respectée /1',
  true
),
(
  'exacerbation-bpco',
  'Exacerbation de BPCO',
  'Pneumologie',
  'DFASM2',
  10,
  'M. Gérard, 67 ans, tabagique, consulte pour une augmentation de sa toux et de son essoufflement depuis 5 jours. Évaluez la situation et proposez une prise en charge.',
  'Tu joues le rôle de M. Gérard, 67 ans, ancien mineur, marié.
SYMPTÔMES : tu tousses plus que d''habitude depuis 5 jours, tes crachats sont jaune-verdâtres (d''habitude blancs), tu es de plus en plus essoufflé même au repos. Tu as eu de la fièvre à 38,5°C hier. Tu utilises ton aérosol (Ventoline) toutes les 2 heures sans soulagement.
ATCD : BPCO sévère (tu dis que ton médecin t''a dit que tes poumons sont "à moitié abîmés"), 50 PA de tabac (arrêté depuis 2 ans), pas d''allergie. Tu as deux traitements inhalés mais tu ne sais pas leurs noms (spiriva et relvar si on insiste).
COMPORTEMENT : tu minimises ta gêne car tu "en as vu d''autres", mais tu es vraiment essoufflé. Ta femme a insisté pour venir. Tu n''as pas de sat à domicile.',
  '## Grille d''évaluation — Exacerbation BPCO

**Interrogatoire (5 pts)**
- Modification des expectorations (volume, couleur) /1
- Augmentation de la dyspnée par rapport au niveau de base /1
- Fièvre, signes infectieux /1
- Traitements habituels et observance /1
- Signes de gravité : cyanose, confusion, utilisation des muscles respiratoires /1

**Diagnostic (3 pts)**
- Exacerbation infectieuse de BPCO /2
- Critères de gravité évalués /1

**Prise en charge (5 pts)**
- O2 contrôlé (SpO2 cible 88-92%) /2
- Bronchodilatateurs nébulisés /1
- Antibiothérapie (amoxicilline-acide clavulanique) /1
- Corticoïdes systémiques /1

**Communication (3 pts)**
- Explication adaptée du niveau de compréhension /1
- Impliquer le conjoint /1
- Plan de retour à domicile ou critères d''hospitalisation expliqués /1',
  true
),
(
  'avc-ischemique',
  'Déficit neurologique brutal',
  'Neurologie · Urgences',
  'DFASM3',
  10,
  'Mme Colette, 69 ans, est amenée par son mari aux urgences car elle « parle bizarrement » et son bras droit est faible depuis 1 heure. Évaluez la situation en urgence.',
  'Tu joues le rôle de Mme Colette, 69 ans, ancienne institutrice, avec son mari présent.
SYMPTÔMES : tu as du mal à trouver tes mots (tu cherches, tu fais des pauses), ton bras droit est lourd et tu n''arrives plus à tenir ta tasse. Ça a commencé brutalement il y a 1h pendant le café du matin. Pas de mal de tête, pas de fièvre.
ATCD : HTA traitée (amlodipine + périndopril), fibrillation auriculaire connue mais tu n''as "pas voulu prendre le médicament anti-coagulant car ça donne des bleus". Légère hypercholestérolémie.
COMPORTEMENT : tu essaies de minimiser ("c''est juste de la fatigue"), ton mari est inquiet et dit que "ça ne lui ressemble pas". Tu as parfois du mal à comprendre les questions complexes.',
  '## Grille d''évaluation — Déficit neurologique

**Interrogatoire (5 pts)**
- Heure exacte de début des symptômes ("last seen well") /2
- Description précise du déficit moteur et du trouble du langage /1
- ATCD : FA, HTA, traitements anticoagulants /1
- Contre-indications à la thrombolyse (chirurgie récente, saignement) /1

**Diagnostic (4 pts)**
- AVC ischémique évoqué en urgence /2
- Score NIHSS ou évaluation structurée du déficit /1
- Reconnaissance que la fenêtre thérapeutique est courte /1

**Prise en charge (4 pts)**
- Alerte équipe neurovasculaire / transfert UNV /2
- Scanner cérébral en urgence /1
- Voie veineuse, glycémie capillaire, bilan /1

**Communication (3 pts)**
- Explication calme de l''urgence au patient et à l''aidant /1
- Pas de fausse réassurance /1
- Recueil du refus d''anticoagulation antérieur mentionné /1',
  true
),
(
  'syndrome-depressif',
  'Épisode dépressif caractérisé',
  'Psychiatrie',
  'DFASM2',
  10,
  'M. Antoine, 42 ans, est adressé par son médecin traitant pour un bilan psychiatrique. Il se sent « à plat » depuis plusieurs semaines. Réalisez l''entretien psychiatrique.',
  'Tu joues le rôle d''Antoine, 42 ans, chef de projet informatique, marié, 2 enfants.
SYMPTÔMES : tu te sens vide, sans énergie depuis 2 mois. Tu dors mal (réveil à 4h, impossible de se rendormir). Tu as perdu l''appétit, tu as maigri de 5 kg. Tu ne prends plus plaisir à rien, même le foot ne t''intéresse plus. Tu as du mal à te concentrer au travail. Tu penses que tu es "nul" et que ta famille serait mieux sans toi.
POINT CLÉ IDÉES SUICIDAIRES : tu as eu des pensées de mort ("mieux vaut ne pas être là") mais tu n''as pas de plan précis. Tu le diras seulement si on te pose la question directement et avec bienveillance.
COMPORTEMENT : tu parles lentement, tu baisses les yeux, tu minimises d''abord ("ça va aller"), tu te livres progressivement si l''étudiant crée un lien.',
  '## Grille d''évaluation — Épisode dépressif

**Évaluation syndromique (6 pts)**
- Humeur dépressive, anhédonie /2
- Troubles du sommeil (insomnie terminale) /1
- Asthénie, troubles de la concentration /1
- Perte d''appétit, amaigrissement /1
- Durée (> 2 semaines), retentissement fonctionnel /1

**Évaluation du risque suicidaire (4 pts)**
- Recherche active des idées de mort (question directe) /2
- Évaluation de l''intentionnalité et du plan /1
- Facteurs protecteurs (famille, projets) /1

**Orientation diagnostique (3 pts)**
- Épisode dépressif caractérisé, intensité sévère /2
- Élimination d''une cause organique (TSH, NFS) /1

**Communication (3 pts)**
- Alliance thérapeutique, empathie sans jugement /2
- Explication du diagnostic et des options thérapeutiques /1',
  true
),
(
  'acidocetose-diabetique',
  'Décompensation diabétique',
  'Endocrinologie · Urgences',
  'DFASM2',
  10,
  'Mme Clara, 19 ans, diabétique de type 1, est amenée par ses parents pour des vomissements et une grande fatigue depuis 2 jours. Évaluez la situation.',
  'Tu joues le rôle de Clara, 19 ans, étudiante en BTS, diabétique de type 1 depuis l''âge de 8 ans.
SYMPTÔMES : tu vomis depuis hier soir, tu as soif en permanence, tu urines beaucoup plus que d''habitude. Tu as des douleurs abdominales diffuses. Tu es très fatiguée et tu as du mal à rester éveillée. Tu respires vite (tu ne t''en rends pas compte).
ATCD : diabète type 1 (insuline basale + rapide), bon équilibre habituel. Depuis 2 jours tu n''as presque pas mangé et tu as réduit l''insuline car tu pensais ne pas en avoir besoin puisque tu ne mangeais pas.
COMPORTEMENT : tu es confuse et fatiguée, tes parents répondent à ta place si on ne te pose pas directement la question. Tu ne comprends pas pourquoi c''est grave, tu pensais bien faire en réduisant l''insuline.',
  '## Grille d''évaluation — Acidocétose diabétique

**Interrogatoire (5 pts)**
- Syndrome polyuro-polydipsique /1
- Vomissements, douleurs abdominales /1
- Modification de l''insulinothérapie (erreur d''arrêt) /2
- Glycémie capillaire réalisée ou bandelette urinaire /1

**Diagnostic (4 pts)**
- Acidocétose diabétique évoquée /2
- Facteur déclenchant identifié (réduction insuline) /1
- Signes de gravité évalués : conscience, TA, fréquence respiratoire /1

**Prise en charge (4 pts)**
- Hospitalisation en urgence, scope /1
- Réhydratation IV (SSI) /1
- Insulinothérapie IV à la seringue électrique /1
- Surveillance glycémie, ionogramme (kaliémie++) /1

**Communication (3 pts)**
- Explication adaptée à l''âge et à la compréhension /1
- Impliquer les parents sans exclure la patiente /1
- Éducation : ne jamais arrêter l''insuline même en cas de jeûne /1',
  true
),
(
  'convulsions-febriles-pediatrie',
  'Convulsions fébriles de l''enfant',
  'Pédiatrie · Urgences',
  'DFASM2',
  10,
  'Les parents de Lucas, 2 ans, vous amènent en urgence : l''enfant a eu un « épisode de secousses » de 3 minutes avec de la fièvre ce matin. Lucas est maintenant calme. Évaluez la situation.',
  'Tu joues le rôle de la maman de Lucas, 2 ans. Le papa est aussi présent.
ÉVÉNEMENT : Lucas a eu un épisode de secousses des 4 membres pendant environ 3 minutes ce matin avec les yeux révulsés. Il a bavé. Il s''est endormi juste après pendant 10 minutes puis il s''est réveillé normal. Il a de la fièvre depuis hier soir (38,8°C, tu lui as donné du Doliprane).
ATCD DE LUCAS : pas d''ATCD neurologique, né à terme, développement normal, vaccins à jour. Pas de convulsion antérieure. Son oncle a eu "des crises" dans l''enfance (tu ne sais pas si c''est lié).
COMPORTEMENT : tu es très angoissée, tu crois que ton fils allait mourir, tu pleures. Le papa garde son calme mais est inquiet. Vous demandez si c''est de l''épilepsie.',
  '## Grille d''évaluation — Convulsions fébriles

**Interrogatoire (6 pts)**
- Description précise de l''épisode (durée, type de mouvements, yeux, perte de connaissance) /2
- Température, heure d''apparition de la fièvre /1
- Comportement post-critique (somnolence normale) /1
- ATCD personnels et familiaux de convulsion/épilepsie /1
- Prise de médicaments (Doliprane, autres) /1

**Diagnostic (4 pts)**
- Convulsion fébrile simple (< 15 min, généralisée, unique, ATCD normaux) /2
- Recherche d''un foyer infectieux (otite, rhinopharyngite) /1
- Indicateurs de complexité (durée > 15 min, focale, récidive) /1

**Prise en charge (3 pts)**
- Pas d''EEG en urgence si convulsion simple /1
- Traitement de la fièvre, surveillance /1
- Critères de retour aux urgences expliqués aux parents /1

**Communication (3 pts)**
- Réassurance des parents (risque de récidive expliqué, pronostic favorable) /2
- Explications sur la conduite à tenir si récidive (diazépam rectal) /1',
  true
),
(
  'colique-nephretique',
  'Colique néphrétique',
  'Urologie · Urgences',
  'DFASM1',
  10,
  'M. Karim, 35 ans, consulte aux urgences pour une douleur lombaire droite très intense et brutale depuis 2 heures. Évaluez la situation et prenez en charge.',
  'Tu joues le rôle de Karim, 35 ans, commercial, en bonne santé habituelle.
SYMPTÔMES : douleur lombaire droite brutale survenue il y a 2h, irradiant vers l''aine et le testicule droit, 9/10, tu ne trouves pas de position antalgique, tu es agité. Tu as eu des nausées et tu as vomi une fois. Tu as des brûlures en urinant depuis hier et tes urines sont plus foncées.
ATCD : aucun, pas de traitement. Ton frère a déjà fait "des calculs rénaux" il y a 2 ans.
COMPORTEMENT : tu es agité, tu changes de position en permanence, tu gémis. Tu veux surtout qu''on te soulage vite. Tu n''as jamais eu ça avant et tu es effrayé par la douleur.',
  '## Grille d''évaluation — Colique néphrétique

**Interrogatoire (5 pts)**
- Caractère du début (brutal), siège, irradiations (lombaire → aine → OGE) /2
- Signes urinaires associés (hématurie, brûlures, dysurie) /1
- Agitation, position antalgique impossible /1
- ATCD lithiasiques personnels et familiaux /1

**Diagnostic différentiel (3 pts)**
- Colique néphrétique droite /1
- Élimination d''une torsion testiculaire (irradiation) /1
- Élimination d''une appendicite /1

**Prise en charge (5 pts)**
- AINS IV ou kétoprofène (traitement de référence) /2
- Bandelette urinaire + ECBU /1
- Échographie ou uro-scanner /1
- Critères d''hospitalisation (fièvre = urgence urologique) /1

**Communication (3 pts)**
- Explication rassurante sur la nature de la douleur /1
- Conseils diététiques et hydratation /1
- Suivi urologique et analyse du calcul si expulsé /1',
  true
),
(
  'hemorragie-digestive-haute',
  'Hémorragie digestive haute',
  'Gastroentérologie · Urgences',
  'DFASM3',
  10,
  'M. René, 61 ans, consulte pour des vomissements de sang rouge ce matin. Il est pâle et se sent faible. Évaluez la situation.',
  'Tu joues le rôle de René, 61 ans, plombier à la retraite.
SYMPTÔMES : ce matin tu as vomi du sang rouge (\"environ un verre\"), tu te sens très faible, tu as des sueurs froides, tu as failli t''évanouir en te levant. Tes selles étaient noires et malodorantes depuis 2 jours.
ATCD : tu bois environ 1 litre de vin par jour depuis des années. On t''a dit que tu avais "une cirrhose" mais tu n''as jamais été hospitalisé pour ça. Tu prends de l''aspirine pour tes douleurs au dos.
COMPORTEMENT : tu minimises ta consommation d''alcool (tu diras 2-3 verres par jour sauf si on insiste avec bienveillance). Tu es pâle, tu parles doucement, tu ne veux pas rester à l''hôpital.',
  '## Grille d''évaluation — Hémorragie digestive haute

**Interrogatoire (5 pts)**
- Caractère de l''hématemèse (quantité, couleur, caillots) /1
- Méléna (selles noires) /1
- Signes de choc (lipothymie, sueurs, pâleur) /1
- ATCD : hépatopathie, varices connues, prise d''AINS/anticoagulants /1
- Consommation d''alcool (quantification) /1

**Diagnostic (4 pts)**
- Hémorragie digestive haute avec instabilité hémodynamique /2
- Suspicion de rupture de varices œsophagiennes (contexte cirrhotique) /1
- Ulcère peptique en alternative (AINS) /1

**Prise en charge (5 pts)**
- Deux VVP de bon calibre, bilan (NFS, TP, fibrinogène, groupe, RAI) /1
- Remplissage vasculaire prudent /1
- Somatostatine ou terlipressine IV (si varices suspectées) /1
- FOGD en urgence (< 12h) /1
- Réanimation, appel gastroentérologue /1

**Communication (2 pts)**
- Urgence expliquée avec fermeté et bienveillance /1
- Aborder la consommation d''alcool sans jugement /1',
  true
),
(
  'arthrite-septique',
  'Arthrite aiguë du genou',
  'Rhumatologie · Urgences',
  'DFASM2',
  10,
  'M. Patrick, 55 ans, consulte pour un genou gauche rouge, chaud, gonflé et très douloureux apparu en 24 heures. Évaluez la situation.',
  'Tu joues le rôle de Patrick, 55 ans, cuisinier.
SYMPTÔMES : ton genou gauche a commencé à gonfler hier soir, il est maintenant énorme, rouge, brûlant et tu ne peux plus plier la jambe tellement ça fait mal. Tu boites. Tu as un peu de fièvre (38,3°C ce matin). Tu n''as pas eu de traumatisme.
ATCD : tu as une goutte diagnostiquée il y a 3 ans (tu as déjà eu des crises au gros orteil, mais jamais au genou). Tu prends de l''allopurinol mais tu as arrêté il y a 1 mois car "tu te sentais bien". Tu bois parfois beaucoup lors des repas de travail (ce week-end tu as mangé et bu copieusement).
COMPORTEMENT : tu es persuadé que c''est encore ta goutte, tu veux juste un anti-inflammatoire. Mais tu n''as jamais eu une crise aussi intense.',
  '## Grille d''évaluation — Arthrite aiguë

**Interrogatoire (5 pts)**
- Mode d''installation (brutal, < 24h) /1
- Signes d''arthrite : rougeur, chaleur, gonflement, douleur /1
- Fièvre (orientation septique) /1
- ATCD : goutte, traumatisme, porte d''entrée infectieuse /1
- Arrêt de l''allopurinol, facteur déclenchant (excès alimentaire) /1

**Diagnostic (5 pts)**
- Deux diagnostics prioritaires : arthrite septique vs crise de goutte /2
- Arthrite septique = urgence (ne pas conclure à la goutte sans ponction) /2
- Recherche d''une porte d''entrée cutanée /1

**Prise en charge (4 pts)**
- Ponction articulaire en urgence (analyse : cytologie, cristaux, culture) /3
- Bilan infectieux (NFS, CRP, hémocultures) /1

**Communication (2 pts)**
- Expliquer pourquoi on ne peut pas conclure à la goutte sans prélèvement /1
- Importance de reprendre l''allopurinol à distance /1',
  true
),
(
  'erysipele-cellulite',
  'Érysipèle du membre inférieur',
  'Dermatologie · Médecine interne',
  'DFASM1',
  10,
  'Mme Odette, 78 ans, est amenée par sa fille pour un gros mollet droit rouge et douloureux avec de la fièvre depuis 48 heures. Évaluez la situation.',
  'Tu joues le rôle de Mme Odette, 78 ans, retraitée, avec sa fille présente.
SYMPTÔMES : ton mollet droit est rouge, gonflé et douloureux depuis avant-hier. La rougeur a l''air de s''étendre (ta fille a fait un trait de stylo hier). Tu as de la fièvre (38,9°C) avec des frissons. Ton mollet a une petite plaie entre les orteils (intertrigo).
ATCD : insuffisance veineuse chronique, diabète type 2 sous metformine, hypertension traitée. Tu as déjà eu un érysipèle il y a 3 ans au même endroit.
COMPORTEMENT : tu es fatiguée et gémissante, tu as du mal à marcher. Ta fille est inquiète et te pousse à accepter l''hospitalisation (toi tu voudrais rentrer chez toi).',
  '## Grille d''évaluation — Érysipèle

**Interrogatoire (5 pts)**
- Début et progression de la rougeur (placard érythémateux d''extension) /1
- Fièvre, frissons, état général /1
- Porte d''entrée recherchée (intertrigo, plaie) /2
- ATCD : récidive, insuffisance veineuse, diabète /1

**Diagnostic (3 pts)**
- Érysipèle à streptocoque /2
- Distinction avec la fasciite nécrosante (bords nets, pas de crépitation) /1

**Prise en charge (5 pts)**
- Amoxicilline IV ou orale selon critères d''hospitalisation /2
- Critères d''hospitalisation évalués (âge, diabète, décompensation) /1
- Traitement de la porte d''entrée (antifongique intertrigo) /1
- Surélévation du membre /1

**Communication (3 pts)**
- Expliquer le risque de récidive et la prévention /1
- Convaincre la patiente de l''hospitalisation avec respect de son autonomie /1
- Inclure la fille aidante dans les explications /1',
  true
),
(
  'pneumothorax-spontane',
  'Pneumothorax spontané',
  'Pneumologie · Urgences',
  'DFASM1',
  10,
  'M. Théo, 22 ans, grand et mince, consulte aux urgences pour une douleur thoracique droite et une gêne à respirer apparues brusquement il y a 2 heures au repos. Évaluez la situation.',
  'Tu joues le rôle de Théo, 22 ans, étudiant en master, sportif.
SYMPTÔMES : tu as eu une douleur thoracique droite en coup de poignard il y a 2h, au repos devant ton ordinateur. Tu as du mal à respirer profondément. La douleur irradie vers l''épaule droite. Tu ne fais pas de fièvre. Tu n''as pas craché de sang.
ATCD : aucun, pas de traitement. Tu es grand (1m90) et mince. Tu fumes 5 cigarettes par jour depuis 2 ans (tu le minimises).
COMPORTEMENT : tu es calme mais inquiet. Tu n''as jamais eu ça. Tu penses que tu as "froissé un muscle" en faisant du sport hier. Tu es surpris quand on te demande si tu fumes.',
  '## Grille d''évaluation — Pneumothorax spontané

**Interrogatoire (5 pts)**
- Début brutal au repos (pneumothorax spontané) /2
- Douleur thoracique pleurale et dyspnée /1
- Tabagisme (facteur de risque) /1
- Épisode similaire antérieur /1

**Diagnostic (4 pts)**
- Pneumothorax spontané primaire suspecté (jeune, longiligne) /2
- Absence de signe de pneumothorax compressif (TA, FC) /1
- Diagnostics différentiels (EP, SCA peu probable ici) /1

**Prise en charge (5 pts)**
- Radiographie thoracique en urgence / débit d''O2 /2
- Évaluation de la tolérance pour décision thérapeutique /1
- Exsufflation à l''aiguille ou drainage selon taille /1
- Pas de vol en avion, conseils activité /1

**Communication (2 pts)**
- Explication rassurante sur la nature et le traitement /1
- Arrêt du tabac : message clair et non moralisateur /1',
  true
),
(
  'fracture-hanche-personne-agee',
  'Chute et fracture du col fémoral',
  'Traumatologie · Gériatrie',
  'DFASM2',
  10,
  'Mme Suzanne, 84 ans, a chuté ce matin et ne peut plus se lever. Son fils vous appelle et vous la retrouvez à domicile, jambe droite en rotation externe. Évaluez la situation et organisez la prise en charge.',
  'Tu joues le rôle de Mme Suzanne, 84 ans, veuve, vivant seule.
SYMPTÔMES : tu es tombée ce matin en allant aux toilettes (tu sais pas trop comment), tu as très mal à la hanche droite, tu ne peux pas bouger la jambe. Tu es au sol depuis environ 2 heures. Tu n''as pas perdu connaissance. Tu n''as pas de douleur à la tête.
ATCD : hypertension, fibrillation auriculaire (anticoagulée par rivaroxaban), ostéoporose connue. Tu as déjà chuté il y a 6 mois (sans fracture ce coup-là). Tu marches avec une canne.
COMPORTEMENT : tu as froid, tu es un peu confuse par la douleur, mais tu réponds aux questions. Tu ne veux surtout pas aller à l''hôpital (tu as peur de ne plus rentrer chez toi).',
  '## Grille d''évaluation — Fracture du col fémoral

**Interrogatoire (5 pts)**
- Circonstances de la chute : avant ou après une perte de connaissance ? /2
- Durée du séjour au sol (hypothermie, rhabdomyolyse) /1
- Traitements anticoagulants (rivaroxaban) /1
- ATCD de chutes, niveau d''autonomie antérieur /1

**Diagnostic (3 pts)**
- Fracture du col fémoral cliniquement (rotation externe, raccourcissement) /2
- Bilan de la chute (cause cardiovasculaire ?) /1

**Prise en charge (5 pts)**
- Antalgie adaptée (éviter AINS, attention AINS + anticoagulants) /2
- Bilan pré-opératoire, ajustement anticoagulants, appel chirurgie /1
- Bilan de la durée au sol (ionogramme, CPK, ECG) /1
- Évaluation gériatrique (chutes répétées, ostéoporose, fracture-liaison) /1

**Communication (3 pts)**
- Écouter et respecter les craintes de la patiente /1
- Expliquer la nécessité de l''opération sans coercition /1
- Impliquer le fils dans la décision /1',
  true
),
(
  'crise-angoisse',
  'Crise d''angoisse aiguë',
  'Psychiatrie · Urgences',
  'DFASM1',
  10,
  'Mme Emma, 28 ans, est amenée par le SAMU aux urgences : elle a eu une « crise » dans le métro avec sensation de mort imminente. Elle est maintenant anxieuse mais stable. Évaluez la situation.',
  'Tu joues le rôle d''Emma, 28 ans, graphiste indépendante.
SYMPTÔMES DE LA CRISE (passée) : dans le métro il y a 1h, tu as eu des palpitations, du souffle court, des tremblements, des fourmillements dans les mains et autour de la bouche, tu t''es sentie mourir. La crise a duré 10-15 minutes puis s''est calmée d''elle-même.
SITUATION ACTUELLE : tu es encore très angoissée, tu as peur que ça recommence. Tu vas bien physiquement.
CONTEXTE : tu traverses une période très stressante (rupture il y a 3 mois, difficultés financières). Tu as déjà eu 2 épisodes similaires le mois dernier mais moins intenses. Tu n''as pas dormi depuis 2 jours.
COMPORTEMENT : tu es encore agitée, tu parles vite, tu surinterprètes chaque sensation corporelle.',
  '## Grille d''évaluation — Crise d''angoisse

**Interrogatoire (5 pts)**
- Description précise de la crise (symptômes physiques et psychiques) /2
- Début brutal, pic en < 10 min, résolution spontanée /1
- Antécédents de crises similaires /1
- Contexte de vie (facteurs de stress) /1

**Élimination d''une cause organique (4 pts)**
- Trouble du rythme cardiaque (ECG, scope, FC) /2
- Hypoglycémie (glycémie capillaire) /1
- Embolie pulmonaire (tachycardie, SpO2) /1

**Diagnostic et orientation (4 pts)**
- Trouble panique : diagnostic positif /2
- Agoraphobie associée suspectée (déclenchement dans le métro) /1
- Proposer un suivi (médecin traitant, psychothérapie TCC) /1

**Communication (3 pts)**
- Rassurer sans minimiser la souffrance /1
- Expliquer le mécanisme de la crise de panique (hyperventilation, cercle vicieux) /1
- Techniques immédiates : respiration abdominale /1',
  true
);
