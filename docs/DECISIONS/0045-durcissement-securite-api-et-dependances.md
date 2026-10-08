# ADR-0045 — Durcissement sécurité des API et dépendances

- Date : 2026-10-08
- Statut : Accepted (demande de Hugo : traiter les vulnérabilités)

## Contexte

Des API IA contournaient les restrictions de l'interface et les plafonds de consommation.
L'adresse académique fournie par le client ne prouvait pas sa possession. Une policy UPDATE
vérifiait le propriétaire du message, sans vérifier celui de la conversation cible.
Le lockfile était désynchronisé de la mise à jour Vitest de la PR #172.

## Décision

Authentifier et autoriser ECOS/audio côté serveur avant tout appel de fournisseur. Conserver
la dictée brute pour tout compte connecté ; réserver les modes audio de consultation aux
professionnels/admins. Lier toute nouvelle vérification étudiante à l'adresse du compte
confirmée par Supabase Auth. Interdire le bypass des rôles en production.

Rétablir des plafonds persistés sur le chat connecté, ses métadonnées et l'audio : gratuits
10/20/30 et payants 200/300/500 appels par jour (public/étudiant/pro), par compteur. En cas
d'indisponibilité de la persistance, refuser en production. Les sources restent accessibles
indépendamment du paiement. ECOS/analyse conservent leur quota existant.

Borner les octets réellement lus avant JSON/multipart (2 Mio par défaut, 10 Mio chat,
16 Mio analyse, 26 Mio transcription), avec délai de lecture de 60 secondes. Garder les
corps signés Stripe identiques. Borner aussi les historiques chat/ECOS à 100 messages et
120 000 caractères. Vérifier la propriété du parent lors des mises à jour de messages et
d'items de révision. Déplacer pgvector dans `extensions` en conservant le search_path RAG.

Mettre à jour les dépendances compatibles avec Expo SDK 56 et utiliser `npm ci` en CI.
Pour image-size, imposer 2.0.4 avec un adaptateur explicite au build pour l'API Metro 0.84.
L'adaptateur est testé, idempotent et échoue si l'import Metro change ; il ne modifie que
`node_modules`. Ne pas rétrograder Expo vers SDK 44 pour satisfaire `npm audit --force`.

## Conséquences et limites

Les comptes payants ont un plafond technique contre les abus. Une panne du compteur peut
bloquer temporairement des fonctionnalités IA. Une adresse étudiante différente nécessite
un changement d'adresse et sa confirmation avant une nouvelle attribution. Les rôles déjà
vérifiés restent utilisables.

Deux avis amont sans version corrigée restent suivis dans l'audit. Le durcissement technique
ne réintroduit pas les couches médicales retirées par ADR-0024 et ne prouve pas l'identité
d'un professionnel par la seule existence de son RPPS. Voir le rapport pour les travaux
restants et les limites de vérification.
