# Correctifs des dépendances MedInfo — 31 octobre 2026

## Constat

Site concerné : `medinfo-ai.com`, application Expo web sur Node 22 chez Hostinger,
déployée automatiquement depuis `Enkibeth/Refonte-MedInfo-`, branche `main`.
Production inspectée : commit `1af4302f933cd788f4cd1fd975e04193aaea9e61`.
Le scan Hostinger retourne 15 lignes (7 high, 7 moderate, 1 low), portant sur
decode-uri-component, Undici, Vite, Zod (deux versions) et @vitest/mocker.
Ce sont des alertes de dépendances : leur présence ne prouve pas l'exploitabilité
de chaque avis sur les routes publiques.

La PR Hostinger #177 ne modifiait que `package.json` pour Zod ; le lockfile
restait ancien. Elle est complétée, plutôt que fusionnée telle quelle.

## Versions résolues

| Paquet | Avant | Après |
| --- | --- | --- |
| decode-uri-component | 0.5.0 | 0.5.1 |
| undici | 6.29.0 | 6.29.1 |
| vite | 8.0.16 | 8.3.5 |
| vitest / @vitest/mocker | 4.1.11 | 4.1.12 |
| zod application | 4.4.3 | 4.6.7 |
| zod sous @expo/cli | 3.25.76 | 4.6.7 (partagé avec l'application) |
| node-forge (audit npm complémentaire) | 1.4.0 | 1.4.2 |

Les overrides empêchent la réinstallation des anciennes versions transitives de
decode-uri-component, Undici et Vite. L'override Zod est limité à @expo/cli et
réutilise `$zod` pour éviter deux contraintes contradictoires. Expo n'est ni
rétrogradé ni migré vers un nouveau SDK.

## Vérifications

- Première passe : typage, lint, compliance-grep, licences RAG, 1 171 tests
  unitaires, compilation Expo et fumigation Node 28/28 après les premiers correctifs.
- Seconde passe : trois tests supplémentaires exercent les vrais schémas de plugins,
  sorties DevTools et commandes MCP d'Expo avec Zod corrigé ; 1 174 tests passent.
  Installation verrouillée, typage, lint, compilation et fumigation sont recontrôlés
  avant fusion ; CI Node 22 comprenant le gate RLS exigée.
- Aucun appel LLM payant ni écriture dans Supabase de production pour ces tests.
- Audit npm après correctifs : 0 critical, 0 high, 0 moderate ; 7 lignes low
  correspondant à une seule vulnérabilité racine décrite ci-dessous.
- Les tests locaux tournent avec Node 24 ; la CI et la compilation Hostinger
  vérifient Node 22, version de production. Le conteneur local ne possède pas
  PostgreSQL/pgvector ; le gate RLS est donc vérifié dans la CI, sans le désactiver.

## Vulnérabilité résiduelle distincte

`deepmerge@4.3.1` : [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4),
prototype poisoning, sévérité faible. L'avis GitHub consulté indique **aucune version
corrigée** ; 4.3.1 est toujours la dernière version publiée au moment du contrôle.
Les sept lignes npm sont deepmerge et les dépendants Expo qui héritent de cet avis.

L'arbre installé est `expo -> @expo/config -> deepmerge`, utilisé par l'outillage
de configuration/compilation. Le serveur de production démarre `server/index.mjs`
et sert les exports compilés ; il ne démarre pas `expo start`. Cela réduit la surface
publique présumée, sans constituer une preuve d'absence d'exploitation.
La rétrogradation Expo proposée par `npm audit fix --force` n'est pas appliquée.
L'avis reste visible : aucun audit ignoré, aucune falsification de version.

## Déploiement et contrôle

Après CI verte, fusion de #177 dans `main` (demande explicite de Hugo), puis suivi
du build automatique Hostinger. Vérifier le SHA effectivement compilé, le succès du
build Node 22, `/api/health`, les pages principales et les en-têtes HTTPS/CSP.
Le scan périodique Hostinger peut encore montrer les versions de l'ancien build :
ne pas assimiler ce délai de scan à un échec ou à une preuve de correction.

Retour arrière : revert de #177 dans `main`, puis reconstruction Hostinger.
