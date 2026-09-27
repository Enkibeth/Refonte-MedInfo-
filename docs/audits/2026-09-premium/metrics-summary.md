# Mesures initiales et limites

Base : main `2d51d33`. Export web local inchangé, Node 22, 26 septembre 2026.

| Contrôle | Résultat | Portée |
|---|---|---|
| TypeScript | Réussi | `npm run typecheck` |
| Tests unitaires | 55 fichiers, 756 tests réussis | `npm run test:unit` ; pas de test supprimé ou affaibli |
| Export web | Réussi | `npm run build:web`, script inchangé |
| Captures de référence | 132 | 33 routes/variantes × 4 largeurs, cadre responsive |
| Captures de propositions | 24 | 2 directions × 3 écrans × 4 largeurs |
| Axe, référence | 81 rapports ; 8 rapports avec erreur critique | WCAG 2 A/AA, 2.1 AA et 2.2 AA ; ne couvre pas toute la conformité |
| Axe, propositions | 24 rapports ; 0 violation détectée | HTML statique, pas l’application future |
| Fichiers JS exportés | 8 ; 6,944,075 octets bruts ; 1,865,193 octets gzip cumulés | Somme de tous les chunks, pas la charge initiale d’une route |
| Lighthouse | Non mesuré | L’interface de navigateur disponible ne fournit pas ce lancement ; aucun score estimé |
| LCP / INP / CLS au p75 | Non mesuré | Exige des données terrain ; un export local ne démontre pas ce percentile |
| CLS du chat et déplacement des blocs | Non mesurés | Pas de flux IA connecté exécuté |
| Accusé < 100 ms / reprise sans perte | Non démontrés | Défauts de chemin code identifiés ; tests de bout en bout à faire |
| Réduction de mouvement | Inspection des styles seulement | Pas d’émulation de préférence système ni de lecture d’écran effectuée |
| iOS / Android et clavier virtuel | Non vérifiés | Les cadres Chromium ne sont pas une émulation native |

## Résultats axe par écran et largeur

Les cellules « — » signifient non exécuté, pas réussite. Les doublons dus aux redirections d’accès ne sont pas des audits des pages protégées.

| Écran | 390 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| landing | [0 violation détectée](metrics/landing-390.json) | [0 violation détectée](metrics/landing-768.json) | [0 violation détectée](metrics/landing-1024.json) | [0 violation détectée](metrics/landing-1440.json) |
| chat-public | [0 violation détectée](metrics/chat-public-390.json) | [0 violation détectée](metrics/chat-public-768.json) | [0 violation détectée](metrics/chat-public-1024.json) | [0 violation détectée](metrics/chat-public-1440.json) |
| chat-student | [0 violation détectée](metrics/chat-student-390.json) | [0 violation détectée](metrics/chat-student-768.json) | [0 violation détectée](metrics/chat-student-1024.json) | [0 violation détectée](metrics/chat-student-1440.json) |
| chat-professional | [0 violation détectée](metrics/chat-professional-390.json) | [0 violation détectée](metrics/chat-professional-768.json) | [0 violation détectée](metrics/chat-professional-1024.json) | [0 violation détectée](metrics/chat-professional-1440.json) |
| sign-in | [1 serious](metrics/sign-in-390.json) | [1 serious](metrics/sign-in-768.json) | [1 serious](metrics/sign-in-1024.json) | [1 serious](metrics/sign-in-1440.json) |
| sign-up | [0 violation détectée](metrics/sign-up-390.json) | [1 serious](metrics/sign-up-768.json) | [1 serious](metrics/sign-up-1024.json) | [1 serious](metrics/sign-up-1440.json) |
| reset-password | [0 violation détectée](metrics/reset-password-390.json) | — | [0 violation détectée](metrics/reset-password-1024.json) | [0 violation détectée](metrics/reset-password-1440.json) |
| dashboard | [0 violation détectée](metrics/dashboard-390.json) | — | [0 violation détectée](metrics/dashboard-1024.json) | [0 violation détectée](metrics/dashboard-1440.json) |
| document | [0 violation détectée](metrics/document-390.json) | — | [0 violation détectée](metrics/document-1024.json) | [0 violation détectée](metrics/document-1440.json) |
| ecos | [0 violation détectée](metrics/ecos-390.json) | — | — | [0 violation détectée](metrics/ecos-1440.json) |
| scores | [0 violation détectée](metrics/scores-390.json) | — | — | [0 violation détectée](metrics/scores-1440.json) |
| partiel | [0 violation détectée](metrics/partiel-390.json) | [0 violation détectée](metrics/partiel-768.json) | — | [0 violation détectée](metrics/partiel-1440.json) |
| revision | [0 violation détectée](metrics/revision-390.json) | [0 violation détectée](metrics/revision-768.json) | — | [0 violation détectée](metrics/revision-1440.json) |
| cv-builder | [0 violation détectée](metrics/cv-builder-390.json) | — | — | — |
| presentation | [0 violation détectée](metrics/presentation-390.json) | — | — | — |
| article | [0 violation détectée](metrics/article-390.json) | — | — | — |
| audio | [0 violation détectée](metrics/audio-390.json) | — | — | — |
| pricing | [0 violation détectée](metrics/pricing-390.json) | [0 violation détectée](metrics/pricing-768.json) | [0 violation détectée](metrics/pricing-1024.json) | [0 violation détectée](metrics/pricing-1440.json) |
| account | [1 serious](metrics/account-390.json) | — | — | — |
| choose-role | [1 serious](metrics/choose-role-390.json) | — | — | — |
| blog | [0 violation détectée](metrics/blog-390.json) | — | — | — |
| blog-missing | [0 violation détectée](metrics/blog-missing-390.json) | [0 violation détectée](metrics/blog-missing-768.json) | [0 violation détectée](metrics/blog-missing-1024.json) | [0 violation détectée](metrics/blog-missing-1440.json) |
| a-propos | [0 violation détectée](metrics/a-propos-390.json) | — | — | — |
| contact | [0 violation détectée](metrics/contact-390.json) | — | — | — |
| legal | [0 violation détectée](metrics/legal-390.json) | — | — | — |
| cgu | [0 violation détectée](metrics/cgu-390.json) | — | — | — |
| confidentialite | [0 violation détectée](metrics/confidentialite-390.json) | — | — | — |
| mentions-legales | [0 violation détectée](metrics/mentions-legales-390.json) | — | — | — |
| admin | [1 serious](metrics/admin-390.json) | — | — | — |
| standalone-partiel | [0 violation détectée](metrics/standalone-partiel-390.json) | [0 violation détectée](metrics/standalone-partiel-768.json) | [0 violation détectée](metrics/standalone-partiel-1024.json) | [0 violation détectée](metrics/standalone-partiel-1440.json) |
| standalone-presentation | [3 serious, 2 critical](metrics/standalone-presentation-390.json) | [3 serious, 2 critical](metrics/standalone-presentation-768.json) | [3 serious, 2 critical](metrics/standalone-presentation-1024.json) | [3 serious, 2 critical](metrics/standalone-presentation-1440.json) |
| standalone-cv | [0 violation détectée](metrics/standalone-cv-390.json) | [0 violation détectée](metrics/standalone-cv-768.json) | [0 violation détectée](metrics/standalone-cv-1024.json) | [1 serious](metrics/standalone-cv-1440.json) |
| standalone-article | [2 critical, 1 moderate](metrics/standalone-article-390.json) | [2 critical, 1 moderate](metrics/standalone-article-768.json) | [2 critical, 1 moderate](metrics/standalone-article-1024.json) | [2 critical, 1 moderate](metrics/standalone-article-1440.json) |
| A-landing | [0 violation détectée](metrics/A-landing-390.json) | [0 violation détectée](metrics/A-landing-768.json) | [0 violation détectée](metrics/A-landing-1024.json) | [0 violation détectée](metrics/A-landing-1440.json) |
| A-chat | [0 violation détectée](metrics/A-chat-390.json) | [0 violation détectée](metrics/A-chat-768.json) | [0 violation détectée](metrics/A-chat-1024.json) | [0 violation détectée](metrics/A-chat-1440.json) |
| A-tool | [0 violation détectée](metrics/A-tool-390.json) | [0 violation détectée](metrics/A-tool-768.json) | [0 violation détectée](metrics/A-tool-1024.json) | [0 violation détectée](metrics/A-tool-1440.json) |
| B-landing | [0 violation détectée](metrics/B-landing-390.json) | [0 violation détectée](metrics/B-landing-768.json) | [0 violation détectée](metrics/B-landing-1024.json) | [0 violation détectée](metrics/B-landing-1440.json) |
| B-chat | [0 violation détectée](metrics/B-chat-390.json) | [0 violation détectée](metrics/B-chat-768.json) | [0 violation détectée](metrics/B-chat-1024.json) | [0 violation détectée](metrics/B-chat-1440.json) |
| B-tool | [0 violation détectée](metrics/B-tool-390.json) | [0 violation détectée](metrics/B-tool-768.json) | [0 violation détectée](metrics/B-tool-1024.json) | [0 violation détectée](metrics/B-tool-1440.json) |

## Conditions de reproduction

1. Repartir de la base indiquée, Node 22 et les dépendances verrouillées. Exécuter les trois commandes de vérification.
2. Fournir uniquement les variables publiques Expo/Supabase attendues. Un export déjà mis en cache sans ces variables doit être régénéré avec le cache Metro vidé. Ne jamais intégrer une clé serveur au navigateur.
3. Servir `dist/client` et les coquilles statiques exportées manquantes dans un banc d’audit externe. Le fixture `audit-frame.html` montre les routes et dimensions utilisées. Les API locales non servies renvoient une erreur ; aucun serveur IA ou compte fictif n’est injecté.
4. Charger axe-core 4.13.0 dans le document du cadre et lancer les tags indiqués. Les rapports bruts incluent les nœuds et les cas indéterminés à vérifier manuellement.
5. Pour terminer l’audit connecté, fournir une session de test par rôle, sans données patient, puis suivre le protocole chat dans le README. Exécuter Lighthouse mobile/desktop séparément, avec environnement et paramètres conservés.

## Points matériels

- Présentation : `label`, `select-name` critiques ; contrastes, défilement clavier et cibles à corriger. Article : `label`, `select-name` critiques et zoom bloqué.
- Connexion et inscription : avertissement sous le contraste demandé. CV desktop : région défilable non focusable.
- Débordement à 390 px : accueil, tarifs, blog, article absent, à propos et contact. Le header de l’accueil dépasse de 15,23 px ; le décor animé dépasse aussi légèrement.
- Aucune nouvelle dépendance de production. Les outils d’audit sont installés hors dépôt. Aucun fichier produit n’a changé.
- La porte de push « axe sans erreur critique » reste fermée. Les commits sont locaux ; aucune PR ouverte à ce stade.
