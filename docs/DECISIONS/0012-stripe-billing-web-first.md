# ADR-0012 — Facturation Stripe web-first (freemium tiered)

```yaml
status: Accepted
date: 2026-06-05
owner: Hugo Bettembourg
linked_to: [01_REGULATION §5 §6, 06_BILLING §1 §3 §4 §5 §6, 02_ARCHITECTURE §4, ADR-0011]
```

## Contexte
Étape 7 (START.md) : monétiser le produit sans casser la safe-box non-MDSW ni le budget.
06_BILLING fixe le modèle : **freemium tiered par audience**, **Stripe direct web-first**, **zéro
IAP** (économie 15-30 % de commission Apple/Google), **TVA franchise en base** (EI).

## Décision
1. **Stripe web-first, zéro IAP** (06_BILLING §3). L'abonnement se souscrit sur le web (Stripe
   Checkout). Sur natif (iOS/Android) : **aucun prix ni bouton d'achat** (règle Apple 3.1.3(b)
   Multiplatform) — garde `shouldShowWebBilling(Platform.OS)`, testée.
2. **Tiers MVP uniquement public + étudiant** (`public_mid`, `student_mid`, `student_premium`).
   **Aucun plan professionnel** : gelé par ADR-0006. Tout achat de plan pro échoue (id inconnu → 422).
3. **Webhook Stripe signé = SEULE source de vérité** du statut payant. Signature vérifiée
   (`verifyStripeSignature`, HMAC-SHA256 maison, timing-safe, fenêtre anti-rejeu), idempotent
   (table `billing_events`), écriture via **service_role** uniquement.
4. **Anti-auto-promotion** (même doctrine qu'ADR-0011) : RLS `subscriptions` = lecture own-row,
   **aucune écriture client**. Le client ne peut pas s'attribuer/modifier un plan payant. Prouvé
   par `tests/rls/billing-isolation.test.ts` (vrai Postgres).
5. **Le paywall ne gate QUE le volume de messages** (et des features avancées). Il ne touche
   **jamais** l'accès aux sources HAS/ANSM (06_BILLING §5, critique). L'`Entitlement` n'expose
   aucun champ de gating de sources — invariant verrouillé par test.
6. **No-SDK Stripe** : signature + REST Checkout faits maison (`node:crypto` / `fetch` injectable).
   Tests 100 % hors réseau, zéro nouvelle dépendance npm (cohérent invariant « un seul package.json »).
7. **TVA EI** : mention « TVA non applicable, article 293 B du CGI » affichée (06_BILLING §4).

## Données de facturation (RGPD, 06_BILLING §6)
Tables `subscriptions` (user_id, stripe_customer_id, stripe_subscription_id, plan, statut, période)
et `billing_events` (idempotence). **Aucune donnée de santé.** L'e-mail reste dans `auth.users`
(non dupliqué). Stripe = sous-traitant Art. 28 → à lister dans la politique de confidentialité.

## Alternatives écartées
- **IAP Apple/Google** : 15-30 % de commission, TVA plus complexe, moins de contrôle → rejeté (§3).
- **SDK `stripe` officiel** : pratique mais ajoute une dépendance lourde et complique les tests
  offline ; la pièce critique (signature) gagne à être possédée et testée directement → no-SDK.
- **Merchant of Record (Lemon Squeezy / Paddle)** : pertinent **au-delà de 37 500 €** de CA
  (gestion TVA OSS), pas au MVP (06_BILLING §4) → reporté.
- **Stocker un statut payant côté client / profiles** : rejeté (surface d'auto-promotion). Source
  de vérité = webhook serveur uniquement.

## Impact réglementaire
- **Safe-box : None.** Les 3 couches de refus et le classifieur couche 1 sont **inchangés**. Le
  rate-limit ne fait que lever le quota pour un abonné actif (volume, jamais les sources).
- **RGPD : Potential (maîtrisé).** Nouveau sous-traitant Stripe (Art. 28) à documenter ; zéro
  donnée de santé en facturation ; séparation stricte facturation / contenu médical.
- **MDSW : aucun.** La facturation n'agit pas sur des données patient.

## Hors périmètre (garde-fous maintenus)
- Pas d'historique de conversation, pas de « dossiers », aucune persistance de contenu de message
  (= donnée de santé → HDS, 01_REGULATION §5). Si un jour nécessaire : ADR « Proposed » + arbitrage
  AVANT toute ligne de code.
- Vérification d'audience étudiante : déjà couverte par ADR-0011 (`isAcademicEmail`).

## Secrets (hors repo — action Hugo)
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`STRIPE_PRICE_PUBLIC_MID`, `STRIPE_PRICE_STUDENT_MID`, `STRIPE_PRICE_STUDENT_PREMIUM`,
`EXPO_PUBLIC_APP_URL` → à poser dans Vercel (cf `docs/09_DEPLOYMENT.md`). Jamais committés.

## Rollback
`git revert` de la PR. Aucune destruction de données : retirer les variables Stripe de Vercel
suffit à désactiver la surface (les routes renvoient 503 « non configuré »). Les migrations
`0007`/`0008` sont additives ; un `DROP TABLE subscriptions, billing_events` + `DROP TYPE
billing_plan, subscription_status` les annule si besoin.
