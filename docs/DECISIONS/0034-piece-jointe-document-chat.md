# ADR-0034 — Pièce jointe (document) dans la conversation (étudiant + professionnel)

```yaml
status: Accepted
date: 2026-07-17
owner: Hugo Bettembourg
deciders: Hugo
supersedes: []
related: [ADR-0024, ADR-0030, ADR-0033]
```

## Contexte

Demande Hugo : pouvoir **joindre un document directement dans la conversation** (compte rendu,
résultat de biologie, ordonnance, imagerie), **réservé aux comptes vérifiés étudiant/pro**.

L'outil « Analyse de document » (`/api/analyze`, grand public) prouve déjà le pattern fiable :
le fichier (PDF/image) est **transmis tel quel au modèle multimodal** (lu nativement) puis
**oublié** — seul le résultat est archivé, le document lui-même n'est jamais stocké.

## Décision

1. **Réutiliser le pattern multimodal** plutôt qu'une extraction de texte fragile : le document
   est envoyé au modèle du chat comme part de message (`file` pour un PDF, `image` pour une photo,
   texte inliné pour un fichier texte), via le pipeline chat existant.

2. **Transport** : le fichier est lu côté client (navigateur, `FileReader`), envoyé en **base64
   dans le body JSON** de `/api/chat` (champ `attachment`). Web-first (comme les autres outils
   documentaires). Taille max 6 Mo, types PDF/JPEG/PNG/WebP/texte.

3. **Garde d'accès** : `src/ai/chat/attachment.ts` (pur, testé) `coerceChatAttachment` valide/borne
   la pièce jointe ; côté serveur, elle n'est injectée que si la **persona vérifiée** est
   étudiant/professionnel (+ admin) — le body ne donne AUCUN droit. Côté UI, le bouton trombone
   n'apparaît que pour ces comptes (masquage jamais l'unique barrière). Injection dans les messages
   modèle **après** `convertToModelMessages` (`appendAttachmentToModelMessages`, sur le dernier
   message utilisateur).

4. **Confidentialité** : le document est **transitoire** — transmis au modèle puis oublié, **jamais
   stocké** (comme `/api/analyze`). Seul un marqueur « 📎 nom » est archivé avec le message
   utilisateur (le contenu du fichier ne l'est pas). Aucune migration, aucune nouvelle feature admin.

## Conséquences

- Réponses du chat étudiant/pro enrichies par un document, sans nouvel appel LLM ni table.
- Fiabilité dépendante des capacités multimodales du **modèle du chat** (PDF/vision) : le défaut
  `gpt-5.2` lit images + PDF ; un admin peut configurer un modèle plus adapté par feature `chat`.
- Web-first : sur mobile natif, le bouton n'apparaît pas (lecture fichier navigateur).

## Suivi

- Étendre au picker natif (expo-document-picker) si le besoin mobile se confirme.
- Surveiller la taille des payloads base64 (cap 6 Mo) ; envisager un upload multipart dédié si besoin.

## Addendum 2026-10 — la pièce jointe appartient à son tour

Constat (ADR-0037, addendum 2026-10) : le document quittait la mémoire du navigateur dès
l'envoi. Un « Réessayer » ou un « ? » après une réponse vide ne transmettait plus que la
mention « Pièce jointe : nom », d'où « je ne vois pas le contenu de IMG_0847.png ».

- Le document est rattaché au **tour** où il a été joint, en mémoire de l'onglet seulement.
  « Réessayer » et « Régénérer » rejouent ce tour, document compris. Le tour suivant ne le
  renvoie pas.
- Si le tour reste **sans réponse**, le document revient dans le composeur. Un message tapé
  ensuite le transporte, et l'utilisateur peut le retirer.
- Côté serveur, si l'historique mentionne une pièce jointe que la requête ne transporte pas,
  une consigne le dit au modèle (`buildPriorAttachmentSection`). Le modèle invite alors à
  joindre à nouveau le document et ne commente **jamais** un document qu'il ne reçoit pas.
- **Confidentialité inchangée** : le document n'est jamais stocké côté serveur. La mention
  archivée est « Pièce jointe : nom » (et non « 📎 nom » comme écrit plus haut), produite et
  lue par un seul module (`withAttachmentMarker` / `mentionedAttachmentName`).
- **Non retenu à ce stade** (décision produit à prendre) : renvoyer le document à chaque tour
  suivant de la conversation, comme ChatGPT, pour les questions de relance sur la même
  image. Coût : ré-envoi jusqu'à 8 Mo par tour depuis un mobile, sauf à réduire l'image côté
  client.
