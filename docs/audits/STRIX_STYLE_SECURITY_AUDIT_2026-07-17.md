# Audit de sécurité MedInfo AI — méthodologie inspirée de Strix

**Date :** 17 juillet 2026  
**Dépôt :** `Enkibeth/Refonte-MedInfo-`  
**Référence auditée :** branche `main`, SHA `46dd819c96215c847f27ae8a880db729ae56c8ff`  
**Auditeur :** Codex / GPT-5.6 Thinking  
**Nature :** revue statique multi-passes, orientée attaque, inspirée du workflow Strix  
**Statut :** rapport actionnable ; aucune correction applicative incluse

> **Limite fondamentale.** Ce document n’est pas une sortie du binaire Strix. L’environnement disponible ne permettait pas d’exécuter Strix avec Docker, une clé LLM et une cible isolée. Aucun exploit dynamique n’a été lancé contre la production, Supabase, Vercel ou les fournisseurs LLM. Les constats sont confirmés par lecture du code, sauf mention contraire.

---

## 1. Résumé exécutif

Le projet possède plusieurs contrôles solides : validation des Bearer tokens par Supabase, RLS own-row testées sur un vrai PostgreSQL, tables sensibles réservées au `service_role`, routes récentes utilisant généralement la persona serveur, vérification cryptographique correcte des webhooks Stripe et validation Zod sur plusieurs fonctionnalités.

Quatre familles de risques restent **bloquantes avant une exposition publique à grande échelle**. Premièrement, la vérification des rôles peut être contournée : un utilisateur authentifié peut déclarer une adresse académique qu’il ne contrôle pas, ou le RPPS public d’un tiers actif, puis obtenir durablement le rôle correspondant. Deuxièmement, plusieurs routes LLM coûteuses sont insuffisamment protégées : le chat principal n’utilise pas le rate limiter existant, l’essai invité est renouvelable par nouvelle requête, la transcription audio est publique et peut déclencher jusqu’à trois appels fournisseurs, et l’ECOS peut agir comme proxy LLM piloté par un `systemPrompt` client. Troisièmement, le vérificateur de liens est exposé à une SSRF par redirection ou DNS : seule l’URL initiale est contrôlée avant un `fetch` qui suit automatiquement les redirections. Quatrièmement, les couches de safe-box documentées ont été retirées alors que le produit accepte des symptômes, documents, images, pièces jointes et consultations audio susceptibles de contenir des données de santé identifiables transmises à des prestataires tiers.

La branche `main` a aussi fortement divergé de `dev`. Le workflow documentaire exige des PR vers `dev`, mais l’état réellement analysé comporte de nombreuses routes, migrations et fonctionnalités agentiques différentes. Un scan ou une CI ciblant la mauvaise branche peut donc produire une assurance trompeuse.

**Verdict :** ne pas considérer le produit comme prêt pour un lancement public non contrôlé tant que `STRIX-001` à `STRIX-004` ne sont pas corrigés et couverts par des tests de non-régression.

### Synthèse

| ID | Priorité | Sévérité | Constat | Statut |
|---|---:|---|---|---|
| STRIX-001 | P0 | Critique | Usurpation du rôle étudiant ou professionnel | Confirmé statiquement |
| STRIX-002 | P0 | Critique | Endpoints LLM coûteux exposés / quotas contournables | Confirmé statiquement |
| STRIX-003 | P0 | Élevée | SSRF via `verify_source_links` et redirections | Confirmé statiquement |
| STRIX-004 | P0 | Critique produit | Safe-box retirée et données médicales envoyées aux providers | Confirmé architecturalement |
| STRIX-005 | P1 | Élevée | Messages, rôles, fichiers et payloads insuffisamment validés | Confirmé statiquement |
| STRIX-006 | P1 | Élevée | Essai invité donnant accès aux chatbots et outils privilégiés | Confirmé statiquement |
| STRIX-007 | P1 | Moyenne | Absence d’en-têtes HTTP de défense en profondeur | Confirmé statiquement |
| STRIX-008 | P1 | Élevée gouvernance | Divergence `main` / `dev` et CI appliquée au mauvais état | Confirmé par comparaison Git |
| STRIX-009 | P2 | Moyenne | Bypass de vérification par simple variable d’environnement | Confirmé statiquement |
| STRIX-010 | P2 | Moyenne | Durcissement CI et supply chain incomplet | Confirmé statiquement, CVE non scannées |

---

## 2. Méthodologie multi-passes

L’audit a été divisé en passes spécialisées afin de reproduire le principe de plusieurs agents Strix indépendants :

1. Cartographie des routes, webhooks, cron, outils agentiques et pages autonomes.
2. Authentification, personas, admin et preuves de rôle.
3. RLS, `service_role`, historique cloud et isolation cross-user.
4. Abus économique : quotas, nombre d’étapes LLM, uploads et concurrence.
5. SSRF, MCP, recherche web, redirections et sorties réseau.
6. Injection, rôles de messages, `systemPrompt`, JSON, Zod et fichiers.
7. Vie privée, données de santé, safe-box, rétention et providers.
8. Frontend : XSS échantillonné, CSP, clickjacking et ressources tierces.
9. CI/CD, branches, secrets et supply chain.

---

# 3. Findings détaillés

## STRIX-001 — Usurpation du rôle étudiant ou professionnel

**Priorité : P0 — Critique**  
**CWE :** CWE-287, CWE-862  
**Fichiers :** `app/api/role+api.ts`, `src/auth/roles.ts`, `src/auth/annuaireSante.ts`

### Preuve

La route dérive correctement le compte depuis le token Supabase, mais fait confiance à des **preuves de rôle librement déclarées dans le body** :

- `body.email` est uniquement soumis à `isAcademicEmail()` ; il n’est ni égal à l’adresse confirmée du compte, ni vérifié par OTP/magic link ;
- `body.rpps` est recherché dans l’Annuaire Santé ; la présence d’un professionnel actif prouve l’existence du RPPS, pas que le compte demandeur en est titulaire ;
- après succès, la persona est ajoutée à `verified_personas`, rendant l’élévation persistante.

### Exploitation

1. Compte standard + `persona=student` + adresse académique plausible contrôlée par personne d’autre.
2. Compte standard + RPPS public d’un médecin actif + `persona=professional`.
3. Réutilisation ultérieure du rôle via `verified_personas`, sans nouvelle preuve.

### Impact

Contournement des restrictions produit, accès à des outils réservés, usurpation de statut professionnel, risque juridique et réputationnel majeur. Le rôle usurpé autorise également les pièces jointes du chat, ce qui augmente la surface de données sensibles.

### Correction

- **Étudiant :** utiliser uniquement `user.email` retourné par Supabase Auth avec `email_confirmed_at` non nul et domaine autorisé. Une adresse secondaire doit faire l’objet d’un challenge OTP/magic link lié au même `userId`, expirant et consommé atomiquement.
- **Professionnel :** ne pas assimiler RPPS actif et propriété du RPPS. Utiliser Pro Santé Connect/e-CPS OIDC ou une vérification manuelle. En attendant, rester `pending` et ne pas ajouter `professional` à `verified_personas`.
- Auditer les rôles déjà attribués et préparer une revalidation.

### Tests

- Compte non académique + autre email académique dans le body → refus.
- Email académique non confirmé → refus.
- RPPS actif d’un tiers → aucun privilège.
- `verified_personas` modifié uniquement après preuve liée au compte.

---

## STRIX-002 — Endpoints LLM coûteux exposés et quotas contournables

**Priorité : P0 — Critique**  
**CWE :** CWE-770, CWE-400  
**Fichiers :** `app/api/chat+api.ts`, `app/api/transcribe+api.ts`, `app/api/ecos+api.ts`, `app/api/chat-meta+api.ts`, `src/ai/rateLimit/chatRateLimit.ts`

### Preuves

- Le rate limiter existe et indique qu’il doit être appelé dans `/api/chat`, mais la route chat ne l’appelle pas.
- Le chat autorise jusqu’à **12 étapes LLM** par requête, avec recherche et outils.
- L’essai invité compte les messages utilisateur du body courant : une nouvelle requête avec un seul message recrée un essai.
- `/api/transcribe` ne fait ni auth ni quota. Un upload de 25 Mo peut déclencher Whisper, une diarisation puis un compte rendu.
- `/api/ecos` ne vérifie pas la persona et accepte un `systemPrompt` client.
- `/api/chat-meta` est authentifié mais sans quota dédié.

### Impact

Facture fournisseur non bornée, déni de service économique, saturation Vercel et utilisation de MedInfo comme proxy LLM.

### Correction

Créer un helper serveur central `enforceFeatureAccess()` :

- token/persona/entitlement dérivés serveur ;
- quota par feature, utilisateur et IP ;
- limite horaire, journalière et de concurrence ;
- taille maximale avant parsing lourd ;
- refus avant tout appel provider ;
- fail-closed si le backend de quota configuré échoue.

Mesures immédiates :

- brancher le quota sur `/api/chat` avant runtime/outils ;
- invité : public uniquement, faible nombre d’étapes/tokens, identité serveur résistante au renouvellement ;
- auth obligatoire pour `/api/transcribe` et `/api/ecos` ;
- quota séparé pour audio, chat-meta, analyse et outils ;
- budget global quotidien et alerting coût.

### Tests

- Requêtes invitées séparées ne renouvelant pas l’essai.
- Transcribe sans token ou après quota : provider jamais appelé.
- Chat après quota : aucun stream ni outil ouvert.
- Appels concurrents audio au-delà de la limite refusés.

---

## STRIX-003 — SSRF par redirection ou DNS dans `verify_source_links`

**Priorité : P0 — Élevée**  
**CWE :** CWE-918  
**Fichiers :** `src/ai/chat/tools/urlSafety.ts`, `src/ai/chat/tools/verifyLinks.ts`

### Preuve

`isSafePublicHttpUrl()` bloque des schémas/hôtes évidents, mais seule l’URL initiale est contrôlée. `fetch(..., { redirect: 'follow' })` suit ensuite automatiquement les redirections. Aucune résolution DNS A/AAAA n’exclut les plages privées, loopback, link-local ou metadata.

Un domaine public contrôlé par un attaquant peut rediriger vers `127.0.0.1`, `169.254.169.254`, une adresse RFC1918 ou un service interne. Le DNS rebinding reste également possible.

### Correction

- `redirect: 'manual'` ;
- résolution A/AAAA et rejet de toutes les plages non publiques ;
- validation de chaque saut, maximum 3 ;
- ports 80/443 seulement ;
- allowlist de domaines médicaux lorsque possible ;
- proxy egress isolé si disponible.

### Tests

Redirections vers loopback, metadata, RFC1918 et IPv6 privé refusées avant connexion ; redirections excessives refusées ; URLs publiques normales conservées.

---

## STRIX-004 — Safe-box retirée et traitement de données médicales personnelles

**Priorité : P0 — Critique produit / conformité**  
**Fichiers :** `app/api/chat+api.ts`, `app/api/analyze+api.ts`, `app/api/transcribe+api.ts`, `src/ai/chat/attachment.ts`, `docs/01_REGULATION.md`

### Preuve

Le chat fonctionne explicitement sans classifieur pré-LLM, validation de sortie ni rate limit ; les logs indiquent `guardrail_layer: 'none'`. En parallèle :

- `/api/analyze` accepte texte, PDF et images médicales, y compris sans compte, puis les transmet au provider ;
- `/api/transcribe` reçoit potentiellement une consultation médecin-patient et génère un compte rendu ;
- le chat accepte désormais une pièce jointe PDF/image/texte de 6 Mo pour les personas vérifiées, transmise telle quelle au modèle ;
- la vérification de rôle actuellement contournable rend la barrière des pièces jointes insuffisante ;
- des informations personnelles de profil peuvent être injectées dans les prompts.

La doctrine du dépôt reconnaît qu’une autodéclaration de symptômes constitue une donnée de santé et que le MVP repose sur une safe-box et un périmètre de traitement strict.

### Impact

Transmission possible de données de santé identifiables à des sous-traitants sans garde technique, risque de réponse individualisée contraire à l’intended purpose, risques RGPD/HDS/contractuels. Un disclaimer ne compense pas une finalité réelle différente.

### Correction

1. ADR et arbitrage humain sur chaque flux document/audio/pièce jointe.
2. Réintroduire classifieur fail-closed et validation de sortie.
3. Auth, consentement, minimisation, rétention et suppression explicites.
4. Vérifier DPA, résidence, ZDR et logs providers.
5. Désactiver les fonctionnalités sensibles lorsque la configuration de conformité manque.
6. Aucune donnée clinique brute dans logs/traces.

### Tests

Cas personnels/emergency/ambiguës refusés avant le modèle ; sorties individualisées bloquées ; aucun contenu brut dans les logs ; features sensibles fail-closed si configuration incomplète.

---

## STRIX-005 — Validation insuffisante des messages, rôles, fichiers et payloads

**Priorité : P1 — Élevée**  
**CWE :** CWE-20, CWE-400  
**Fichiers :** `app/api/chat+api.ts`, `app/api/ecos+api.ts`, `app/api/transcribe+api.ts`, `src/ai/chat/attachment.ts`

### Preuve

- Chat : `messages?: unknown[]`, cast `any`, absence de limite explicite du nombre de messages et de taille cumulée.
- Des rôles assistant/tool fournis par le client peuvent entrer dans le contexte au lieu d’être reconstruits depuis un historique serveur de confiance.
- ECOS : interface TypeScript sans validation runtime ; `systemPrompt` et historique viennent du client.
- Transcribe : `request.formData()` est exécuté avant le contrôle de taille ; pas de whitelist MIME/magic bytes.
- Pièce jointe chat : taille base64 et MIME déclaratif bornés, mais `request.json()` décode le body avant auth/quota, pas de magic bytes, et un attachement invalide est silencieusement ignoré au lieu d’être refusé.

### Impact

Prompt/tool-state injection, proxy LLM générique, surconsommation tokens/mémoire et confusion de type de fichier.

### Correction

- Zod strict sur tous les bodies/messages.
- Limites messages, caractères et taille totale.
- Autoriser uniquement les rôles nécessaires ; idéalement reconstruire l’historique own-row côté serveur.
- ECOS : accepter un `caseId`, charger le cas publié en DB, ne jamais accepter de `systemPrompt` client.
- Limiter le body au niveau runtime/reverse proxy ; MIME + magic bytes ; refuser explicitement tout fichier invalide.

---

## STRIX-006 — Essai invité avec chatbots et outils privilégiés

**Priorité : P1 — Élevée**  
**Fichiers :** `app/api/chat+api.ts`, `src/ai/chat/tools/index.ts`

`allowedChatbotsFor()` retourne public, étudiant et professionnel pour l’essai invité. Le pro reçoit ClinicalTrials et éventuellement le sous-agent PubMed/MCP.

**Correction :** invité = public uniquement, modèle économique, peu d’étapes, aucun outil privilégié. Étudiant/pro = token + persona réellement vérifiée + entitlement.

---

## STRIX-007 — En-têtes HTTP de défense absents

**Priorité : P1 — Moyenne**  
**Fichiers :** `vercel.json`, `app/+html.tsx`

La configuration définit des politiques de cache mais pas CSP, HSTS, `nosniff`, Referrer-Policy, Permissions-Policy ou protection de framing.

**Correction :** ajouter HSTS après validation, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP avec `frame-ancestors`, `object-src 'none'`, `base-uri 'self'`. Déployer d’abord CSP Report-Only. Tenir compte des styles inline et supprimer idéalement Google Fonts au profit des polices auto-hébergées.

---

## STRIX-008 — Divergence `main` / `dev`

**Priorité : P1 — Élevée gouvernance**

La comparaison GitHub montre des branches divergentes : `main` possède environ 50 commits d’avance et 3 de retard sur `dev`, avec une large surface applicative différente. Une PR ou un scan vers `dev` peut ne pas analyser le code réellement déployé.

**Correction :** geler les nouvelles features, choisir la source de vérité, inventorier les commits propres à chaque branche, réconcilier par PR dédiée, protéger les branches et enregistrer le SHA réellement déployé.

---

## STRIX-009 — Bypass de rôle par variable d’environnement

**Priorité : P2 — Moyenne à élevée**  
**Fichier :** `app/api/role+api.ts`

`BYPASS_ROLE_VERIFICATION=true` désactive les contrôles sans garde technique empêchant la production.

**Correction :** supprimer ce bypass ou le rendre impossible sous `NODE_ENV/VERCEL_ENV=production`, avec test et validation de configuration au démarrage.

---

## STRIX-010 — CI et supply chain incomplètes

**Priorité : P2 — Moyenne**  
**Fichier :** `.github/workflows/compliance.yml`

- actions par tags majeurs mutables ;
- `npm install` plutôt que `npm ci` ;
- pas de SCA, CodeQL, secret scan ou SBOM observé.

**Correction :** pinner les actions par SHA, `npm ci`, CodeQL, OSV/npm audit, Gitleaks, Dependabot et SBOM CycloneDX.

> Les dépendances n’ont pas été résolues contre une base CVE pendant cet audit. Aucun verdict de sécurité des dépendances ne peut être déduit.

---

# 4. Contrôles positifs à préserver

- Tokens Supabase réellement validés côté serveur.
- Routes récentes `qcm`, `presentation`, `cv`, `article`, `revision` utilisant persona serveur et quota.
- Tests RLS cross-user sur vrai PostgreSQL et anti-auto-promotion.
- Tables `ai_interactions`, `ai_model_config`, `ai_prompts`, `usage_counters` protégées.
- CRUD de présentations via client Supabase scopé au token.
- Webhook Stripe : HMAC-SHA256, fenêtre temporelle et comparaison constante.
- Helpers d’échappement dans les pages HTML échantillonnées ; aucun XSS confirmé par la seule revue statique.
- Pièces jointes chat bornées à 6 Mo et réservées côté serveur aux personas déclarées vérifiées — contrôle utile, mais dépendant de la correction STRIX-001.

---

# 5. Ordre de remédiation

## Lot 0 — Containment immédiat

1. Protéger/désactiver temporairement `/api/transcribe` et `/api/ecos`.
2. Brancher le rate limiter sur `/api/chat` avant tout effet coûteux.
3. Invité limité au chatbot public.
4. Désactiver `verify_source_links` jusqu’à correction SSRF.
5. Suspendre l’auto-promotion étudiant/pro.

## Lot 1 — Identité et autorisation

Preuve de possession email, Pro Santé Connect/e-CPS ou revue manuelle, helper central d’accès, tests endpoint × persona × entitlement.

## Lot 2 — Quotas et validation

Quotas par feature/heure/jour/concurrence, Zod strict, historique serveur, limites body/MIME/magic bytes.

## Lot 3 — SSRF et egress

DNS/IP, redirections manuelles, allowlist/proxy isolé.

## Lot 4 — Safe-box et données de santé

ADR, décision juridique, restauration des couches techniques, cartographie de flux, AIPD et providers.

## Lot 5 — Plateforme

Réconciliation des branches, headers, SCA/SAST/secrets/SBOM et pentest dynamique réel sur staging.

---

# 6. Critères avant lancement

- Aucun rôle privilégié sans preuve de possession.
- Tout endpoint provider a auth, quota, taille et concurrence bornés.
- Tests SSRF redirections/DNS/IPv4/IPv6 verts.
- Safe-box et flux de données alignés avec la doctrine approuvée.
- Branches de promotion cohérentes et protégées.
- CI typecheck/tests/RLS/SAST/SCA/secrets verte.
- Pentest dynamique autorisé sans P0/P1 ouvert.

---

# 7. Limites

- Pas d’exécution réelle de Strix, DAST ou fuzzing.
- Pas de test contre le domaine déployé.
- Pas d’accès aux variables/configurations Vercel/Supabase/providers.
- Pas d’exploitation, scan réseau ou metadata.
- Pas de scan CVE des dépendances.
- Pas d’audit exhaustif des bundles vendor minifiés.
- Pas de validation juridique.

Le fichier compagnon `CLAUDE_CODE_SECURITY_REMEDIATION_2026-07-17.md` fournit le plan d’exécution directement utilisable par Claude Code.