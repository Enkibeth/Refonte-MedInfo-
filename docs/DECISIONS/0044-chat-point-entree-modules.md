# ADR-0044 — Le chat comme point d'entrée des modules (cartes d'action, tri des fichiers)

```yaml
status: Accepted
date: 2026-10-07
owner: Hugo Bettembourg
linked_to: [ADR-0024, ADR-0034, ADR-0035, ADR-0037, ADR-0018, 01_REGULATION]
scope: Niveaux 1 et 2 validés par Hugo, puis second lot décidé sur délégation (« prends des décisions et rends mon idée vraiment utile ») ; le niveau 3 (outils exécutés côté serveur) reste NON décidé.
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

### Puces CALC (chatbot professionnel) — décision : le calculateur d'abord

Un score suggéré par `<!--CALC:…-->` qui existe dans le calculateur s'ouvre **directement** dans
l'outil Scores (critères figés, calcul déterministe, sans arithmétique du modèle) :
`scoreIdForCalc`. 21 des 27 identifiants CALC sont dans le catalogue. Seuls les six autres
(GRACE, PSI, Apgar, Bishop, mMRC, CAT) gardent « Calcule avec moi… », à cocher puis envoyer.
Sans accès à l'outil Scores, tous les scores gardent ce comportement historique.

Motif : un score calculé par le modèle à partir de valeurs tapées en texte libre est le cas le
plus fragile du point de vue clinique comme réglementaire, et un outil sans IA fait le même
calcul.

### Second lot (décisions du 2026-10-07)

Hugo a délégué les arbitrages : « prends des décisions et rends mon idée vraiment utile ».
L'idée de départ est un chat qui « sait tout faire ». Ce qui manquait pour qu'elle le devienne
sans agent : le **retour** de l'outil vers le chat, un **chemin rapide** pour qui sait ce qu'il
veut, et la **reprise d'une réponse** dans un outil. Toujours sans appel LLM ni étape ajoutés.

1. **Aller-retour outil → chat.** Un relais `chat` (`src/chat/moduleHandoff.ts`) ouvre une
   nouvelle conversation sur le chatbot étudiant avec un message **pré-rempli**, jamais envoyé
   d'office. Un bandeau dit d'où il vient.
   - **Partiels → « Construire mon plan avec le chat ».** `chatBriefing` (bloc @partiel-logic,
     testé) ne transmet que les résultats de l'étudiant : moyenne, rang, notes, écarts à la
     promo, forces et faiblesses. Jamais son identifiant, jamais le nom du fichier, jamais la
     note d'un autre. Les agrégats de promo (moyenne, médiane, σ, rang) n'apparaissent que si au
     moins 5 étudiants y contribuent : sur une promo de deux, moyenne et note suffiraient à
     retrouver la note de l'autre. Le message demande au modèle de ne rien recalculer.
   - **ECOS → « Retravailler avec le chat ».** `src/ecos/chatDebrief.ts` reprend la station
     (fictive), la note et l'évaluation, et demande un débriefing actif (éléments manqués, puis
     3 questions de contrôle). La transcription de la simulation n'est jamais reprise.
   - La consigne du modèle dit de s'appuyer sur ces chiffres sans les recalculer et de proposer
     l'outil de l'étape suivante (planning de révisions après un plan d'action) : la boucle
     Partiels → chat → Révisions se ferme d'elle-même.
2. **Commandes « / » dans le composeur** (`src/ai/chat/slashCommands.ts`, `SlashMenu`).
   - Exemples : `/ecos cardiologie`, `/score HAS-BLED`, `/partiels`,
     `/présentation insuffisance cardiaque`.
   - La commande ouvre l'outil immédiatement, **sans appel au modèle** : même relais et même
     paramètre borné qu'une carte.
   - Seuls les outils du rôle sont proposés. Accents et casse sont ignorés, et des alias
     existent (`/notes`, `/slides`…).
   - Navigation au clavier (↑/↓, Entrée, Tab, Échap). Une saisie qui n'est pas une commande
     reste un message ordinaire. Une astuce dans l'état vide montre deux exemples du rôle.
3. **« En faire une présentation » sous une réponse** (étudiant et pro). Le générateur reçoit
   la question comme sujet et la réponse en texte propre, sources comprises (6 000 caractères au
   plus, sous la limite de 8 000 de `/api/presentation`). Le tout est pré-rempli en mode IA ;
   rien n'est généré sans clic, et le deck en cours n'est jamais écrasé.
4. **Glisser-déposer un fichier sur le chat** (web), même tri que le sélecteur. Les écouteurs
   ne sont posés que si le chat est l'écran affiché (`useIsFocused`) : l'onglet reste monté sous
   les autres outils, et un fichier lâché ailleurs ne doit pas atterrir dans le chat.
5. **Mesure.** Les cartes proposées sont comptées dans `ai_interactions.tool_calls` sous des clés
   `carte:<outil>` (`moduleActionCounts`) : noms seuls, jamais le paramètre. L'onglet Coûts ne
   facture que la recherche web, ces clés n'y comptent donc pas. Les clics ne sont pas mesurés :
   ils se passent côté client.

## Conséquences

**Ce qu'on gagne.**
- Les modules deviennent accessibles depuis la conversation, à latence et coût d'appel
  inchangés (même appel, aucune étape), et la conversation reçoit en retour ce que les outils
  ont calculé.
- La fuite des CSV de promo vers le modèle est fermée (sélecteur, glisser-déposer, texte collé).
- Pour les scores du catalogue, le calcul déterministe remplace l'arithmétique du modèle.

**Ce qu'on assume.**
- La reconnaissance d'un PDF ne repose que sur son nom. Un relevé PDF mal nommé reste joignable
  au chat, comme avant.
- L'heuristique tabulaire peut se tromper dans les deux sens. Les cas réels connus sont fixés
  par des tests (`tests/unit/chat-grade-sheet.test.ts`).
- La pertinence des cartes dépend du modèle. Elle n'est pas encore mesurée.
- Les pièces jointes restent web seulement (pas de sélecteur natif) ; les cartes fonctionnent
  partout.
- « Calcule avec moi » reste pour les six scores absents du catalogue. Les ajouter au
  calculateur supprimerait ce dernier calcul par le modèle.
- Le message envoyé par Partiels ou ECOS contient des résultats personnels (pédagogiques) que
  l'étudiant choisit d'envoyer après les avoir relus. Il est archivé dans l'historique du chat
  comme tout message.

**Aucune couche de régulation n'est modifiée :** disclosure, autorisation persona serveur,
cloisonnement des chatbots, RLS. Il n'y a ni migration, ni nouvelle feature IA admin, ni appel
LLM ajouté.

## Suivi

- Lire `carte:<outil>` dans `ai_interactions.tool_calls` après quelques semaines : quels outils
  le modèle propose, et à quelle fréquence. Le niveau 3 n'est à envisager que si les données
  montrent qu'on veut le résultat **dans** la conversation.
- **Niveau 3 (non décidé)** : de vrais outils serveur, limités aux calculs déterministes en
  lecture seule (moteur de scores, planificateur de révisions). Il ajouterait une étape (environ
  15 s) sur les seuls tours concernés et demande un ADR qui amende l'ADR-0037. Pour les scores
  calculés sur des valeurs de patient, il faut aussi l'arbitrage réglementaire de Hugo.
- Vérification, tests unitaires : `chat-module-actions`, `chat-module-actions-render`,
  `chat-grade-sheet`, `chat-module-handoff`, `chat-slash-commands`, `partiel-chat-briefing` et
  `ecos-chat-debrief`.
- Vérification, fumigations navigateur :
  - `scripts/dev/partiel-smoke.mjs` §21 : le relais donne les mêmes moyenne et rang qu'un import
    manuel, avec la CSP de production ;
  - `scripts/dev/chat-hub-smoke.mjs` (nouveau, session étudiante simulée) : parcours complet A à
    G, 23 contrôles, aucun appel au modèle pour un relevé ou une commande, aucun identifiant
    étudiant dans le message préparé par Partiels.
