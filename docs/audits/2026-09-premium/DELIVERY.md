# Livraison UI premium — direction A

27 septembre 2026. Direction « Bureau de référence » choisie par Hugo.
Base : `2d51d336058d33f36e3247b3fc97eb96c123b4e0`. Branche produit :
`design/refonte-premium` ; cible d’intégration : `integration/refonte-premium`.
Cette intégration prépare la dernière revue de Claude, **pas une certification de mise en production**.
`main` reste inchangée à cette étape.

## Preuves et couverture

- [Galerie avant/après, 33 routes × 4 largeurs](before-after.html).
- [Contrats UX : objectif, primaire, parcours, états et microcopie](screen-contracts.md).
- [Mission de reprise Claude](../../CLAUDE_PREMIUM_HANDOFF.md).
- `captures/after-*` : export web réel aux largeurs 390, 768, 1024 et 1440 CSS px.
- `metrics/after-*` : 132 rapports de routes, zéro violation axe détectée et zéro
  débordement horizontal dans ces états. Cela ne certifie pas tous les états WCAG.
- `checks/after-*` : traces des vérifications. Typecheck réussi ; 57 fichiers de tests,
  **766 tests réussis**, aucun supprimé ou affaibli ; `npm run build:web` réussi.
- Pas de dépendance produit ajoutée. JavaScript exporté : 6 949 427 octets bruts,
  1 865 364 gzip, contre 6 944 075 / 1 865 193 initialement (+171 octets gzip).
  Ces totaux incluent les fichiers vendor exportés, pas seulement le chargement initial.

Les captures des routes protégées montrent leur barrière ou redirection réelle, sans
session inventée ni contournement de RoleGate. Elles ne prouvent pas les parcours
connectés du dashboard, des outils, du compte ou de l’admin. La route de billet absent
sert le 404 statique ; elle ne valide pas le composant de billet avec un vrai identifiant.
Lighthouse, les p75 terrain LCP/INP/CLS et les appareils natifs restent non mesurés.

## Chat : mesure reproductible, limites explicites

Fixture SSE locale non médicale, un essai par largeur, premier texte programmé vers
2,4 secondes. Aucun modèle ni service médical appelé. Mesures navigateur :

| Largeur | Attente / Arrêter | Premier texte | Déplacements des blocs clos | Somme des shifts après premier texte |
|---|---:|---:|---:|---:|
| 390 | 17,1 ms | 2 422,9 ms | 0 | 0,000249 |
| 768, réduction simulée | 15,0 ms | 2 420,0 ms | 0 | 0,003707 |
| 1024 | 18,7 ms | 2 422,5 ms | 0 | 0,002233 |
| 1440 | 15,5 ms | 2 425,4 ms | 0 | 0,001129 |

12 blocs clos observés par essai, aucun échantillon sans Arrêter pendant la génération.
La somme brute inclut la transition d’envoi et les shifts avec interaction utilisateur ;
ce n’est **ni un CLS nul ni un p75 Core Web Vitals**. Les petits shifts résiduels sont à
examiner lors de la dernière optimisation. La réduction des mouvements est simulée
par matchMedia/CSS dans le banc ; compléter par un réglage système réel.

Arrêt avant le premier fragment testé à 390 px : génération interrompue, message de
l’utilisateur conservé, confirmation visible. L’essai invité reste consommé selon le
contrat existant ; pas de modification serveur pour accorder un nouvel essai.
Défilement manuel prolongé, interruptions réseau et retour d’onglet avec archive réelle
restent à tester avec un compte autorisé. Les tests purs de reprise ne suffisent pas à
garantir « aucune réponse perdue ».

Les phases reflètent les parts reçues ; aucune recherche Internet n’est simulée par
un minuteur. Le client sait afficher les parts source-url HTTP(S). Le chemin serveur
actuel n’active pas `sendSources` : l’affichage anticipé de sources dépend donc du flux
réel disponible. Aucun changement d’API n’a été fait ; arbitrage Hugo si nécessaire.

## Tableau de livraison

La passe couvre les fondations et les surfaces listées ; « harmonisé » ne signifie pas
que tous les états métier connectés ont été refondus ou validés.

| Écran / variante | Problèmes corrigés | Décision | Reste à vérifier / optimiser |
|---|---|---|---|
| Landing | Composition générique, surcharge de cartes et décorations | Accueil éditorial asymétrique, index d’outils, une primaire ; revue : premier affichage juste à toutes les largeurs (CSS de pré-rendu), plus d’erreur d’hydratation | LCP/CLS labo mesurés (review/REVIEW.md) ; terrain p75 à suivre |
| Chat public | Attente tardive, phases artificielles, actions et cibles | Accusé immédiat, phases observées, blocs clos stables, Envoyer/Arrêter à droite ; revue : notes numérotées sur toute la réponse, double clic, défilement, ARIA | Banc local vert (flux, arrêts, coupure, régénération, défilement, veille) ; reste : chat réel et archive connectée |
| Chat étudiant | Incohérences du même shell | Même contrat de chat, persona conservée ; revue : `### SOURCES` et relances après SOURCES rendues en cartes et propositions | Parcours étudiant connecté |
| Chat professionnel | Incohérences du même shell | Même contrat, avertissements conservés ; revue : tableau, CALC et grade rendus sans syntaxe brute | Parcours professionnel ; terminologie clinique à Hugo |
| Connexion | Champs, hiérarchie et liens trop petits | Formulaire sobre, FieldInput, cibles 44 px | Erreur réseau / succès avec compte test |
| Inscription | Même surface d’authentification | Même placement et vocabulaire | Validation et confirmation réelles |
| Réinitialisation | Hiérarchie et boutons | PageTitle et formulaire harmonisé | Lien expiré et retour effectif |
| Dashboard | Hero décoratif, grille uniforme | Index plus dense et hiérarchie éditoriale | Véritable dashboard connecté |
| Document | Formulaire et suppression sans confirmation locale | Champs communs, suppression confirmée | Upload, extraction, erreurs, historique réel |
| ECOS | Formulaire, petits contrôles | Densité et cibles harmonisées | Session étudiant, dictée et résultats |
| Scores | Champs et hiérarchie | Formulaire commun, calcul inchangé | Parcours de chaque score, résultats et clavier |
| Partiels (route) | Encadrement hétérogène | Wrapper et titre communs | Import réel sous rôle autorisé |
| Révision | Champs et petits contrôles | Widgets harmonisés sans modifier le moteur | Plan vide/rempli, sauvegarde et hors ligne |
| CV (route) | Encadrement | Wrapper commun | Données et exports sous session |
| Présentation (route) | Encadrement | Wrapper commun | Génération et export réel |
| Article (route) | Encadrement | Wrapper commun | Génération et export réel |
| Audio | Champs et bibliothèque | Contrôles cohérents | Permission micro, chargement et lecture |
| Tarifs | Hiérarchie et retour trop petit | Titre éditorial, retour 44 px | Parcours abonnement, sans bloquer les sources |
| Compte | Titre et données personnelles | Champs communs, sauvegarde à droite | Succès/erreur, suppression confirmée existante |
| Choix du rôle | Hiérarchie | Présentation harmonisée, permissions intactes | Vérification et changement de rôle réel |
| Blog | Confusion vide/erreur, chargement générique | États distincts, Réessayer, skeleton de liste | Articles réels et latence réseau |
| Billet / absent | Erreur masquée par absence | État d’erreur et garde asynchrone | Billet publié, véritable 404 et contenu long |
| À propos | Hiérarchie et surface | Colonne de lecture, ton sobre | Relecture éditoriale Hugo |
| Contact | Petites cibles | Actions 44 px | Destination réelle des liens |
| Informations légales | Hiérarchie et navigation | Colonne claire, textes inchangés | Relecture de conformité |
| CGU | Surface et liens | LegalScreen partagé | Clavier et longs paragraphes |
| Confidentialité | Surface et liens | LegalScreen partagé | Relecture de conformité |
| Mentions légales | Surface et liens | LegalScreen partagé | Relecture de conformité |
| Admin | Header, icônes disparates et actions de modale | Shell clair, icône commune, sauvegarde à droite | Tout le parcours admin connecté ; harmonisation locale restante |
| Partiels autonome | Palette, focus, petits contrôles | CSS tokens partagés, imports nommés | Tous formats d’import et exports |
| Présentation autonome | Labels, contrastes et contrôles | Tokens, focus et champs accessibles | Ajout/suppression, thèmes et exports |
| CV autonome | Contrôles et zone scroll non accessible | Cibles 44 px, aperçu focusable | Zoom, édition et exports |
| Article autonome | Zoom désactivé, champs non nommés | Zoom autorisé, labels, tokens partagés | Export et labels des cases à cocher en tactile |

## Arbitrages réservés à Hugo

1. Autoriser ou non une évolution API pour transmettre les sources en streaming.
2. Garantie d’archivage pour les invités : absente du contrat actuel, hors UI.
3. Terminologie clinique héritée (« aide à la décision ») : pas de réécriture réglementaire unilatérale.
4. Si une vérification révèle un défaut serveur, autorisation distincte avant correction.

## Dernière revue et intégration

Revue finale Claude du 27 septembre 2026 : [rapport complet](review/REVIEW.md), preuves
dans [`review/`](review/). Huit défauts corrigés (rendu incrémental du chat, double clic
sur Envoyer, défilement pendant le flux, hydratation web et premier affichage, états ARIA,
titre d’article, barre du CV, accord). 833 tests unitaires, typecheck et build réussis ;
128 états responsive et 6 états de chat répondu sans violation axe ; 15 scénarios de chat
verts sur le banc local ; 0 erreur d’hydratation sur 28 routes. L’état final des écrans
est inchangé (écart ≤ 0,19 % des pixels) : direction A affinée, non transformée.

Chat réel vérifié en invité sur l’aperçu de déploiement de la branche (GPT-6 Luna : rendu,
relances, suivi, arrêt). Non démontré : parcours connectés par rôle, chat connecté et
reprise avec archive réelle (aucun compte de test autorisé ; aucune session simulée),
mesures terrain.
Le workflow GitHub existant ne s’exécute que pour `dev`, `staging` et `main`, **pas pour
la branche d’intégration** : seule la PR vers `main` porte les contrôles obligatoires.
Pas de changement API, serveur, DB/RLS, autorisations ou déploiement dans ce lot.
