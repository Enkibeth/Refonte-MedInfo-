-- Migration 0013 — ecos_cases : corpus des cas ECOS (banque de simulations).
-- Remplace les cas HARDCODÉS de app/(chat)/ecos.tsx par une table éditable + CRUD admin.
--
-- Aucune donnée de santé réelle/identifiable : ce sont des cas pédagogiques fictifs
-- (mêmes garanties que rag_* en 0006). RLS : lecture publique des cas PUBLIÉS uniquement,
-- écriture réservée au service_role (CRUD admin via /api/admin/ecos-cases, requireAdmin).
-- Vérifié dans tests/rls/ecos-cases.test.ts. Policy détaillée : supabase/policies/ecos_cases.sql.
--
-- Le seed inline ci-dessous est le corpus placeholder (idempotent on conflict). Le vrai
-- corpus vit dans data/ecos-cases.json et se rejoue avec `node scripts/seed-ecos-cases.mjs`
-- (upsert par slug) — il s'intègre par-dessus ce seed sans le casser.

create table if not exists public.ecos_cases (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  specialty        text not null,
  level            text not null default 'DFASM',
  duration_minutes int  not null default 10 check (duration_minutes between 1 and 60),
  brief            text not null,                       -- consigne candidat (étudiant)
  patient_profile  jsonb not null default '{}'::jsonb,  -- { role_brief: "..." } : consigne de jeu du patient IA
  grading_grid     jsonb not null default '{}'::jsonb,  -- { markdown: "..." } : grille de correction
  is_published     boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists ecos_cases_published_idx on public.ecos_cases (is_published) where is_published;

alter table public.ecos_cases enable row level security;

-- Lecture publique des cas publiés ; écritures réservées au service_role (BYPASSRLS).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'ecos_cases' and policyname = 'ecos_cases_select_published'
  ) then
    create policy ecos_cases_select_published on public.ecos_cases for select using (is_published = true);
  end if;
end $$;

-- Le client (anon/authenticated) ne peut que LIRE les cas publiés. Aucune écriture client.
grant select on public.ecos_cases to anon, authenticated;
grant select, insert, update, delete on public.ecos_cases to service_role;

-- ── Seed placeholder (corpus de démarrage, idempotent) ──────────────────────────
insert into public.ecos_cases (slug, title, specialty, level, duration_minutes, brief, patient_profile, grading_grid, is_published)
values
  (
    'douleur-thoracique',
    'Douleur thoracique aiguë',
    'Cardiologie · Urgences',
    'DFASM',
    10,
    'M. Bernard, 58 ans, consulte aux urgences pour une douleur thoracique depuis 2 heures. Réalisez l''interrogatoire et proposez votre démarche diagnostique.',
    jsonb_build_object('role_brief', E'Tu joues le rôle du patient M. Bernard, 58 ans, cadre stressé.\nSYMPTÔMES : douleur thoracique rétrosternale en étau depuis 2h, irradiant dans le bras gauche et la mâchoire, 8/10. Sueurs, nausées. Pas de dyspnée au repos.\nATCD : HTA traitée (amlodipine), dyslipidémie (statine), tabagisme actif 30 PA, père décédé d''un IDM à 62 ans.\nCOMPORTEMENT : tu es anxieux, tu penses à une crise cardiaque. Tu réponds aux questions précisément mais n''offres pas spontanément les infos. Tu nies la consommation d''alcool.\nNe révèle pas le diagnostic. Réponds naturellement comme un patient, sans termes médicaux.'),
    jsonb_build_object('markdown', E'## Grille d''évaluation — Douleur thoracique\n\n**Interrogatoire (6 pts)**\n- Caractéristiques de la douleur : siège, type, irradiations, intensité /2\n- Facteurs déclenchants / calmants /1\n- Signes associés : sueurs, nausées, dyspnée /1\n- ATCD cardiovasculaires personnels et familiaux /1\n- Facteurs de risque : tabac, HTA, dyslipidémie /1\n\n**Diagnostic (4 pts)**\n- Évoque SCA en premier /2\n- Diagnostics différentiels (EP, dissection aortique) /1\n- Urgence reconnue, appel SAMU /1\n\n**Examens complémentaires (3 pts)**\n- ECG en urgence /1\n- Troponines (×2 à 3h) /1\n- Bilan biologique (NFS, ionogramme, bilan de coagulation) /1\n\n**Communication (3 pts)**\n- Empathie, ton rassurant /1\n- Explication claire au patient /1\n- Appel de l''équipe médicale / organisation /1'),
    true
  ),
  (
    'cephalees-febriles',
    'Céphalées aiguës fébriles',
    'Neurologie · Infectiologie',
    'DFASM',
    10,
    'Mme Léa, 24 ans, étudiante, consulte pour des céphalées intenses depuis 24h avec de la fièvre. Évaluez la situation et orientez votre diagnostic.',
    jsonb_build_object('role_brief', E'Tu joues le rôle de Léa, 24 ans, étudiante en droit, fiancée, sans ATCD.\nSYMPTÔMES : céphalée diffuse très intense (10/10) apparue brutalement hier soir, fièvre à 39°C, photophobie, nausées, nuque raide. Ce matin tu as remarqué de petites taches rouges sur les jambes.\nCOMPORTEMENT : tu es effrayée, la lumière te fait mal (grimace si on te parle de lumière), tu parles doucement car la voix résonne dans ta tête.\nENTOURAGE : ta coloc a eu une grippe la semaine passée mais elle va bien.\nNe révèle pas le diagnostic. Réponds naturellement, sans termes médicaux. Montre ta détresse.'),
    jsonb_build_object('markdown', E'## Grille d''évaluation — Céphalées fébriles\n\n**Interrogatoire (5 pts)**\n- Caractère brutal du début (en coup de tonnerre ?) /1\n- Fièvre, frissons /1\n- Signes méningés : photophobie, phonophobie, raideur de nuque /1\n- Purpura (taches cutanées) /1\n- Contage récent, vie en collectivité /1\n\n**Diagnostic (4 pts)**\n- Méningite bactérienne évoquée en premier /2\n- Purpura fulminans reconnu comme urgence absolue /1\n- Diagnostics différentiels (méningite virale, HSA) /1\n\n**Prise en charge (4 pts)**\n- Appel du SAMU 15 immédiat /2\n- Ceftriaxone IV sans attendre (si purpura) /1\n- Isolement / protection /1\n\n**Communication (3 pts)**\n- Rassure sans minimiser la gravité /1\n- Explique la démarche /1\n- Prévient l''entourage pour antibioprophylaxie /1'),
    true
  ),
  (
    'dyspnee-aigue',
    'Dyspnée aiguë',
    'Cardiologie · Pneumologie',
    'DFASM',
    10,
    'M. Dumont, 72 ans, est amené par son épouse pour une dyspnée progressive depuis 6h. Évaluez et prenez en charge.',
    jsonb_build_object('role_brief', E'Tu joues le rôle de M. Dumont, 72 ans, retraité, avec son épouse présente.\nSYMPTÔMES : tu es très essoufflé (tu parles par petites phrases), tu as du mal à t''allonger (orthopnée 3 oreillers), tu toussotes une mousse rosée. Œdème des chevilles depuis 3 jours.\nATCD : insuffisance cardiaque (FE 35%), fibrillation auriculaire, HTA. Médicaments : furosémide, bisoprolol, ramipril, apixaban.\nAVEU IMPORTANT : tu as arrêté le furosémide il y a 5 jours car tu avais "trop envie d''uriner". Tu le diras seulement si on te pose la question sur tes médicaments.\nCOMPORTEMENT : anxieux, tu transpires, tu restes assis, tu t''exprimes avec peine.'),
    jsonb_build_object('markdown', E'## Grille d''évaluation — Dyspnée aiguë\n\n**Interrogatoire (5 pts)**\n- Délai et mode d''installation /1\n- Orthopnée, DPN /1\n- Toux, expectoration rosée /1\n- ATCD : IC, FA, traitements /1\n- Observance médicamenteuse (arrêt furosémide) /1\n\n**Diagnostic (3 pts)**\n- Œdème aigu pulmonaire sur IC décompensée /2\n- Facteur déclenchant identifié (non-observance) /1\n\n**Prise en charge (4 pts)**\n- Position demi-assise, O2 /1\n- Diurétiques IV (furosémide) /1\n- Monitorage (SaO2, TA, ECG) /1\n- Appel réanimation si aggravation /1\n\n**Communication (4 pts)**\n- Réassurance du patient et de l''épouse /1\n- Explication simple de la situation /1\n- Importance de l''observance expliquée /1\n- Pas de jargon médical /1'),
    true
  ),
  (
    'douleur-abdominale',
    'Douleur abdominale aiguë',
    'Chirurgie · Gastroentérologie',
    'DFASM',
    10,
    'Mme Sophie, 32 ans, consulte pour une douleur abdominale aiguë en fosse iliaque droite. Réalisez l''interrogatoire et proposez une démarche.',
    jsonb_build_object('role_brief', E'Tu joues le rôle de Sophie, 32 ans, secrétaire, enceinte de 8 semaines (test positif il y a 3 semaines, grossesse non suivie).\nSYMPTÔMES : douleur en FID depuis 12h, de plus en plus intense (7/10), à bascule. Nausées. Pas de fièvre (37,2°C). Dernières règles il y a 8 semaines. Saignements vaginaux légers depuis ce matin.\nCOMPORTEMENT : tu révèles la grossesse seulement si on te demande directement si tu peux être enceinte. Tu as peur. Tu n''as pas encore dit à ton compagnon.\nPOINT CLÉ : tu ne sais pas si c''est une grossesse intra-utérine, tu as juste fait un test urinaire.'),
    jsonb_build_object('markdown', E'## Grille d''évaluation — Douleur abdominale\n\n**Interrogatoire (6 pts)**\n- Caractéristiques de la douleur /1\n- Signes digestifs associés /1\n- Recherche active de grossesse (INTERROGATOIRE SYSTÉMATIQUE) /2\n- Méno-métrorragies /1\n- ATCD gynécologiques (GEU, salpingite, DIU, chirurgie) /1\n\n**Diagnostic (4 pts)**\n- GEU évoquée en priorité /2\n- Appendicite en diagnostic différentiel /1\n- Conscience de l''urgence /1\n\n**Examens (3 pts)**\n- β-hCG quantitatif /1\n- Échographie pelvienne en urgence /1\n- NFS, groupe sanguin, rhésus /1\n\n**Communication (3 pts)**\n- Annonce bienveillante de la situation /1\n- Urgence expliquée sans créer de panique /1\n- Confidentialité respectée /1'),
    true
  )
on conflict (slug) do update set
  title            = excluded.title,
  specialty        = excluded.specialty,
  level            = excluded.level,
  duration_minutes = excluded.duration_minutes,
  brief            = excluded.brief,
  patient_profile  = excluded.patient_profile,
  grading_grid     = excluded.grading_grid;
