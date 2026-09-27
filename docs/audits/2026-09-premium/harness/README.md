# Banc local de vérification — jamais déployer

Copie du banc ayant produit les rapports. Hors application, hors build produit.
Utiliser un répertoire temporaire séparé avec Vite 8.3.1 et axe-core 4.13.0 ; ne pas
ajouter ces dépendances au package produit. Copier ces deux fichiers dans ce répertoire,
`dist/client/` dans son sous-dossier `export/`, et `../directions/` dans `directions/`.
Lancer Vite sur le port 4173 et ouvrir `/__audit` (adapter allowedHosts au nom local).

Choisir écran / largeur, Afficher puis Analyser avec axe. Les captures sont celles de
l’iframe sous la barre de contrôle (y=60 ; 844 px de hauteur à 390, 900 sinon).
Les rapports JSON affichés décrivent le DOM réellement rendu, pas un rôle simulé.

Flux de test local : remplace exclusivement la requête client `/api/chat` par un SSE
non médical ; réinitialise l’essai invité uniquement dans cet environnement local.
Toutes les autres routes API renvoient 503. Ne jamais utiliser ce banc sur une session
de production. Aucune API, autorisation ou donnée produit n’est modifiée.

Mouvement réduit : simulation matchMedia/CSS, pas réglage système réel. Les métriques
affichées séparent la somme brute des shifts et celle après le premier fragment ;
elles ne calculent pas le CLS officiel par fenêtre de session et n’excluent pas toutes
les interactions. Les mouvements des blocs clos comparent leur position dans le fil.
Consulter DELIVERY.md pour les limites et les vérifications restant à faire.
