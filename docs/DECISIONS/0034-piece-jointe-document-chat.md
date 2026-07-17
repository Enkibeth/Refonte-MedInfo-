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
