# ADR-0010 — Authentification : email+mot de passe + OAuth Google/Apple

```yaml
status: Accepted
date: 2026-06-04
owner: Hugo Bettembourg
supersedes: ADR-0007 (méthode de connexion ; le reste d'ADR-0007 — vérification statut — reste valable)
```

## Contexte
ADR-0007 prévoyait la connexion par **magic link OTP** uniquement. À l'usage, le magic link
est jugé pénible (un email à chaque connexion, lien pointant vers `localhost` en dev) et, sur
web, la session ne s'établissait pas (`detectSessionInUrl: false` empêchait la consommation du
token de callback → reconnexion perçue à chaque visite).

## Décision
1. **`detectSessionInUrl: true`** côté client web (`src/db/supabase.ts`) : la session est
   désormais établie depuis le callback (magic link / OAuth) puis persistée → connexion **unique**.
2. Méthodes de connexion proposées :
   - **Email + mot de passe** (`signInWithPassword` / `signUpWithPassword`) avec renvoi explicite
     de l'email de confirmation (`resendSignupConfirmation`) si l'utilisateur ne l'a pas reçu ;
   - **OAuth Google et Apple** (`signInWithOAuth`, redirection web) ;
   - magic link **conservé** en option (rétro-compatibilité).
3. Le **persona public reste anonyme sans login** (01_REGULATION §5). La connexion ne concerne
   que les comptes (étudiant/pro/réglages).

## Conséquences / configuration requise (Supabase Dashboard, hors code)
- **Authentication → Providers → Email** : activer « Email » avec mot de passe (et décider de la
  confirmation email on/off).
- **Authentication → Providers → Google / Apple** : activer et renseigner les Client ID/Secret
  (Google Cloud Console / Apple Developer).
- **Authentication → URL Configuration** : définir le **Site URL** = URL de production
  (`https://refonte-med-info.vercel.app` ou domaine final) et ajouter les **Redirect URLs**
  autorisées (prod + previews + localhost de dev). Côté app, renseigner
  `EXPO_PUBLIC_AUTH_REDIRECT_URL` avec cette URL publique ; sinon Expo génère une URL dev
  (`localhost`/scheme local) via `Linking.createURL('/')`, ce qui peut rendre les liens email
  inutilisables hors dev.
- **Authentication → Emails / SMTP** : si « Confirm email » est activé, vérifier que le template
  « Confirm signup » est actif, que les quotas/rate limits Supabase ne sont pas atteints, et que
  le provider SMTP/domaine d'envoi délivre bien les emails. L'application ne peut que demander
  l'envoi/renvoi ; la délivrabilité se diagnostique dans les logs Supabase/SMTP.

## Limites
- L'OAuth est câblé pour le **web** (redirection). Le flux **natif** iOS/Android
  (`expo-web-browser` / `expo-auth-session`) reste à ajouter avant publication des apps mobiles.

## Impact réglementaire
None. Aucune donnée de santé ; le public reste anonyme ; persona toujours adossée à la RLS
(`profiles`). La safe-box (classifieur, prompts, validation de sortie) est inchangée.
