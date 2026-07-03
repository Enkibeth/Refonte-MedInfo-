# Potentiel de monétisation — MedInfo AI (état 2026-07)

```yaml
status: Rapport d'analyse (aucune décision engagée)
date: 2026-07-03
owner: Hugo Bettembourg
hypothese_centrale: toutes les features du dépôt fonctionnent parfaitement
avertissement: les chiffres de marché et de conversion sont des ORDRES DE GRANDEUR
  posés comme hypothèses de travail, pas des données vérifiées
```

## 1. Résumé exécutif

En l'état, MedInfo AI est un **produit étudiant en médecine monétisable immédiatement**,
avec un chat santé grand public en produit d'appel et un segment professionnel
volontairement gelé (ADR-0006) qui constitue la plus grosse option de croissance
non exercée.

- **Ce qui encaisse déjà** : Stripe web-first opérationnel (checkout, webhook signé,
  idempotence), 3 plans — Public Mid 4,99 €/mois, Étudiant Mid 7,99 €/mois,
  Étudiant Premium 14,99 €/mois. Pas de commission d'app store (vente web).
- **Le moteur de conversion existe** : essai invité 1 message → inscription gratuite
  (10 msg/jour public, 20 msg/jour étudiant) → paywall « messages illimités ».
- **Potentiel annuel plausible à 12-18 mois** (hypothèse « tout marche ») :
  **≈ 40 k€ ARR en scénario prudent, ≈ 250 k€ en scénario médian, ≈ 900 k€ en
  scénario ambitieux**, quasi exclusivement porté par le segment étudiant.
  Le déblocage du segment professionnel (hors périmètre actuel) changerait
  l'ordre de grandeur (× 3 à × 10 à terme).
- **Risque économique n°1 identifié dans le code** : l'abonnement payant donne des
  messages *illimités* (`resolveEntitlement` → `unlimitedMessages: true`) alors que
  chaque réponse du chat déclenche une boucle agentique jusqu'à 12 étapes avec
  web_search. Un utilisateur intensif peut coûter plus cher que son abonnement.
  Une clause de fair use / un plafond souple est indispensable avant de pousser
  l'acquisition.

## 2. Inventaire des actifs monétisables (vérifié dans le code)

| Actif | Segment | État | Valeur monétisable |
|---|---|---|---|
| Chat 3 chatbots, workflow evidence-first (Europe PMC, ClinicalTrials.gov, vérification des liens, PubMed MCP côté pro) | Tous | Actif | Cœur de l'abonnement ; différenciant vs ChatGPT générique : sources réelles vérifiées, zéro lien mort |
| Analyse de document avec citations ancrées (API Citations) | Public | Actif | Feature d'appel forte (ordonnances, comptes rendus) ; anti-hallucination démontrable |
| ECOS (16 cas, simulation + évaluation) | Étudiant | Actif | Argument n°1 du plan Premium — la réforme EDN/ECOS est le point de douleur payant du marché |
| Dashboard de révision + coup de pouce IA | Étudiant | Actif | Rétention quotidienne (autosave, planning) → réduit le churn |
| Analyse des partiels (medoutils) | Étudiant | Actif | Acquisition virale : un étudiant importe le classement de TOUTE sa promo |
| Générateur de présentations + historique cloud | Étudiant + Pro | Actif | Valeur récurrente (topos, staffs) ; export PPTX |
| CV Builder + relecture IA + import | Étudiant + Pro | Actif | Usage ponctuel mais fort déclencheur d'inscription (internat, candidatures) |
| Audio → transcription + compte rendu | Pro | Actif | Feature pro la plus « facturable » du dépôt (équivalents marché vendus 50-100 €/mois) — aujourd'hui offerte |
| Blog + agent éditorial hebdo + refonte SEO complète (sitemap, JSON-LD, maillage) | Acquisition | Actif | Canal d'acquisition organique à coût marginal ≈ 0 |
| Panel admin (modèle/prompt/réglages par feature) | Interne | Actif | Pilotage du coût unitaire sans redéploiement (ex. downgrader un modèle si la marge se dégrade) |
| Vérification étudiant (e-mail académique) + RPPS (prête, clé absente) | Infra | Actif / en attente | Segmentation tarifaire fiable = capacité à pratiquer 3 prix sans fuite entre segments |

Verrous conformes et sains pour le pricing : le paywall ne gate **que le volume**
(jamais les sources HAS/ANSM — invariant testé), l'entitlement vient exclusivement
du webhook Stripe (inviolable côté client), les quotas sont comptés côté serveur.

## 3. Le modèle de revenus tel qu'il est codé

```
Visiteur (1 msg gratuit, localStorage + refus serveur 401)
  → Inscription gratuite (public : 10 msg/j ; étudiant vérifié : 20 msg/j)
    → Public Mid 4,99 €/mois  : messages illimités + suggestions
    → Étudiant Mid 7,99 €/mois : illimité + mode EDN/ECOS + export de fiches
    → Étudiant Premium 14,99 €/mois : + stations ECOS simulées + classement gamifié
Professionnel : AUCUN plan (gelé ADR-0006) — outils pro accessibles gratuitement
```

Constats structurels :

1. **Le plan public est faible en valeur perçue** : 10 messages/jour gratuits couvrent
   l'immense majorité des usages grand public ; « illimité + suggestions » est un
   argument mince à 4,99 €. Conversion attendue très basse (< 1 %).
2. **Le plan étudiant est le bon produit au bon prix** : les étudiants dépensent
   couramment plusieurs centaines d'euros par an en préparation privée EDN
   (ordre de grandeur 500–1 500 €/an) ; 96–180 €/an pour un copilote complet
   (chat sourcé + ECOS + révision + partiels + présentations + CV) est positionné
   très en dessous de la douleur.
3. **Le segment pro est un actif dormant** : audio (compte rendu de consultation),
   PubMed MCP, présentations, CV — déjà livrés, offerts gratuitement, alors que
   les comparables marché (UpToDate ≈ 40–50 €/mois, solutions de dictée médicale
   50–100 €/mois) montrent l'ARPU le plus élevé de tout le produit. Le gel est
   réglementaire (ADR-0006), pas technique : c'est une option, pas une perte.
4. **Pas de tarif annuel** (`plans.ts` : mensuel uniquement) : levier classique de
   trésorerie et de réduction du churn (−20 à −35 % de churn constaté sur ce type
   d'offre), coût d'implémentation quasi nul (un price_id Stripe par plan).
5. **Pas d'offre B2B** : tutorats, corpos/BDE, facultés, bibliothèques universitaires
   — des acheteurs uniques pour des licences de groupe étudiantes.

## 4. Marchés adressables (ordres de grandeur, hypothèses)

| Segment | Taille France (hypothèse) | Disposition à payer | ARPU visé |
|---|---|---|---|
| Étudiants en médecine (2e cycle + internat) | ≈ 90 000–100 000 ; > 200 000 en élargissant MMOP/paramédical | Forte (enjeu concours, habitude de payer des prépas) | 8–15 €/mois |
| Grand public cherchant de l'info santé | Dizaines de millions de recherches santé/mois | Très faible (offre gratuite abondante : Ameli, Doctolib, forums, ChatGPT) | ≈ 5 €/mois, conversion marginale |
| Professionnels de santé | ≈ 230 000 médecins ; > 1 M de soignants au total | Forte si gain de temps documenté (dictée, biblio) | 30–80 €/mois (référence marché) — **gelé** |

## 5. Scénarios de revenus à 12–18 mois (hypothèse : tout marche parfaitement)

Hypothèses communes : marché France uniquement, pas de budget pub significatif
(acquisition = SEO/blog + bouche-à-oreille promo via l'analyseur de partiels),
mix étudiant 70 % Mid / 30 % Premium → ARPU étudiant ≈ 10,1 €/mois.

| | Prudent | Médian | Ambitieux |
|---|---|---|---|
| Étudiants inscrits (gratuits) | 3 000 (≈ 3 % du 2e cycle) | 12 000 | 35 000 |
| Conversion payante étudiante | 8 % | 15 % | 20 % |
| Étudiants payants | 240 | 1 800 | 7 000 |
| MRR étudiant | ≈ 2 400 € | ≈ 18 200 € | ≈ 70 700 € |
| Inscrits publics | 10 000 | 60 000 | 250 000 |
| Conversion publique (4,99 €) | 0,3 % | 0,7 % | 1 % |
| MRR public | ≈ 150 € | ≈ 2 100 € | ≈ 12 500 € |
| **MRR total** | **≈ 2 550 €** | **≈ 20 300 €** | **≈ 83 200 €** |
| **ARR** | **≈ 31 k€** | **≈ 244 k€** | **≈ 998 k€** |

Lecture honnête : le scénario prudent est atteignable par simple bouche-à-oreille
dans quelques promos (l'analyseur de partiels est le cheval de Troie : un seul
utilisateur y expose tout son classement de promo au produit). Le médian suppose
une vraie présence dans ~10 facultés et un SEO qui délivre. L'ambitieux suppose
une position de quasi-standard chez les carabins — possible sur 18 mois seulement
si la rétention est excellente pendant les périodes de révision.

Option non exercée (hors périmètre actuel, nécessite levée du gel ADR-0006 +
RPPS actif) : 1 000 à 5 000 pros payants à 40 €/mois = **480 k€ à 2,4 M€ d'ARR
additionnels**. C'est là que se situe le vrai plafond de valorisation du projet ;
l'alternative « modèle OpenEvidence » (gratuit pour les soignants, financé par
l'industrie) est aussi crédible mais incompatible avec la posture réglementaire
actuelle du dépôt.

## 6. Économie unitaire (le point de vigilance)

- Une réponse du chat = gpt-5.2 + web_search + jusqu'à 12 étapes d'outils
  (Europe PMC, vérification de liens) ≈ **0,02 à 0,10 € de coût variable**
  (ordre de grandeur ; visible et pilotable via le panel admin).
- Utilisateur gratuit public : ≤ 10 msg/j → coût plafonné ≈ 1 €/mois au pire. Sain.
- **Abonné payant : illimité.** Un étudiant qui pose 40 questions/jour en période
  d'EDN coûte 25–120 €/mois pour 7,99–14,99 € encaissés. La queue de distribution
  (top 2-5 % d'usage) peut absorber la marge de tout le reste.
  - Mitigations disponibles sans rien casser : fair use contractuel (CGU),
    plafond souple élevé (ex. 100 msg/j) au-delà duquel le modèle bascule sur un
    tier plus économique via le panel admin, ou quota par feature (la matrice
    ADR-0016 est décidée mais la migration `0014` n'existe pas encore dans le dépôt).
- Marge brute attendue une fois le plafonnement en place : **75–85 %**, standard SaaS.
- Coûts fixes quasi nuls (Vercel + Supabase + cron hebdo) : le seuil de rentabilité
  opérationnel se joue à quelques dizaines d'abonnés étudiants.

## 7. Leviers classés (impact × effort), sans changer le périmètre produit

1. **Tarif annuel étudiant** (ex. 79 €/an Mid, 149 €/an Premium) — effort ≈ nul
   (2 price_id Stripe + 4 lignes dans `plans.ts`), impact churn et trésorerie fort,
   calé sur l'année universitaire.
2. **Fair use sur l'illimité** — protège la marge avant toute campagne d'acquisition.
3. **Muscler le plan Public ou l'assumer comme produit d'appel** — en l'état, le
   public sert surtout à nourrir le SEO et le bouche-à-oreille ; c'est défendable,
   mais alors autant concentrer 100 % de l'effort commercial sur l'étudiant.
4. **Offre B2B tutorat/promo** (licences groupées, réduction volume) — un seul deal
   = des centaines d'abonnés, et le produit a déjà la vérification par e-mail
   académique pour provisionner proprement.
5. **Exploiter la saisonnalité** : pics EDN/partiels (rentrée, décembre-janvier,
   mai-juin) — campagnes de conversion synchronisées, l'infrastructure (quotas,
   compteurs, panel admin) le permet déjà.
6. **Préparer (sans l'ouvrir) le dossier pro** : RPPS déjà codé, features pro déjà
   livrées — le jour où l'arbitrage réglementaire (ADR-0006) tombe, le time-to-revenue
   est de l'ordre de jours, pas de mois.

## 8. Ce qui borne le potentiel (même si « tout marche »)

- **Réglementaire** : la sécurité du chat est temporairement relâchée (ADR-0024) ;
  la réintroduction de la safe-box est un prérequis de fait à toute acquisition
  payante à grande échelle (risque AI Act / positionnement non-MDSW). Budgéter ce
  chantier avant le scale, pas après.
- **Mono-marché francophone** : le pricing et le produit (HAS/ANSM, EDN/ECOS) sont
  franco-centrés — c'est une force de niche et un plafond.
- **Dépendance aux fenêtres d'examen** : churn étudiant structurel après l'EDN ;
  le tarif annuel et les outils « carrière » (CV, présentations) sont les amortisseurs.
- **Concurrence gratuite généraliste** (ChatGPT et consorts) : le fossé défendable
  est précisément ce qui est déjà codé — sources vérifiées, citations ancrées,
  outils métier intégrés — à condition de le marketer comme tel.

## 9. Verdict

Le projet est **économiquement viable dès aujourd'hui sur le segment étudiant**,
avec un chemin réaliste vers ~20 k€ de MRR à 12-18 mois sans budget marketing
significatif, une structure de coûts quasi nulle, et deux décisions à faible coût
qui protègent l'essentiel (tarif annuel, fair use). Le grand public est un canal
d'acquisition plus qu'une source de revenus. La valeur terminale du projet réside
dans le segment professionnel déjà construit mais volontairement gelé : c'est une
option réglementaire dont l'exercice multiplierait le potentiel par un facteur
3 à 10.
