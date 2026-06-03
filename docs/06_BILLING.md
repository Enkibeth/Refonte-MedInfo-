# MedInfo AI — Facturation & Modèle Économique

```yaml
title: Billing & Monetization
version: 1.1.0
owner: Hugo Bettembourg
status: Active
date: 2026-06-03
linked_to: [00_CHARTER.md, 01_REGULATION.md, 02_ARCHITECTURE.md]
```

> **Décision structurante : web-first, Stripe direct, ZÉRO IAP.** Économise 15-30% de commission Apple/Google sur chaque euro. Détail §3.

---

## 1. Modèle : freemium tiered par audience

Sources JAMAIS gatées (cf §5). Vérification d'audience MVP : universités françaises pour les étudiants. **Le module professionnel, la vérification RPPS et les tiers Pro sont documentés comme trajectoire post-MVP uniquement et ne doivent pas être activés avant les conditions d'ADR-0006.**

| | **Public — MVP activé** | **Étudiant — MVP activé après vérification** | **Pro — post-MVP non activé** |
|---|---|---|---|
| **Free** | 10 msg/j, sources visibles | 20 msg/j, features complètes | Non disponible au MVP |
| **Mid** | **4,99 €/mois** — illimité, historique, follow-ups | **7,99 €/mois** — illimité, mode EDN/ECOS, export fiches, répétition espacée | Hypothèse future : **19 €/mois**, non activable avant ADR-0006 |
| **Premium** | — (ne pas fragmenter) | **14,99 €/mois** — stations ECOS simulées, classement gamifié | Hypothèse future : **39 €/mois**, non activable avant ADR-0006 |

**Benchmarks :** étudiants FR (Hypocampus ~20 €, CatalyScool ~15-20 €, EDN.fr ~30 €) → sweet spot nouvel entrant **5-15 €**. Pros (UpToDate 579 $/an, Glass Health 20-200 $/mois) → **15-39 €** défendable mais **hors MVP**. Public : 80%+ veulent gratuit → tier à 4,99 € capture les enthousiastes.

---

## 2. Économie unitaire & marges

Routage cascade (cf `02_ARCHITECTURE.md` §5) : conversation typique ~**0,016 €** (GPT-5.4 mini défaut) / ~0,058 € (Sonnet escalade pro).

**Marge brute > 75% sur tous tiers** avec mini en défaut. Tout sur Sonnet → marge étudiante chute à ~25% (à éviter). Le classifieur de difficulté décide l'escalade.

---

## 3. Web-first, pas d'IAP (décision la plus rentable)

- Apple : **30% an 1, 15% après** (15% dès le départ via Small Business Program si CA < 1 M$).
- **Guideline Apple 3.1.3(b) Multiplatform Services** : l'utilisateur s'abonne **sur le web (Stripe)**, l'app iOS sert de **client** à un compte existant, **sans aucun bouton d'abonnement in-app**. Modèle Netflix/Spotify/ChatGPT, validé par App Review.
- **Conséquence :** zéro commission, TVA simplifiée, contrôle des remboursements, pricing -25% à marge égale.
- **Règle d'implémentation :** l'app mobile **ne mentionne jamais de prix ni de bouton d'achat**. Elle connecte un compte déjà souscrit. Tout achat se fait sur le site web.

---

## 4. Paiement & TVA (entrepreneur individuel)

- **Stripe direct** tant que sous **franchise en base TVA services = 37 500 € N-1 / 41 250 € N**.
- Mention facture obligatoire : *« TVA non applicable, article 293 B du CGI ».*
- Frais Stripe ~1,5% + 0,25 €/transaction (carte UE).
- Plafond micro-entreprise BNC = **77 700 €** (vérifier seuil en vigueur ; LF récentes l'ont fait évoluer). Cotisations URSSAF BNC libéral SSI ≈ **24,6%** du CA (vérifier taux courant).
- **Au-delà de 37 500 €** : basculer vers **Lemon Squeezy / Paddle** (Merchant of Record, gèrent TVA OSS intra-UE). +2,5% de frais compensés par le temps économisé sur déclaration OSS (27 États membres).

> ⚠️ Seuils et taux fiscaux changent chaque année. Revérifier sur impots.gouv.fr / URSSAF à chaque exercice. Valeurs ci-dessus = ordres de grandeur 2026, à confirmer.

---

## 5. Ne JAMAIS gater les sources (critique)

Trois raisons cumulatives :
1. **Confiance/sécurité** : un chatbot médical sans sources = « clone ChatGPT qui hallucine ». Conversion free→paid s'effondre.
2. **Positionnement réglementaire** : « sources = premium » ⇒ récit « version gratuite = info médicale sans support probant » → qualification non-MDSW plus dure à défendre devant l'ANSM.
3. **Marque** : OpenEvidence a bâti sa valeur sur « gratuit + sources vérifiées pour tous ». Vendre les sources est l'inverse philosophique.

**Gater à la place :** nombre de messages, features avancées (dossiers, export PDF, mode ECOS, intégrations, gamification), historique au-delà de N jours.

---

## 6. Données de facturation (RGPD)

- Table `subscriptions` (Stripe customer id, tier, statut, période). RLS user-scoped.
- **Aucune donnée santé** dans la facturation. Séparation stricte facturation / contenu médical.
- Stripe = sous-traitant Art. 28 → listé dans la politique de confidentialité.
- Webhooks Stripe vérifiés (signature) côté Edge. Idempotence sur events.

---

## 7. Sponsoring pharma (repoussé)

**Impossible an 1-2 en France.** Art. L.5122-6 CSP interdit la pub grand public médicaments sur prescription ; pub HCP exige **visa PM ANSM** par contenu — inopérable solo. À repousser à 10 000+ HCP vérifiés + structure SASU adaptée.

---

## 8. Trajectoire revenus (réaliste 6 mois)

~500 utilisateurs actifs, ~30-50 abonnés payants, ~**300-800 €/mois MRR**. Loin du break-even comptable mais valide la traction → décision bootstrap / seed / pivot. Bascule Supabase Pro + Vercel Pro **synchronisée au 1ᵉʳ revenu**, pas avant.

---

## 9. Coûts & abonnements (vue consolidée)

> Tu quittes Hostinger (qui hébergeait WordPress). La pile devient un ensemble de services managés, chacun gratuit au démarrage puis payant au-delà d'un seuil. Modèle « coût variable qui scale avec l'usage » au lieu du « coût fixe » Hostinger.

### 9.1 Tous les services

| Service | Remplace | Gratuit jusqu'à | Coût ensuite | Déclencheur du paiement |
|---|---|---|---|---|
| **Vercel** (hébergement web + API) | Hostinger (front) | Hobby (perso, **non-commercial**) | ~20 $/mois (Pro) | **Lancement commercial** (Hobby interdit le commercial) |
| **Supabase** (DB + Auth + pgvector) | Hostinger (back/DB) | Free : 50k MAU, 500 Mo DB | ~25 $/mois (Pro) | Dépassement free **ou** lancement payant (backups) |
| **OpenAI API** (LLM) | — (AI Engine le masquait) | rien — payant à l'usage | ~0,016 €/conversation (mini) | **Dès le 1ᵉʳ test réel** |
| **Apple Developer** | — | rien | ~92 €/**an** | Avant soumission iOS |
| **Google Play** | — | rien | ~23 € **one-time** | Avant soumission Android |
| **Stripe** (paiement) | — | pas de frais fixes | ~1,5% + 0,25 €/transaction | Uniquement à l'encaissement |
| **Nom de domaine** | (déjà acquis) | — | ~12 €/an | Renouvellement medinfo-ai.com |
| **Sentry** (monitoring) | — | Free (suffisant au début) | ~26 $/mois si gros volume | Probablement jamais en MVP |

### 9.2 Projection de trésorerie

**Phase dev (mois 0-3) : ~0 €/mois récurrent.**
Vercel Hobby + Supabase Free + Sentry Free = gratuit. Dépenses réelles = OpenAI API (quelques dizaines d'€ sur la période de dev/test) + Apple Developer (92 €). L'essentiel du budget 500 € part ici.

**Phase lancement (mois 4-6) : ~45 $/mois (~42 €) récurrent.**
Bascule Vercel Pro (20 $) + Supabase Pro (25 $) **synchronisée au 1ᵉʳ revenu** (règle `02_ARCHITECTURE.md §7`). Censé être déjà couvert par le MRR naissant.

### 9.3 Le coût qui scale avec le succès

L'**OpenAI API** est le coût nouveau (avant, ta clé + AI Engine le masquaient dans l'abonnement Meow Apps). Il monte avec l'usage :
- 1 000 conversations/mois ≈ 16 €
- 10 000 conversations/mois ≈ 160 €

Maîtrisé par : **rate limiting** (`03_SECURITY.md §3`) + **routing cascade** (modèle `mini` par défaut, Sonnet seulement en escalade `02_ARCHITECTURE.md §5`). La marge (§2) doit toujours couvrir ce coût variable.

### 9.4 Règle pour agents IA

Ne souscrire **aucun** service payant tant que (a) le free tier suffit, ou (b) le 1ᵉʳ revenu n'est pas encaissé. Hobby/Free d'abord. Toute souscription = ADR dans `docs/DECISIONS/`.

---

## 10. Vérification de statut (étudiant MVP / professionnel post-MVP)

> Prérequis du gating par audience. En MVP, seule la vérification étudiant est active. La vérification professionnelle via Annuaire Santé est documentée pour le module Pro reporté, mais ne doit pas être branchée dans le produit avant ADR-0006.

### 10.1 Étudiants — allowlist `.fr` + fallback manuel (coût 0 €, ~1 jour)

Magic link Supabase Auth + **allowlist d'~40 domaines universitaires `.fr`** (Sorbonne Université, Paris Cité, Paris-Saclay, Lyon 1, Aix-Marseille, Lille, Bordeaux… incluant sous-domaines `etu.*`, `etud.*`), maintenu en JSON versionné dans le repo. Re-vérification à la rentrée (sept-oct). Fallback : upload manuel carte étudiant + certificat de scolarité (Supabase Storage privé RLS, **suppression auto sous 7 j** = minimisation RGPD), validé en page admin. Warning au signup : fausse déclaration = résiliation.

SheerID couvre la France mais tarif enterprise (hors budget). API Statut étudiant DINUM = réservée administrations (accès improbable pour SaaS privé). → allowlist suffit au MVP.

### 10.2 Professionnels — API FHIR Annuaire Santé (post-MVP, non activé)

L'**API FHIR R4 de l'Annuaire Santé (ANS)** est gratuite, publique, opérable par un tiers sans habilitation lourde depuis sa v2 (avril 2025). Inscription dev libre : portail.openfhir.annuaire.sante.fr. Doc : ansforge.github.io/annuaire-sante-fhir-documentation.

```
GET https://gateway.api.esante.gouv.fr/fhir/v2/Practitioner?identifier=http://rpps.fr|{RPPS_11_chiffres}
Header: GRAVITEE-API-KEY: <clé>
```

Retourne nom, profession, spécialité, structures. Bundle vide = non inscrit/radié. **Bonus** : depuis ADELI→RPPS, toutes les professions de santé y sont, ET les internes ont un RPPS via la CPF → on identifie internes + seniors d'un seul flux. Cross-check du nom saisi vs `Practitioner.name` pour réduire l'usurpation. Clé en Supabase Vault, cache 24 h.

### 10.3 Pro Santé Connect — REPORTÉ v2

PSC (OIDC e-CPS) est gratuit mais exige KBIS personne morale + **hébergement HDS** (~100-200 €/mois, casse le budget MVP) + DataPass + cycle 2-4 mois. **Non obligatoire** tant que MedInfo ne traite pas de données patient identifiantes. → v2/v3 après incorporation + HDS.

### 10.4 Arbitrage

Tolérer la fraude sur le tier étudiant (unit economics minimes), être strict sur le tier pro. Base légale RGPD : Art. 6(1)(b) exécution de contrat. RPPS = donnée personnelle mais largement publique (risque faible). Photos de carte = sensibles → suppression auto 7-30 j.
