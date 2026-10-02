# Runbook Claude Code — remédiation de l’audit sécurité du 17 juillet 2026

Ce fichier transforme `STRIX_STYLE_SECURITY_AUDIT_2026-07-17.md` en instructions opérationnelles.

## Règles impératives

1. Lire : `START.md`, `.ai-governance.md`, `docs/01_REGULATION.md`, `docs/03_SECURITY.md`, le rapport, puis ce runbook.
2. Aucun push direct sur `main`, `staging` ou `dev`.
3. Une branche et une PR par lot. Ne pas mélanger identité, quotas, SSRF et safe-box.
4. Écrire les tests de sécurité avant ou avec le correctif.
5. Aucune modification de l’intended purpose, du périmètre MDSW ou des données de santé sans ADR `Proposed` et arbitrage explicite de Hugo.
6. Aucun secret, token, contenu clinique ou donnée personnelle dans les logs/tests/fixtures.
7. Ne jamais contourner un test existant pour faire passer la CI.
8. Après chaque lot : `npm ci`, `npm run typecheck`, `npm run test`, `npm run compliance`.
9. Arrêter et demander arbitrage si une migration destructive, une révocation massive ou une décision juridique est nécessaire.

---

# Prompt maître pour Claude Code

```text
Tu travailles sur MedInfo AI. Lis d’abord START.md, .ai-governance.md,
docs/01_REGULATION.md, docs/03_SECURITY.md,
docs/audits/STRIX_STYLE_SECURITY_AUDIT_2026-07-17.md et
docs/audits/CLAUDE_CODE_SECURITY_REMEDIATION_2026-07-17.md.

Objectif : corriger UNIQUEMENT le lot que je te désigne, en TDD sécurité.

Workflow obligatoire :
1. Restitue les invariants et le threat model du lot.
2. Identifie les fichiers et migrations touchés.
3. Propose un plan précis et les tests de non-régression AVANT de coder.
4. Attends ma validation du plan.
5. Crée une branche ai/claude/security/<lot>-<description> depuis la base validée.
6. Écris les tests, implémente le correctif minimal, puis exécute typecheck/tests/compliance.
7. Réalise une auto-revue hostile : cherche comment contourner ton correctif.
8. Corrige les contournements et relance les tests.
9. Mets à jour docs/CHANGELOG_AI.md avec impact réglementaire et rollback.
10. Ouvre une PR en brouillon ; ne merge rien.

Interdits :
- ne pas changer l’intended purpose ;
- ne pas affaiblir RLS, auth ou safe-box ;
- ne pas faire confiance à un rôle, email, RPPS, userId, historique ou systemPrompt fourni par le client ;
- ne pas ajouter de données de santé dans les logs ;
- ne pas masquer une erreur de sécurité par un fallback permissif.
```

---

# LOT A — Preuve de possession des rôles

**Branche :** `ai/claude/security/role-proof-of-possession`  
**Findings :** STRIX-001, STRIX-009  
**Priorité :** P0

## Objectif

Aucun compte ne doit recevoir `student` ou `professional` à partir d’une simple valeur déclarée dans le body.

## Étudiant

- Lire l’utilisateur depuis le Bearer token.
- Utiliser l’adresse confirmée dans Supabase Auth.
- Vérifier `email_confirmed_at`.
- Ne jamais accepter `body.email` comme preuve.
- Pour une adresse secondaire : challenge OTP/magic link à usage unique, expirant, lié au `userId`, consommé atomiquement.

## Professionnel

- Conserver l’Annuaire Santé comme contrôle d’existence/activité seulement.
- Ne jamais écrire `professional` ou `verified_personas` sans preuve de possession.
- Utiliser Pro Santé Connect/e-CPS OIDC ou une revue manuelle. Sans intégration PSC, corriger fail-closed : rester `pending`.

## Bypass

- Supprimer `BYPASS_ROLE_VERIFICATION`, ou le rendre impossible sous `NODE_ENV=production` / `VERCEL_ENV=production`.
- Ajouter un test de configuration.

## Migration/arbitrage

- Préparer une requête listant les comptes déjà `student`/`professional`.
- Ne pas révoquer automatiquement sans validation Hugo.
- Proposer une migration de revalidation séparée si nécessaire.

## Tests obligatoires

1. Compte confirmé non académique + body académique → refus.
2. Email académique non confirmé → refus.
3. Email académique confirmé → succès.
4. RPPS actif d’un tiers → reste `pending`.
5. Bypass actif en production → erreur ou bypass ignoré.
6. RLS anti-auto-promotion toujours verte.

---

# LOT B — Auth, quotas et limites de coût

**Branche :** `ai/claude/security/feature-access-and-rate-limits`  
**Findings :** STRIX-002, STRIX-006  
**Priorité :** P0

## Objectif

Aucun appel fournisseur coûteux sans politique d’accès et de coût explicite.

## Helper proposé

```ts
interface FeatureAccessPolicy {
  feature: string;
  allowedPersonas: Persona[] | 'anonymous-public-only';
  dailyLimit: number;
  hourlyLimit?: number;
  concurrentLimit?: number;
  maxBodyBytes?: number;
  entitlement?: string;
}

async function enforceFeatureAccess(
  request: Request,
  policy: FeatureAccessPolicy,
): Promise<AccessGranted | Response>;
```

Le helper doit valider token/persona/entitlement, appliquer les quotas par feature, utiliser userId ou une identité anonyme robuste, refuser avant parsing lourd/provider et fail-closed si le backend configuré échoue.

## Routes minimales

- `/api/chat`
- `/api/transcribe`
- `/api/ecos`
- `/api/chat-meta`
- vérifier `analyze`, `qcm`, `presentation`, `cv`, `cv-import`, `article`, `revision`.

## Politiques de départ

- Invité : chatbot public uniquement, 1 essai serveur, peu d’étapes, pas de PubMed/ClinicalTrials.
- Chat connecté : quota par persona/plan, plafond d’étapes/tokens.
- Transcribe : compte autorisé, quota séparé, limite horaire et concurrence 1.
- ECOS : étudiant/pro/admin uniquement.
- Chat-meta : quota dédié ou fallback déterministe.

## Tests

1. Chat appelle le quota avant runtime/outils.
2. Invité ne choisit pas student/pro.
3. Requêtes invitées séparées ne recréent pas l’essai.
4. Transcribe sans token → refus, provider non appelé.
5. Transcribe après quota → 429, provider non appelé.
6. ECOS anonyme/public → refus.
7. Erreur RPC quota → refus en production.
8. Second audio concurrent → refus.

---

# LOT C — Schémas API stricts et suppression du `systemPrompt` client

**Branche :** `ai/claude/security/strict-api-schemas`  
**Finding :** STRIX-005  
**Priorité :** P1

## Chat

- Zod strict pour les messages.
- Limites nombre, caractères et taille cumulée.
- Refuser/reconstruire les rôles `assistant`, `tool` et résultats non issus du serveur.
- Idéalement : dernier message utilisateur + `conversationId`, historique own-row reconstruit côté serveur.

## ECOS

- Body : `caseId`, `mode`, messages bornés.
- Charger le cas publié depuis la DB.
- Construire le system prompt côté serveur.
- Refuser tout champ `systemPrompt` client.

## Audio/documents/pièces jointes

- Limite au niveau Vercel/reverse proxy avant `request.json()`/`formData()` lorsque possible.
- MIME explicite + magic bytes.
- Durée audio bornée.
- Fichier invalide → 400 explicite, jamais ignoré silencieusement.
- Ne pas décoder base64 avant auth/quota.

## Tests

- Rôle message arbitraire → 400.
- Historique trop grand → refus avant provider.
- `systemPrompt` ECOS client → refus/ignoré, cas DB utilisé.
- Faux MIME PDF → refus.
- Pièce jointe invalide → 400.
- Body trop gros → 413 avant traitement coûteux.

---

# LOT D — SSRF et egress sûr

**Branche :** `ai/claude/security/safe-egress-link-verifier`  
**Finding :** STRIX-003  
**Priorité :** P0

## Implémentation

- `redirect: 'manual'`.
- `resolveAndValidatePublicHost()` avec `dns.promises.lookup({ all: true })`.
- Rejeter IPv4/IPv6 privées, loopback, link-local, multicast, metadata et plages non routables.
- Ports 80/443 seulement.
- Maximum 3 redirections ; valider chaque `Location`.
- Ne pas faire confiance à un cache qui éviterait la validation réseau de sécurité.
- Envisager une allowlist des domaines médicaux nécessaires.

## Tests

- Public → `127.0.0.1` : aucune connexion loopback.
- Public → `169.254.169.254` : refus.
- A record RFC1918 : refus.
- AAAA `::1`, ULA ou link-local : refus.
- Port 8080 : refus.
- Plus de 3 redirections : refus.
- DOI/HAS/PubMed public : réussite.

---

# LOT E — Safe-box et données de santé

**Branche après ADR :** `ai/claude/security/safe-box-restoration`  
**Finding :** STRIX-004  
**Priorité :** P0, arbitrage humain avant code

## Phase 1 — ADR uniquement

Décrire pour chat, analyse, audio et pièces jointes :

- données acceptées ;
- providers destinataires ;
- persistance, logs, rétention, résidence, ZDR et DPA ;
- statut HDS ;
- intended purpose réel ;
- décision maintenir/désactiver/isoler.

## Phase 2 — Tests avant implémentation

- Golden set `general_info`, `personal_symptoms`, `emergency`, `ambiguous`, jailbreak.
- Cas interdits : modèle principal jamais appelé.
- Sortie individualisée bloquée.
- Aucun contenu clinique brut dans les logs.
- Feature sensible désactivée si configuration conformité absente.

## Phase 3 — Implémentation minimale

- Classifieur déterministe prioritaire.
- Deuxième étage fail-closed si retenu.
- Validation de sortie compatible streaming.
- Refus canonique source unique.
- Instrumentation sans contenu utilisateur.

---

# LOT F — En-têtes navigateur

**Branche :** `ai/claude/security/browser-security-headers`  
**Finding :** STRIX-007  
**Priorité :** P1

- Ajouter HSTS, nosniff, Referrer-Policy, Permissions-Policy et CSP.
- `frame-ancestors` contre clickjacking.
- Inventorier scripts/styles/images/fetch/frames/providers.
- Auto-héberger les polices et retirer Google Fonts si possible.
- Déployer CSP Report-Only puis enforcement.
- Tests d’intégration sur headers et pages autonomes.

---

# LOT G — Branches et CI

**Branche :** à décider après choix de la source de vérité  
**Findings :** STRIX-008, STRIX-010

1. Lister les commits propres à `dev` et les changements uniquement sur `main`.
2. Décider avec Hugo de la source de vérité.
3. Ne pas faire de merge aveugle.
4. Pinner les actions par SHA.
5. `npm ci`.
6. CodeQL, SCA/OSV, Gitleaks, SBOM.
7. Checks obligatoires sur branches protégées.
8. Documenter le SHA déployé Vercel.

---

# Auto-revue hostile obligatoire

Avant de terminer chaque lot, répondre dans la PR :

1. Quelle entrée client influence encore une autorisation ?
2. Peut-on provoquer le même coût par un autre endpoint ou une autre identité ?
3. Le contrôle arrive-t-il avant tout effet coûteux ?
4. Que se passe-t-il si Supabase, provider ou DNS échoue ?
5. Existe-t-il un fallback permissif ?
6. Redirections, IPv6, concurrence et replays sont-ils testés ?
7. Le correctif ajoute-t-il des données personnelles dans les logs ?
8. Une migration/cache conserve-t-il un ancien privilège ?
9. La branche déployée contient-elle réellement le correctif ?
10. Quel rollback restaure le service sans rouvrir la faille ?

# Définition de terminé

- tests d’exploitation rouges avant, verts après ;
- tests existants verts ;
- aucun contrôle uniquement UI ;
- threat model, impact, rollback et limites documentés ;
- aucune P0/P1 du lot ouverte sans arbitrage explicite ;
- PR en brouillon jusqu’à revue humaine.