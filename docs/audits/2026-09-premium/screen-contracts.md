# Contrats UX proposés, écran par écran

> Document historique de cadrage du 26 septembre. Direction A désormais choisie.
> Pour les corrections effectivement livrées et les réserves, voir [DELIVERY.md](DELIVERY.md).

Ces contrats cadrent les lots après validation. **Aucun problème produit n’est corrigé dans cette livraison.** Les 132 captures initiales couvrent 33 routes ou variantes, aux quatre largeurs. Les outils connectés restent à observer avec leurs rôles réels. L’inventaire CSV indique la couverture exacte.

## Règles communes

- Une primaire contextuelle ; actions de page en haut à droite sur desktop, retour à gauche. Annuler à gauche de la primaire dans un formulaire desktop. Actions mobiles pleine largeur après les champs et accessibles avec le clavier virtuel.
- Chargement : conserver le contexte, bloquer uniquement la commande engagée, skeleton calé sur le contenu final si sa structure est connue. Pas de pourcentage inventé.
- Erreur : texte précis et Réessayer ; conserver les saisies. Succès : confirmation courte à proximité du résultat, sans déplacer ce qui a été lu.
- Hors ligne : distinguer le contenu déjà affiché des opérations réseau indisponibles. Ne pas promettre une sauvegarde locale ou une synchronisation qui n’existe pas.
- Destruction : séparée visuellement et confirmée ou annulable selon le comportement existant. Rôles, vérifications et contrôles serveur conservés.
- Les microcopies ci-dessous sont des propositions UI, pas des modifications de textes réglementaires. Les mentions IA et urgences restent présentes.

## Tableau de suivi

| Écran | Problèmes corrigés | Décisions proposées | Reste à faire |
|---|---|---|---|
| `/` (landing) | Aucun, audit sans code | Essayer le chat ; UX-08,09,12,16,22 | Implémenter après choix et vérifier les états connectés applicables |
| `/chat?bot=public` (chat-public) | Aucun, audit sans code | Envoyer / Arrêter selon état ; UX-01 à 07,11 à 14,19,20 | Implémenter après choix et vérifier les états connectés applicables |
| `/chat?bot=student` (chat-student) | Aucun, audit sans code | Envoyer / Arrêter selon état ; UX-01 à 07,11 à 14,19,20 | Implémenter après choix et vérifier les états connectés applicables |
| `/chat?bot=professional` (chat-professional) | Aucun, audit sans code | Envoyer / Arrêter selon état ; UX-01 à 09,11 à 14,19,20 | Implémenter après choix et vérifier les états connectés applicables |
| `/sign-in` (sign-in) | Aucun, audit sans code | Se connecter ; UX-10,15 | Implémenter après choix et vérifier les états connectés applicables |
| `/sign-in?mode=signup` (sign-up) | Aucun, audit sans code | Créer un compte ; UX-10,15 | Implémenter après choix et vérifier les états connectés applicables |
| `/reset-password` (reset-password) | Aucun, audit sans code | Enregistrer le mot de passe ; UX-15 | Implémenter après choix et vérifier les états connectés applicables |
| `/dashboard` (dashboard) | Aucun, audit sans code | Reprendre le dernier travail, si présent ; UX-12,14,15 | Implémenter après choix et vérifier les états connectés applicables |
| `/document` (document) | Aucun, audit sans code | Analyser le document ; UX-12,15 | Implémenter après choix et vérifier les états connectés applicables |
| `/ecos` (ecos) | Aucun, audit sans code | Commencer la station ; UX-12,15 | Implémenter après choix et vérifier les états connectés applicables |
| `/scores` (scores) | Aucun, audit sans code | Ouvrir le score sélectionné ; UX-12,15 | Implémenter après choix et vérifier les états connectés applicables |
| `/partiel` (partiel) | Aucun, audit sans code | Importer un relevé ; UX-12,15,18 | Implémenter après choix et vérifier les états connectés applicables |
| `/revision` (revision) | Aucun, audit sans code | Créer le planning ; UX-12,15 | Implémenter après choix et vérifier les états connectés applicables |
| `/cv-builder` (cv-builder) | Aucun, audit sans code | Télécharger le PDF ; UX-12,15,18 | Implémenter après choix et vérifier les états connectés applicables |
| `/presentation` (presentation) | Aucun, audit sans code | Exporter la présentation ; UX-12,15,18,21 | Implémenter après choix et vérifier les états connectés applicables |
| `/article` (article) | Aucun, audit sans code | Enregistrer, puis exporter selon contexte ; UX-12,15,18,21 | Implémenter après choix et vérifier les états connectés applicables |
| `/audio` (audio) | Aucun, audit sans code | Démarrer / Arrêter selon état ; UX-12,15 | Implémenter après choix et vérifier les états connectés applicables |
| `/pricing` (pricing) | Aucun, audit sans code | Choisir une offre ; UX-12,15,22 | Implémenter après choix et vérifier les états connectés applicables |
| `/account` (account) | Aucun, audit sans code | Enregistrer les modifications ; UX-12,15 | Implémenter après choix et vérifier les états connectés applicables |
| `/choose-role` (choose-role) | Aucun, audit sans code | Continuer ; UX-12,15 | Implémenter après choix et vérifier les états connectés applicables |
| `/blog` (blog) | Aucun, audit sans code | Lire l’article choisi ; UX-12,16,17,22 | Implémenter après choix et vérifier les états connectés applicables |
| `/blog/audit-slug-inexistant` (blog-missing) | Aucun, audit sans code | Consulter une référence ; retour liste si absent ; UX-16,22 | Implémenter après choix et vérifier les états connectés applicables |
| `/a-propos` (a-propos) | Aucun, audit sans code | Accéder au chat ; UX-12,16,22 | Implémenter après choix et vérifier les états connectés applicables |
| `/contact` (contact) | Aucun, audit sans code | Ouvrir le canal choisi ; UX-12,16,22 | Implémenter après choix et vérifier les états connectés applicables |
| `/legal` (legal) | Aucun, audit sans code | Ouvrir la section recherchée ; UX-12,16 | Implémenter après choix et vérifier les états connectés applicables |
| `/cgu` (cgu) | Aucun, audit sans code | Consulter la section recherchée ; UX-12,16 | Implémenter après choix et vérifier les états connectés applicables |
| `/confidentialite` (confidentialite) | Aucun, audit sans code | Consulter la section recherchée ; UX-12,16 | Implémenter après choix et vérifier les états connectés applicables |
| `/mentions-legales` (mentions-legales) | Aucun, audit sans code | Consulter les coordonnées ; UX-12,16 | Implémenter après choix et vérifier les états connectés applicables |
| `/(admin)` (admin) | Aucun, audit sans code | Action du module actif, une seule primaire ; UX-12,14,15 | Implémenter après choix et vérifier les états connectés applicables |
| `/partiel.html` (standalone-partiel) | Aucun, audit sans code | Importer un relevé ; UX-12,15,18 | Implémenter après choix et vérifier les états connectés applicables |
| `/presentation.html` (standalone-presentation) | Aucun, audit sans code | Exporter la présentation ; UX-12,15,18,21 | Implémenter après choix et vérifier les états connectés applicables |
| `/cv-builder.html` (standalone-cv) | Aucun, audit sans code | Télécharger le PDF ; UX-12,15,18 | Implémenter après choix et vérifier les états connectés applicables |
| `/article.html` (standalone-article) | Aucun, audit sans code | Enregistrer, puis exporter selon contexte ; UX-12,15,18,21 | Implémenter après choix et vérifier les états connectés applicables |

## landing — `/`

**Objectif :** Comprendre le service et commencer.
**Action principale :** Essayer le chat.
**Parcours court :** Accueil → chat invité → question.
**Microcopie proposée :** « Information médicale générale. Les sources restent accessibles. »
**Avant :** contenu initial. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-08,09,12,16,22.

**États cibles :** Vide, chargement et succès : pas d’état métier autonome pour le contenu statique. Erreur : lien ou navigation indisponible identifié. Hors ligne : ne pas promettre la disponibilité initiale ; conserver le contenu déjà rendu. Les actions réseau de contact/abonnement suivent leur contrat existant.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## chat-public — `/chat?bot=public`

**Objectif :** Comprendre une information de santé générale.
**Action principale :** Envoyer / Arrêter selon état.
**Parcours court :** Choisir son espace → saisir → lire → ouvrir une référence.
**Microcopie proposée :** « Votre question a été reçue. »
**Avant :** vide / essai invité disponible. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-01 à 07,11 à 14,19,20.

**États cibles :** Vide : question et exemples sobres existants. Chargement : accusé immédiat, phase réelle et Arrêter. Erreur : texte reçu conservé et Réessayer. Succès : texte stabilisé, références puis actions. Hors ligne : informer et reprendre seulement selon le contrat réel, avec distinction invité/connecté.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## chat-student — `/chat?bot=student`

**Objectif :** Approfondir un sujet de cours.
**Action principale :** Envoyer / Arrêter selon état.
**Parcours court :** Espace étudiant autorisé → question → références.
**Microcopie proposée :** « Réflexion en cours. »
**Avant :** vide / essai invité disponible. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-01 à 07,11 à 14,19,20.

**États cibles :** Vide : question et exemples sobres existants. Chargement : accusé immédiat, phase réelle et Arrêter. Erreur : texte reçu conservé et Réessayer. Succès : texte stabilisé, références puis actions. Hors ligne : informer et reprendre seulement selon le contrat réel, avec distinction invité/connecté.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## chat-professional — `/chat?bot=professional`

**Objectif :** Consulter la littérature sur un sujet général.
**Action principale :** Envoyer / Arrêter selon état.
**Parcours court :** Espace professionnel autorisé → question → références.
**Microcopie proposée :** « Consulter les références et approfondir un sujet. »
**Avant :** vide / essai invité disponible. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-01 à 09,11 à 14,19,20.

**États cibles :** Vide : question et exemples sobres existants. Chargement : accusé immédiat, phase réelle et Arrêter. Erreur : texte reçu conservé et Réessayer. Succès : texte stabilisé, références puis actions. Hors ligne : informer et reprendre seulement selon le contrat réel, avec distinction invité/connecté.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## sign-in — `/sign-in`

**Objectif :** Retrouver son espace.
**Action principale :** Se connecter.
**Parcours court :** Méthode choisie → authentification → destination demandée.
**Microcopie proposée :** « Connexion impossible. Vérifiez vos informations et réessayez. »
**Avant :** formulaire initial. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-10,15.

**États cibles :** Vide : champs et aide permanente. Chargement : opération d’authentification en cours, éviter la double soumission. Erreur : liée au champ ou au lien concerné. Succès : confirmation et destination attendue. Hors ligne : prévenir avant un nouvel envoi et conserver les champs non sensibles selon le comportement existant.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## sign-up — `/sign-in?mode=signup`

**Objectif :** Créer un compte en comprenant ses conditions.
**Action principale :** Créer un compte.
**Parcours court :** Email ou fournisseur existant → conditions → vérification.
**Microcopie proposée :** « Vérifiez votre boîte de réception pour continuer. »
**Avant :** formulaire initial. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-10,15.

**États cibles :** Vide : champs et aide permanente. Chargement : opération d’authentification en cours, éviter la double soumission. Erreur : liée au champ ou au lien concerné. Succès : confirmation et destination attendue. Hors ligne : prévenir avant un nouvel envoi et conserver les champs non sensibles selon le comportement existant.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## reset-password — `/reset-password`

**Objectif :** Rétablir son accès avec un lien valide.
**Action principale :** Enregistrer le mot de passe.
**Parcours court :** Lien reçu → nouveau mot de passe → connexion.
**Microcopie proposée :** « Ce lien ne permet plus de réinitialiser votre mot de passe. »
**Avant :** lien de réinitialisation absent. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-15.

**États cibles :** Vide : champs et aide permanente. Chargement : opération d’authentification en cours, éviter la double soumission. Erreur : liée au champ ou au lien concerné. Succès : confirmation et destination attendue. Hors ligne : prévenir avant un nouvel envoi et conserver les champs non sensibles selon le comportement existant.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## dashboard — `/dashboard`

**Objectif :** Reprendre un travail autorisé.
**Action principale :** Reprendre le dernier travail, si présent.
**Parcours court :** Tableau de bord → conversation ou outil récent.
**Microcopie proposée :** « Retrouvez ici vos conversations et vos outils. »
**Avant :** redirection invité vers chat public. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,14,15.

**États cibles :** Vide : prérequis et prochaine action explicites. Chargement : forme du résultat attendu ou phase honnête ; annulation si prise en charge. Erreur : conserver les entrées, nommer le problème, Réessayer. Succès : résultat puis export ou étape suivante. Hors ligne : opérations distantes indisponibles, aucun succès ni archivage inventé.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## document — `/document`

**Objectif :** Comprendre le vocabulaire et les passages d’un document.
**Action principale :** Analyser le document.
**Parcours court :** Importer ou coller → choisir l’opération → analyser → passages cités.
**Microcopie proposée :** « Ajoutez un fichier ou collez un texte pour commencer. »
**Avant :** barrière d’accès invité. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,15.

**États cibles :** Vide : prérequis et prochaine action explicites. Chargement : forme du résultat attendu ou phase honnête ; annulation si prise en charge. Erreur : conserver les entrées, nommer le problème, Réessayer. Succès : résultat puis export ou étape suivante. Hors ligne : opérations distantes indisponibles, aucun succès ni archivage inventé.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## ecos — `/ecos`

**Objectif :** S’entraîner à une situation pédagogique.
**Action principale :** Commencer la station.
**Parcours court :** Choisir une station → simulation → retour pédagogique.
**Microcopie proposée :** « Choisissez une station pour commencer votre entraînement. »
**Avant :** barrière d’accès invité. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,15.

**États cibles :** Vide : prérequis et prochaine action explicites. Chargement : forme du résultat attendu ou phase honnête ; annulation si prise en charge. Erreur : conserver les entrées, nommer le problème, Réessayer. Succès : résultat puis export ou étape suivante. Hors ligne : opérations distantes indisponibles, aucun succès ni archivage inventé.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## scores — `/scores`

**Objectif :** Retrouver un calculateur et sa référence.
**Action principale :** Ouvrir le score sélectionné.
**Parcours court :** Rechercher → saisir les variables → consulter calcul et référence.
**Microcopie proposée :** « Rechercher un score par son nom ou sa fonction. »
**Avant :** barrière d’accès invité. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,15.

**États cibles :** Vide : prérequis et prochaine action explicites. Chargement : forme du résultat attendu ou phase honnête ; annulation si prise en charge. Erreur : conserver les entrées, nommer le problème, Réessayer. Succès : résultat puis export ou étape suivante. Hors ligne : opérations distantes indisponibles, aucun succès ni archivage inventé.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## partiel — `/partiel`

**Objectif :** Lire ses résultats et explorer des hypothèses.
**Action principale :** Importer un relevé.
**Parcours court :** Importer → vérifier les colonnes → consulter → simuler.
**Microcopie proposée :** « Importez votre relevé pour afficher les résultats. »
**Avant :** barrière d’accès invité. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,15,18.

**États cibles :** Vide : prérequis et prochaine action explicites. Chargement : forme du résultat attendu ou phase honnête ; annulation si prise en charge. Erreur : conserver les entrées, nommer le problème, Réessayer. Succès : résultat puis export ou étape suivante. Hors ligne : opérations distantes indisponibles, aucun succès ni archivage inventé.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## revision — `/revision`

**Objectif :** Organiser un planning de révision.
**Action principale :** Créer le planning.
**Parcours court :** Définir échéance et charge → générer → ajuster.
**Microcopie proposée :** « Renseignez votre échéance et vos disponibilités. »
**Avant :** barrière d’accès invité. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,15.

**États cibles :** Vide : prérequis et prochaine action explicites. Chargement : forme du résultat attendu ou phase honnête ; annulation si prise en charge. Erreur : conserver les entrées, nommer le problème, Réessayer. Succès : résultat puis export ou étape suivante. Hors ligne : opérations distantes indisponibles, aucun succès ni archivage inventé.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## cv-builder — `/cv-builder`

**Objectif :** Préparer et exporter un CV.
**Action principale :** Télécharger le PDF.
**Parcours court :** Saisir/importer → aperçu → exporter.
**Microcopie proposée :** « Votre CV est prêt à être exporté. »
**Avant :** barrière d’accès invité. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,15,18.

**États cibles :** Vide : prérequis et prochaine action explicites. Chargement : forme du résultat attendu ou phase honnête ; annulation si prise en charge. Erreur : conserver les entrées, nommer le problème, Réessayer. Succès : résultat puis export ou étape suivante. Hors ligne : opérations distantes indisponibles, aucun succès ni archivage inventé.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## presentation — `/presentation`

**Objectif :** Préparer une présentation.
**Action principale :** Exporter la présentation.
**Parcours court :** Contenu → structure → aperçu → export.
**Microcopie proposée :** « Vérifiez les diapositives avant l’export. »
**Avant :** barrière d’accès invité. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,15,18,21.

**États cibles :** Vide : prérequis et prochaine action explicites. Chargement : forme du résultat attendu ou phase honnête ; annulation si prise en charge. Erreur : conserver les entrées, nommer le problème, Réessayer. Succès : résultat puis export ou étape suivante. Hors ligne : opérations distantes indisponibles, aucun succès ni archivage inventé.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## article — `/article`

**Objectif :** Structurer un travail rédactionnel.
**Action principale :** Enregistrer, puis exporter selon contexte.
**Parcours court :** Plan → rédaction → références → sauvegarde/export.
**Microcopie proposée :** « Modifications enregistrées. »
**Avant :** barrière d’accès invité. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,15,18,21.

**États cibles :** Vide : prérequis et prochaine action explicites. Chargement : forme du résultat attendu ou phase honnête ; annulation si prise en charge. Erreur : conserver les entrées, nommer le problème, Réessayer. Succès : résultat puis export ou étape suivante. Hors ligne : opérations distantes indisponibles, aucun succès ni archivage inventé.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## audio — `/audio`

**Objectif :** Transcrire et structurer un contenu autorisé.
**Action principale :** Démarrer / Arrêter selon état.
**Parcours court :** Autorisation micro → capture → vérification du texte.
**Microcopie proposée :** « Vérifiez la transcription avant de l’utiliser. »
**Avant :** barrière d’accès invité. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,15.

**États cibles :** Vide : prérequis et prochaine action explicites. Chargement : forme du résultat attendu ou phase honnête ; annulation si prise en charge. Erreur : conserver les entrées, nommer le problème, Réessayer. Succès : résultat puis export ou étape suivante. Hors ligne : opérations distantes indisponibles, aucun succès ni archivage inventé.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## pricing — `/pricing`

**Objectif :** Comparer les conditions et limites des offres.
**Action principale :** Choisir une offre.
**Parcours court :** Comparer → conditions → paiement existant.
**Microcopie proposée :** « Les sources restent accessibles, avec ou sans abonnement. »
**Avant :** contenu initial. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,15,22.

**États cibles :** Vide, chargement et succès : pas d’état métier autonome pour le contenu statique. Erreur : lien ou navigation indisponible identifié. Hors ligne : ne pas promettre la disponibilité initiale ; conserver le contenu déjà rendu. Les actions réseau de contact/abonnement suivent leur contrat existant.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## account — `/account`

**Objectif :** Gérer son profil et ses préférences.
**Action principale :** Enregistrer les modifications.
**Parcours court :** Section souhaitée → modifier → enregistrer.
**Microcopie proposée :** « Modifications enregistrées. »
**Avant :** redirection vers connexion. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,15.

**États cibles :** Vide : objet ou section absent explicite. Chargement : squelette du module. Erreur : conserver la saisie et proposer Réessayer. Succès : enregistrement confirmé sans message trompeur. Hors ligne : ne pas confirmer une sauvegarde non aboutie. Destruction séparée, confirmation existante conservée.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## choose-role — `/choose-role`

**Objectif :** Déclarer son profil et comprendre la vérification.
**Action principale :** Continuer.
**Parcours court :** Profil → justificatif si exigé → état de vérification.
**Microcopie proposée :** « Votre demande de vérification est en cours. »
**Avant :** redirection vers connexion. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,15.

**États cibles :** Vide : champs et aide permanente. Chargement : opération d’authentification en cours, éviter la double soumission. Erreur : liée au champ ou au lien concerné. Succès : confirmation et destination attendue. Hors ligne : prévenir avant un nouvel envoi et conserver les champs non sensibles selon le comportement existant.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## blog — `/blog`

**Objectif :** Trouver un article publié.
**Action principale :** Lire l’article choisi.
**Parcours court :** Liste → titre → article → références.
**Microcopie proposée :** « Impossible de charger les articles. Réessayer. »
**Avant :** liste vide / chargement distant non validé. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,16,17,22.

**États cibles :** Vide : aucun article publié. Chargement : structure titre/date/extrait. Erreur : distincte de la liste vide, Réessayer. Succès : contenu publié avec date, auteur et références réels. Hors ligne : lecture du contenu déjà reçu, pas de faux résultat ni de promesse de cache.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## blog-missing — `/blog/audit-slug-inexistant`

**Objectif :** Lire un article et identifier ses références.
**Action principale :** Consulter une référence ; retour liste si absent.
**Parcours court :** Article → date/auteur → contenu → références.
**Microcopie proposée :** « Cet article n’existe pas ou n’est plus publié. »
**Avant :** article introuvable. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-16,22.

**États cibles :** Vide : aucun article publié. Chargement : structure titre/date/extrait. Erreur : distincte de la liste vide, Réessayer. Succès : contenu publié avec date, auteur et références réels. Hors ligne : lecture du contenu déjà reçu, pas de faux résultat ni de promesse de cache.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## a-propos — `/a-propos`

**Objectif :** Comprendre le service et sa finalité.
**Action principale :** Accéder au chat.
**Parcours court :** Présentation → limites → essai.
**Microcopie proposée :** « Information médicale générale, jamais un avis individuel. »
**Avant :** contenu initial. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,16,22.

**États cibles :** Vide, chargement et succès : pas d’état métier autonome pour le contenu statique. Erreur : lien ou navigation indisponible identifié. Hors ligne : ne pas promettre la disponibilité initiale ; conserver le contenu déjà rendu. Les actions réseau de contact/abonnement suivent leur contrat existant.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## contact — `/contact`

**Objectif :** Trouver le bon canal de contact.
**Action principale :** Ouvrir le canal choisi.
**Parcours court :** Motif → canal approprié.
**Microcopie proposée :** « MedInfo AI n’est pas une plateforme d’urgence. »
**Avant :** contenu initial. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,16,22.

**États cibles :** Vide, chargement et succès : pas d’état métier autonome pour le contenu statique. Erreur : lien ou navigation indisponible identifié. Hors ligne : ne pas promettre la disponibilité initiale ; conserver le contenu déjà rendu. Les actions réseau de contact/abonnement suivent leur contrat existant.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## legal — `/legal`

**Objectif :** Comprendre la finalité et les obligations du service.
**Action principale :** Ouvrir la section recherchée.
**Parcours court :** Sommaire → section → retour.
**Microcopie proposée :** « Conserver les textes canoniques sans en changer le sens. »
**Avant :** contenu initial. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,16.

**États cibles :** Vide, chargement et succès : pas d’état métier autonome pour le contenu statique. Erreur : lien ou navigation indisponible identifié. Hors ligne : ne pas promettre la disponibilité initiale ; conserver le contenu déjà rendu. Les actions réseau de contact/abonnement suivent leur contrat existant.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## cgu — `/cgu`

**Objectif :** Lire les conditions applicables.
**Action principale :** Consulter la section recherchée.
**Parcours court :** Sommaire → conditions → retour.
**Microcopie proposée :** « Conserver les dates et formulations légales existantes. »
**Avant :** contenu initial. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,16.

**États cibles :** Vide, chargement et succès : pas d’état métier autonome pour le contenu statique. Erreur : lien ou navigation indisponible identifié. Hors ligne : ne pas promettre la disponibilité initiale ; conserver le contenu déjà rendu. Les actions réseau de contact/abonnement suivent leur contrat existant.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## confidentialite — `/confidentialite`

**Objectif :** Comprendre le traitement des données et ses droits.
**Action principale :** Consulter la section recherchée.
**Parcours court :** Sommaire → droits → contact existant.
**Microcopie proposée :** « Conserver les textes relatifs aux droits et aux traitements. »
**Avant :** contenu initial. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,16.

**États cibles :** Vide, chargement et succès : pas d’état métier autonome pour le contenu statique. Erreur : lien ou navigation indisponible identifié. Hors ligne : ne pas promettre la disponibilité initiale ; conserver le contenu déjà rendu. Les actions réseau de contact/abonnement suivent leur contrat existant.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## mentions-legales — `/mentions-legales`

**Objectif :** Identifier l’éditeur et les informations légales.
**Action principale :** Consulter les coordonnées.
**Parcours court :** Page → information recherchée.
**Microcopie proposée :** « Conserver les coordonnées et formulations vérifiées. »
**Avant :** contenu initial. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,16.

**États cibles :** Vide, chargement et succès : pas d’état métier autonome pour le contenu statique. Erreur : lien ou navigation indisponible identifié. Hors ligne : ne pas promettre la disponibilité initiale ; conserver le contenu déjà rendu. Les actions réseau de contact/abonnement suivent leur contrat existant.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## admin — `/(admin)`

**Objectif :** Administrer les fonctions autorisées sans erreur.
**Action principale :** Action du module actif, une seule primaire.
**Parcours court :** Module → objet → modifier → confirmer.
**Microcopie proposée :** « Modifications enregistrées. »
**Avant :** redirection vers connexion. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,14,15.

**États cibles :** Vide : objet ou section absent explicite. Chargement : squelette du module. Erreur : conserver la saisie et proposer Réessayer. Succès : enregistrement confirmé sans message trompeur. Hors ligne : ne pas confirmer une sauvegarde non aboutie. Destruction séparée, confirmation existante conservée.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## standalone-partiel — `/partiel.html`

**Objectif :** Lire ses résultats et explorer des hypothèses.
**Action principale :** Importer un relevé.
**Parcours court :** Importer → vérifier les colonnes → consulter → simuler.
**Microcopie proposée :** « Importez votre relevé pour afficher les résultats. »
**Avant :** éditeur ou import initial, sans compte. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,15,18.

**États cibles :** Vide : prérequis et prochaine action explicites. Chargement : forme du résultat attendu ou phase honnête ; annulation si prise en charge. Erreur : conserver les entrées, nommer le problème, Réessayer. Succès : résultat puis export ou étape suivante. Hors ligne : opérations distantes indisponibles, aucun succès ni archivage inventé.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## standalone-presentation — `/presentation.html`

**Objectif :** Préparer une présentation.
**Action principale :** Exporter la présentation.
**Parcours court :** Contenu → structure → aperçu → export.
**Microcopie proposée :** « Vérifiez les diapositives avant l’export. »
**Avant :** éditeur ou import initial, sans compte. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,15,18,21.

**États cibles :** Vide : prérequis et prochaine action explicites. Chargement : forme du résultat attendu ou phase honnête ; annulation si prise en charge. Erreur : conserver les entrées, nommer le problème, Réessayer. Succès : résultat puis export ou étape suivante. Hors ligne : opérations distantes indisponibles, aucun succès ni archivage inventé.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## standalone-cv — `/cv-builder.html`

**Objectif :** Préparer et exporter un CV.
**Action principale :** Télécharger le PDF.
**Parcours court :** Saisir/importer → aperçu → exporter.
**Microcopie proposée :** « Votre CV est prêt à être exporté. »
**Avant :** éditeur ou import initial, sans compte. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,15,18.

**États cibles :** Vide : prérequis et prochaine action explicites. Chargement : forme du résultat attendu ou phase honnête ; annulation si prise en charge. Erreur : conserver les entrées, nommer le problème, Réessayer. Succès : résultat puis export ou étape suivante. Hors ligne : opérations distantes indisponibles, aucun succès ni archivage inventé.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.

## standalone-article — `/article.html`

**Objectif :** Structurer un travail rédactionnel.
**Action principale :** Enregistrer, puis exporter selon contexte.
**Parcours court :** Plan → rédaction → références → sauvegarde/export.
**Microcopie proposée :** « Modifications enregistrées. »
**Avant :** éditeur ou import initial, sans compte. **Après :** non livré ; A/B disponibles pour accueil, chat et document.
**Décisions associées :** UX-12,15,18,21.

**États cibles :** Vide : prérequis et prochaine action explicites. Chargement : forme du résultat attendu ou phase honnête ; annulation si prise en charge. Erreur : conserver les entrées, nommer le problème, Réessayer. Succès : résultat puis export ou étape suivante. Hors ligne : opérations distantes indisponibles, aucun succès ni archivage inventé.
**Vérification :** 390, 768, 1024 et 1440 px ; navigation clavier, focus, zoom, mouvement réduit et rôles applicables. Les captures initiales ne prouvent pas ces parcours complets.
