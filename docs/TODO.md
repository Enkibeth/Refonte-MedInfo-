# TODO — actions en attente (Hugo / prochaine session)

> Mémo des tâches mises en pause le 2026-06-04. Le code est prêt côté repo ; ce qui suit
> demande une action externe (dashboards / clés / fichiers) puis un petit branchement.

## 1. Supabase — configuration Auth (dashboard)
**Pourquoi** : sans ça, connexion email/OAuth incomplète + magic-link pointe sur `localhost`.
**À faire** (Supabase → projet `sbpnjswffrqxgnglnjml`) :
- **Authentication → Providers** : activer **Email** (mot de passe), **Google**, **Apple**
  (renseigner Client ID/Secret depuis Google Cloud Console / Apple Developer).
- **Authentication → URL Configuration** :
  - **Site URL** = URL de prod (`https://refonte-med-info.vercel.app` ou domaine final).
  - **Redirect URLs** : ajouter prod + previews Vercel + `http://localhost:8081` (dev).
**Statut code** : ✅ déjà en place (ADR-0010, `detectSessionInUrl: true`, écrans + AuthProvider).

## 2. Vercel — variables d'environnement (dashboard) *(critique pour que l'app marche)*
**À faire** (Vercel → projet `refonte-med-info` → Settings → Environment Variables, Prod + Preview) :
- `EXPO_PUBLIC_SUPABASE_URL` = `https://sbpnjswffrqxgnglnjml.supabase.co`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_y_ACBkPvepD5YInUNj_FoQ_aa2HE3sF`
- `SUPABASE_URL` = `https://sbpnjswffrqxgnglnjml.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = *(Supabase → Settings → API → `service_role`, SECRET)*
- `AI_PROVIDER` = `anthropic` (ou `openai`) + `ANTHROPIC_API_KEY` (et/ou `OPENAI_API_KEY`)
- Puis **Redeploy**. Vérif : `https://refonte-med-info.vercel.app/api/health`.

## 3. RPPS / ANS — clé `ANNUAIRE_SANTE_API_KEY`
**Comment l'obtenir** : portail **ANS** `industriels.esante.gouv.fr` → compte → accès
**API FHIR « Annuaire Santé »** (version open suffisante pour vérifier un RPPS).
**Ensuite** : poser `ANNUAIRE_SANTE_API_KEY` dans Vercel → **brancher le lookup FHIR réel**
`Practitioner?identifier=<RPPS>` dans `app/api/role+api.ts` (actuellement renvoie `pending`,
aucune attribution pro non vérifiée). Statut code : ✅ prêt, stub en place (ADR-0011).

## 4. Logo image + ancien visuel (déposer 2 fichiers)
Le logo est pour l'instant **rendu en code** (`src/ui/primitives/Logo.tsx`). Pour passer aux vraies images :
- Déposer `assets/brand/logo-wordmark.png` (logo MedInfo AI fourni).
- Déposer `assets/brand/legacy-illustration.png` (ancien visuel à afficher « pour le moment »).
- Puis branchement (cf `assets/brand/README.md`) : basculer `Logo` sur `<Image>` + afficher
  l'illustration sur l'accueil + icônes app/favicon/splash dans `app.json`.

---
### Déjà fait (rappel)
- Audit IA corrigé (B1/I1/I2/I3/M1/M2/M3/M4) ; safe-box 3 couches durcie.
- Auth email+mot de passe + Google/Apple (ADR-0010). Rôles public/étudiant/pro + vérif (ADR-0011)
  avec garde anti-auto-promotion (testée RLS). Migrations Supabase `usage_counters` + vérif **appliquées**.
- Thème blanc/bleu pétrole + logo (code). Fix déploiement Vercel (Node 22.x + 404). 
- `main` = `staging` = `dev` alignés.
