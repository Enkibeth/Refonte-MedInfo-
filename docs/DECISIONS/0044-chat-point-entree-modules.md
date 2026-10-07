# ADR-0044 — Le chat comme point d'entrée des modules (cartes d'action, tri des fichiers)

```yaml
status: Accepted
date: 2026-10-07
owner: Hugo Bettembourg
linked_to: [ADR-0024, ADR-0034, ADR-0035, ADR-0037, ADR-0018, 01_REGULATION]
scope: Niveaux 1 et 2 validés par Hugo ; le niveau 3 (outils exécutés côté serveur) reste NON décidé.
```

## Contexte

Question de Hugo, 2026-10-07 : « Tu pourrais faire de MedInfo un chatbot omniscient, capable
d'appeler tous les modules qu'on a créés depuis le chat ? Exemple : analyse mes notes de
partiels, je lui envoie le fichier et il utilise l'outil d'analyse de partiels. »

Un agent qui appelle lui-même les outils a été écarté pour cinq raisons :

1. **Latence.** L'ADR-0037 vient de retirer la boucle agentique : en production, chaque étape
   coûtait 15 à 18 s. Un appel d'outil réintroduit au moins une étape.
2. **Données de tiers.** Un relevé de partiels contient les notes de toute une promotion.
   L'outil Partiels les traite sur l'appareil, sans IA ni réseau (ADR-0035). Les faire passer
   par le modèle les enverrait au fournisseur, alors que le calcul est déterministe.
   **Constat en lisant le code :** le chat étudiant/pro acceptait déjà les `.csv` et les
   inlinait dans la requête (`src/ai/chat/attachment.ts`). Un CSV de promo joint au chat
   partait donc chez le fournisseur du modèle.
3. **Réglementation.** Un score calculé par le modèle à partir de valeurs de patient tapées en
   texte libre devient une aide individualisée (règle n°3 de `CLAUDE.md`). C'est très différent
   du formulaire de l'outil Scores, rempli volontairement, avec avertissement.
4. **Sécurité.** Le chat n'a plus de garde-fous (ADR-0024). Avec des pièces jointes, un document
   piégé pourrait déclencher un outil qui écrit des données.
5. **Coût et fiabilité.** Les définitions d'outils sont facturées à chaque message, et le modèle
   choisit moins bien quand il a plus d'outils.

## Décision

**Le chat devient le point d'entrée des modules sans rien exécuter lui-même. Ni appel ni étape
en plus : il reste un seul appel LLM par réponse (ADR-0037).**

### Niveau 1 — tri des pièces jointes, sans IA

`src/chat/gradeSheet.ts` est un module pur. Il trie le fichier choisi dans le chat **avant tout
envoi** :

| Verdict | Fichier | Conduite |
|---|---|---|
| `grade-table` | `.csv`/`.tsv`/`.txt` dont les 64 premiers Ko ont la forme d'un relevé de notes | **Jamais joint au message.** Carte « Analyser dans Partiels » si l'outil est ouvert au rôle, sinon explication seule |
| `spreadsheet` | `.xlsx`/`.xls`/`.xlsm`/`.ods` | Le chat ne lit pas les tableurs : carte Partiels (proposée au sélecteur seulement si l'outil est ouvert) |
| `grade-pdf-name` | PDF dont le **nom** évoque des résultats | Suggestion seulement (le contenu n'est pas lisible ici sans pdf.js) : « Analyser dans Partiels » ou « Joindre quand même » |
| `other` | le reste | Pièce jointe ordinaire (ADR-0034, inchangée) |

Un relevé **collé** dans la saisie déclenche la même carte, à titre de suggestion : l'envoi
reste possible.

Choix de l'heuristique : un faux positif coûte un copier-coller, un faux négatif envoie une
promo entière à l'IA. Un export de bilans biologiques (dates et valeurs) ne doit pas pour autant
passer pour des notes. D'où deux règles :
- avec en-tête : des mots caractéristiques sont exigés (moyenne, rang, matricule, anonymat, UE,
  épreuve, coefficient…) ; « note » seul ne suffit qu'avec au moins deux colonnes sur 20 ;
- sans en-tête : au moins 15 lignes, une colonne d'identifiants distincts et au moins deux
  colonnes sur 20.

**Relais :** le `File` passe par un relais en mémoire de l'onglet (`src/chat/moduleHandoff.ts`,
expiration 60 s), puis par `postMessage` à `public/partiel.html` (même origine, fenêtre parente,
vrai fichier). La page l'importe exactement comme un fichier choisi à la main, et le fichier
n'est jamais téléversé.

### Niveau 2 — cartes d'action dans la réponse

Dans la même réponse, le modèle peut écrire une ligne-marqueur invisible :
`<!--OUTIL:id-->` ou `<!--OUTIL:id|paramètre-->`. L'interface la transforme en carte
« Ouvrir » (`src/ai/chat/moduleActions.ts`, `ModuleActionsBlock` dans
`src/ui/chat/AssistantBlocks.tsx`).

- **Cloisonnement :** la consigne envoyée au modèle ne liste que les outils de la persona
  **vérifiée côté serveur** (`moduleActionToolsFor`). Un visiteur n'en reçoit aucun. Le client
  re-filtre chaque carte avec la même règle (`isFeatureVisible`), et chaque outil garde son
  RoleGate et sa garde serveur.
- **Paramètre :** un seul, court, nettoyé et borné à 120 caractères : spécialité (ECOS), nom de
  score (Scores) ou sujet (Présentation). Jamais une donnée de patient ni un résultat. La
  consigne l'interdit et le parseur retire tout balisage.
- **Rien sans clic :** l'outil ouvert fait son propre travail.
  - Scores : le score nommé s'ouvre ; une demande ambiguë pré-remplit seulement la recherche.
  - ECOS : filtre du tableau de bord.
  - Présentation : le sujet est pré-rempli dans le mode IA. Le deck en cours est enregistré
    avant, ou une confirmation est demandée s'il ne peut pas l'être.
- **Rendu sûr :** un marqueur n'est jamais affiché. Dans le flux, la ligne est retenue puis
  reportée. Un marqueur glissé en milieu de phrase est extrait, et tout commentaire HTML est
  retiré du corps. Copie et export PDF les omettent. Un outil inconnu ne produit rien.
- **Consigne :** au plus 2 cartes, aucune pour une simple question de connaissances. Le modèle
  ne prétend jamais avoir ouvert ou exécuté un outil. Pour Partiels, il ne demande jamais de
  coller les notes d'une promo. La section n'est envoyée que pour les tours substantiels. Elle
  fait 1 200 à 2 240 caractères selon le rôle, soit environ 330 à 620 tokens d'entrée (estimation
  à 3,6 caractères par token), moins de 0,0001 $ par message au tarif de gpt-6-luna.

### Puces CALC (chatbot professionnel)

Les puces `<!--CALC:…-->` envoient toujours « Calcule avec moi… » au chat, comportement
conservé. Elles proposent désormais aussi le **même score dans l'outil Scores**, calculé de façon
déterministe et sans IA (`scoreIdForCalc`). 21 des 27 identifiants CALC correspondent à un score
du catalogue ; les autres (GRACE, PSI, Apgar, Bishop, mMRC, CAT) restent sans lien.

## Conséquences

**Ce qu'on gagne.**
- Les modules deviennent accessibles depuis la conversation, à latence et coût d'appel
  inchangés (même appel, aucune étape).
- La fuite des CSV de promo vers le modèle est fermée.
- Pour les scores, un chemin déterministe remplace l'arithmétique du modèle.

**Ce qu'on assume.**
- La reconnaissance d'un PDF ne repose que sur son nom. Un relevé PDF mal nommé reste joignable
  au chat, comme avant.
- L'heuristique tabulaire peut se tromper dans les deux sens. Les cas réels connus sont fixés
  par des tests (`tests/unit/chat-grade-sheet.test.ts`).
- La pertinence des cartes dépend du modèle. Elle n'est pas encore mesurée.
- Les pièces jointes restent web seulement (pas de sélecteur natif) ; les cartes fonctionnent
  partout.
- « Calcule avec moi » (CALC) fait toujours calculer le score par le modèle. À arbitrer :
  basculer ces puces vers l'outil Scores seul.

**Aucune couche de régulation n'est modifiée :** disclosure, autorisation persona serveur,
cloisonnement des chatbots, RLS. Il n'y a ni migration, ni nouvelle feature IA admin, ni appel
LLM ajouté.

## Suivi

- Mesurer la fréquence et la pertinence des cartes, par exemple en comptant les marqueurs dans
  `onFinish` de `/api/chat`, sans contenu. Le niveau 3 n'est à envisager que si les données
  montrent qu'on veut le résultat **dans** la conversation.
- **Niveau 3 (non décidé)** : de vrais outils serveur, limités aux calculs déterministes en
  lecture seule (moteur de scores, planificateur de révisions). Il ajouterait une étape (environ
  15 s) sur les seuls tours concernés et demande un ADR qui amende l'ADR-0037. Pour les scores
  calculés sur des valeurs de patient, il faut aussi l'arbitrage réglementaire de Hugo.
- Vérification : tests `chat-module-actions`, `chat-module-actions-render`, `chat-grade-sheet`
  et `chat-module-handoff`. Fumigation navigateur `scripts/dev/partiel-smoke.mjs` §21 : le relais
  depuis le chat donne les mêmes moyenne et rang qu'un import manuel, avec la CSP de production.
