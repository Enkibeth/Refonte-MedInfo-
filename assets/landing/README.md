# Photographies de l’accueil

Sélection du 28 septembre 2026, première photo remplacée le 1er octobre 2026.
Photographies réelles d’illustration, sans
témoignage ni revendication d’utilisation de MedInfo AI par les modèles.

| Fichier | Photographe | Original Pexels |
|---|---|---|
| `medical-study*` (accueil actuel) | Gustavo Fring | [Étudiants en médecine partageant leurs notes](https://www.pexels.com/photo/group-of-medical-students-at-the-hallway-sharing-notes-3985154/) |
| `study*` (ancienne sélection conservée, non affichée) | Yan Krukau | [Étudiants à la bibliothèque](https://www.pexels.com/photo/students-studying-in-a-library-using-laptop-and-books-8199759/) |
| `work*` | Tima Miroshnichenko | [Travail sur tablette au bureau](https://www.pexels.com/photo/a-medical-doctor-working-behind-a-desk-5407215/) |
| `sources*` | Yan Krukau | [Lecture et prise de notes](https://www.pexels.com/photo/a-person-taking-down-notes-8199654/) |

## Licence et usage

[Licence Pexels](https://www.pexels.com/license/) consultée le 28 septembre et le 1er octobre 2026 :
utilisation sur un site commercial et modification autorisées, attribution
facultative. Ne pas suggérer l’approbation du produit par les personnes
représentées, ni les présenter comme des patients, des membres de l’équipe ou
des utilisateurs réels. Les fichiers ne sont pas un corpus documentaire médical.

## Livraison

- JPEG 1000 × 667 pour React Native.
- WebP 640 × 427 et 1000 × 667 pour le web, sélection via `srcSet`.
- Poids maximum téléchargé pour les trois photos web actuelles : 119 212 octets (116 Kio).
- Fichiers locaux versionnés et servis par l’application, sans hotlink ni traqueur.
- Encodage et réduction de taille uniquement ; contenu photographique inchangé.
  Le recadrage d’affichage est porté par `object-fit: cover` / `resizeMode="cover"`.
- Photo principale prioritaire ; les deux suivantes se chargent à l’approche
  du défilement. Les ratios réservent la place avant le chargement.
- Texte alternatif partagé entre les variantes web et native dans
  `src/ui/landingPhotos.ts`.

Sources de téléchargement : `https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg`
(identifiants actifs : 3985154, 5407215, 8199654 ; ancienne photo : 8199759).
Les variantes de la nouvelle photo sont livrées par Pexels avec les paramètres
`auto=compress`, `cs=tinysrgb`, `fm=webp` et `w=640` ou `w=1000`.
