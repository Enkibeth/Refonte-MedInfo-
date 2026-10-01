# Photographies de l’accueil

Sélection du 28 septembre 2026. Photographies réelles d’illustration, sans
témoignage ni revendication d’utilisation de MedInfo AI par les modèles.

| Fichier | Photographe | Original Pexels |
|---|---|---|
| `study*` | Yan Krukau | [Étudiants à la bibliothèque](https://www.pexels.com/photo/students-studying-in-a-library-using-laptop-and-books-8199759/) |
| `work*` | Tima Miroshnichenko | [Travail sur tablette au bureau](https://www.pexels.com/photo/a-medical-doctor-working-behind-a-desk-5407215/) |
| `sources*` | Yan Krukau | [Lecture et prise de notes](https://www.pexels.com/photo/a-person-taking-down-notes-8199654/) |

## Licence et usage

[Licence Pexels](https://www.pexels.com/license/) consultée le 28 septembre 2026 :
utilisation sur un site commercial et modification autorisées, attribution
facultative. Ne pas suggérer l’approbation du produit par les personnes
représentées, ni les présenter comme des patients, des membres de l’équipe ou
des utilisateurs réels. Les fichiers ne sont pas un corpus documentaire médical.

## Livraison

- JPEG 1000 × 667 pour React Native (qualité 82).
- WebP 640 × 427 et 1000 × 667 (qualité 80) pour le web, sélection via `srcSet`.
- Poids maximum téléchargé pour les trois photos web : 133 006 octets (130 Kio).
- Fichiers locaux versionnés et servis par l’application, sans hotlink ni traqueur.
- Encodage et réduction de taille uniquement ; contenu photographique inchangé.
  Le recadrage d’affichage est porté par `object-fit: cover` / `resizeMode="cover"`.
- Photo principale prioritaire ; les deux suivantes se chargent à l’approche
  du défilement. Les ratios réservent la place avant le chargement.
- Texte alternatif partagé entre les variantes web et native dans
  `src/ui/landingPhotos.ts`.

Sources de téléchargement : `https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg`
(identifiants : 8199759, 5407215, 8199654 ; largeur demandée : 1000).
