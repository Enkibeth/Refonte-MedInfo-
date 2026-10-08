# Audit et corrections de sécurité — 2026-10-08

Périmètre : dépôt `Enkibeth/Refonte-MedInfo-`, base main `8cfb7cf`, API Expo/serveur
Hostinger, dépendances npm et projet Supabase `medinfo-ai-v4`. Ce travail est une revue
ciblée avec tests, pas un pentest exhaustif ni une certification d'absence de vulnérabilités.

## Corrections

- Lockfile synchronisé, mises à jour compatibles Expo 56, Vitest 4.1.11 ; installation CI
  reproductible avec `npm ci`. Corrections notamment shell-quote, decode-uri-component,
  fast-xml-parser et image-size. Adaptateur Metro/image-size documenté dans ADR-0045.
- Authentification et restrictions de persona pour ECOS/audio, contrôle des modes et des
  rôles de messages, quotas du chat connecté, métadonnées et audio (compteurs distincts).
- Plafonds anti-abus payants 200/300/500 ; gratuit 10/20/30. Production bloquée si le
  compteur persistant manque ou échoue ; mémoire locale bornée et réservée au développement.
- Corps des POST bornés par octets effectivement lus, même sans Content-Length ou avec
  une valeur sous-déclarée ; limites spécifiques aux fichiers et délai de lecture.
  Historiques chat/ECOS bornés. Octets des webhooks Stripe préservés.
- Nouvelle attribution étudiante liée à l'adresse du compte confirmée par Supabase Auth ;
  bypass développement neutralisé en production.
- Policies UPDATE vérifiant aussi la propriété du parent. pgvector déplacé de `public`
  vers `extensions`, RAG compatible. Migration appliquée au projet Supabase actif.

## Dépendances restantes

`npm audit` : **35 paquets signalés avant correction** (1 critique, 23 élevés, 4 modérés,
7 faibles), **15 après** (tous élevés ; aucun critique/modéré/faible). Ces nombres comptent
les paquets, y compris les dépendants transitifs ; ils ne représentent pas 15 CVE distinctes
ni 15 attaques démontrées sur le site. Deux avis racines restent sans correctif publié :

| Racine | Version verrouillée | Avis | Surface |
|---|---|---|---|
| braces | 3.0.3 | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Chaîne Expo/Metro : traitement de motifs au build |
| node-forge | 1.4.0 | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | Outillage Expo, certificats/signatures et développement |

Aucune de ces bibliothèques n'est importée directement par les API produit. Le classement
npm ne démontre pas leur exploitabilité en production ; ne pas assimiler cela à un risque
nul. Conserver les builds sur du code de confiance, ne pas exposer le serveur de développement,
et réévaluer dès publication d'un correctif amont. Pas de suppression artificielle des avis.
Source du correctif critique shell-quote : [avis mainteneur](https://github.com/ljharb/shell-quote/security/advisories/GHSA-pqg4-j6r4-53mv).

## Supabase — preuves et état

Les 22 tables publiques ont RLS active. Les trois avis INFO « RLS sans policy » concernent
`ai_interactions`, `billing_events`, `usage_counters` : tables internes réservées au service,
accès client révoqués ; ne pas leur créer de policy publique pour faire disparaître l'avis.
Les fonctions SECURITY DEFINER examinées ne sont pas exécutables par anon/authenticated.

La faille de rattachement de message a été reproduite avant correction avec deux comptes
et des fixtures temporaires, dans une transaction annulée. Après migration : modification
de son propre message autorisée, rattachement à une conversation d'autrui bloqué, lecture
inter-comptes bloquée. Fixtures et modifications annulées. Recherches RAG lexicale et dense
vérifiées après déplacement de l'extension. L'avis « extension in public » a disparu.

L'avis WARN **protection des mots de passe divulgués désactivée** subsiste. L'API connectée
ne permet pas de modifier la configuration Auth. Activer cette option dans
[Supabase Auth](https://supabase.com/dashboard/project/sbpnjswffrqxgnglnjml/auth/providers),
puis relancer l'advisor. [Documentation officielle](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Vérification

- Typecheck, lint, compliance-grep, validation des métadonnées RAG : passent.
- Tests unitaires : 89 fichiers, **1 148 tests** ; tests chat/RAG : 5 fichiers, **29 tests**.
- Build Expo web : réussi avec adaptateur image-size ; fumigation Node : **28/28**.
- Scénarios ajoutés : auth/quota audio et chat, isolation ECOS, faux email académique,
  bypass production, flux sous-déclarés, octets multipart/webhook, compatibilité Metro,
  indisponibilité des quotas et rattachement RLS inter-comptes.
- Contrôle ciblé des fichiers suivis : pas de clé privée fournisseur ni de JWT service_role
  détecté par les motifs recherchés. Ce n'est pas une analyse de tout l'historique Git.
- Environnement local Node 24 ; CI et Hostinger ciblent Node 22. La suite RLS locale complète
  n'a pu démarrer : binaires PostgreSQL absents et installation bloquée par les permissions
  du runtime. Les tests SQL ciblés ont réellement tourné sur Supabase ; la CI doit aussi
  valider le replay intégral des migrations et toutes les suites RLS avant fusion.

## Limites et travaux ouverts

Le connecteur Hostinger exposé dans cette session fournit la messagerie, pas les opérations
hosting : paramètres hPanel, inventaire du runtime, rotation de secrets et durcissement du
système n'ont pas été modifiés. Le déploiement doit être confirmé après fusion par les
réponses du site. Les en-têtes de sécurité et `/api/health` ont été contrôlés sur le site actif.

La vérification RPPS actuelle établit l'existence d'un numéro, pas sa possession ; renforcer
la preuve d'identité professionnelle reste à concevoir. Les rôles étudiants déjà attribués
ne sont pas révoqués automatiquement par le nouveau contrôle. Les couches de refus médical
retirées par ADR-0024 restent un chantier distinct soumis à cette décision ; aucun test de
ce lot ne permet de déclarer ce risque médical résolu.

## Retour arrière

Code : revert de la PR et nouveau build. Les restrictions Supabase peuvent rester en place
avec l'ancien code ; ne pas restaurer la policy vulnérable pour un rollback applicatif.
Si le déplacement d'extension devait être annulé : `ALTER EXTENSION vector SET SCHEMA public`
et rétablir le search_path de `match_rag_chunks` après revue SQL, puis recharger le schéma
PostgREST. Aucune donnée ni aucun index supprimé par la migration.
