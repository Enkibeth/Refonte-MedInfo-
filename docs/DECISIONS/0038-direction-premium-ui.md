# ADR-0038 — Direction premium et contrat d’attente du chat

```yaml
status: Proposed
date: 2026-09-26
owner: Hugo Bettembourg
scope: UI/UX uniquement
```

## Contexte

La refonte doit rendre MedInfo AI premium, distinctif et attractif, avec une identité
cohérente et une attente de chat honnête. Deux directions sont présentées dans
`docs/audits/2026-09-premium/`. Les tests existants de phases et de reprise constituent
une base à étendre. Le périmètre exclut API, prompts, serveur, base, RLS, autorisations
et migration d’hébergement.

## Décision proposée

Choisir A « Bureau de référence » ou B « Cahier médical », puis centraliser les tokens
sémantiques v2 et les primitives avant toute harmonisation des écrans. Conserver les trois
polices, le logo, la famille d’icônes et les gardes d’accès actuels. Donner à l’envoi un
état UI immédiat, dériver les phases d’événements reçus, stabiliser les blocs clos du rendu
et préserver le contrôle de l’utilisateur sur le défilement.

## Conséquences et réserves

- Aucune décision n’est acceptée avant validation de Hugo ; aucun token produit ne change
  dans ce lot documentaire.
- `sendSources` est désactivé par défaut dans le chemin SDK actuel. Son activation
  constituerait une exception au périmètre API, à autoriser séparément et à vérifier
  avec le provider réel. La direction ne présume pas qu’elle sera autorisée.
- Une garantie de reprise pour les invités ne peut être obtenue par un changement de
  style : pas d’archive de conversation invitée dans le contrat actuel.
- Les libellés de confiance et la terminologie d’aide à la décision sont signalés à
  Hugo, sans changement automatique de textes réglementaires.
- Pas de nouvelle dépendance de production, pas de mode sombre, pas de modification
  des scripts de build ni des répertoires d’hébergement.

## Statut

Proposed — attente du choix de Hugo et des arbitrages explicités dans le rapport.
