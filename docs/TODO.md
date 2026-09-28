# TODO — actions en attente (Hugo / prochaine session)

> Mémo des tâches mises en pause le 2026-06-04. Le code est prêt côté repo ; ce qui suit
> demande une action externe (dashboards / clés / fichiers) puis un petit branchement.

## 1. Supabase — configuration Auth (dashboard)
**Pourquoi** : sans ça, connexion email/OAuth incomplète + magic-link pointe sur `localhost`.
**À faire** (Supabase → projet `sbpnjswffrqxgnglnjml`) :
- **Authentication → Providers** : activer **Email** (mot de passe), **Google**, **Apple**
  (renseigner Client ID/Secret depuis Google Cloud Console / Apple Developer).
- **Authentication → URL Configuration** (hébergement Hostinger, ADR-0038) :
  - **Site URL** = `https://medinfo-ai.com` au jour J (`docs/09_DEPLOYMENT.md` §8.5).
  - **Redirect URLs** : `https://medinfo-ai.com/**`, le domaine temporaire Hostinger pendant la
    transition, `http://localhost:8081/**` (dev). Les URL `*.vercel.app` pourront être
    retirées après la bascule (§10 du runbook).
**Statut code** : ✅ déjà en place (ADR-0010, `detectSessionInUrl: true`, écrans + AuthProvider).

## 2. Hostinger — variables d'environnement (hPanel) *(critique pour que l'app marche)*
Liste, règles et pièges : `docs/09_DEPLOYMENT.md` §4 (valeurs masquées à la relecture, liste
remplacée en entier par l'API, jamais `PORT` ni `HOST`, `EXPO_PUBLIC_*` = nouveau build).
Vérif : `/api/health` + la ligne `[medinfo] supabase : …` du journal de démarrage (§3).

## 3. RPPS / ANS — clé `ANNUAIRE_SANTE_API_KEY`
**Comment l'obtenir** : portail **ANS** `industriels.esante.gouv.fr` → compte → accès
**API FHIR « Annuaire Santé »** (version open suffisante pour vérifier un RPPS).
**Ensuite** : poser `ANNUAIRE_SANTE_API_KEY` dans les variables de l'application (hPanel)
→ **brancher le lookup FHIR réel** `Practitioner?identifier=<RPPS>` dans
`app/api/role+api.ts` (actuellement renvoie `pending`, aucune attribution pro non vérifiée).
Statut code : ✅ prêt, stub en place (ADR-0011).

## 4. Logo image + ancien visuel (déposer 2 fichiers)
Le logo est pour l'instant **rendu en code** (`src/ui/Logo.tsx`). Pour passer aux vraies images :
- Déposer `assets/brand/logo-wordmark.png` (logo MedInfo AI fourni).
- Déposer `assets/brand/legacy-illustration.png` (ancien visuel à afficher « pour le moment »).
- Puis branchement (cf `assets/brand/README.md`) : basculer `Logo` sur `<Image>` + afficher
  l'illustration sur l'accueil + icônes app/favicon/splash dans `app.json`.

---
### Déjà fait (rappel)
- Audit IA corrigé (B1/I1/I2/I3/M1/M2/M3/M4) ; safe-box 3 couches durcie.
- Auth email+mot de passe + Google/Apple (ADR-0010). Rôles public/étudiant/pro + vérif (ADR-0011)
  avec garde anti-auto-promotion (testée RLS). Migrations Supabase `usage_counters` + vérif **appliquées**.
- Thème blanc/bleu pétrole + logo (code). Fix déploiement Vercel (Node 22.x + 404) — historique :
  hébergement désormais chez Hostinger (ADR-0038). 
- `main` = `staging` = `dev` alignés.
