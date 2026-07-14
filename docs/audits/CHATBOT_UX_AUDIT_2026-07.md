# Audit UX du chatbot — expérience par rôle + intégration Vue d'ensemble

```yaml
status: Proposé (audit — aucun correctif appliqué dans cette passe)
date: 2026-07-14
scope: Chat (3 chatbots), parcours par rôle (invité / public / étudiant / pro / admin),
  intégration avec la Vue d'ensemble (dashboard, refonte shell 2026-07)
methode: Lecture exhaustive du code — app/(chat)/chat.tsx, app/(chat)/dashboard.tsx,
  app/api/chat+api.ts, src/ai/chat/* (parseAssistantMessage, chatContext,
  starterSuggestions, tools/), src/ui/chat/* (AssistantBlocks, ChatbotSwitcher,
  HistoryPanel), src/chat/* (history, serverHistory, guestTrial, exportChatPdf),
  src/dashboard/overview.ts, src/ui/shell/AppShell.tsx, src/ui/AppTabBar.tsx,
  src/ui/ToolsMenu.tsx, src/ai/routing/featureVisibility.ts, prompts
  public.v3 / student.v3 / professional.v2
complement_de: docs/audits/UX_AUDIT_2026-07.md (audit des outils HORS chatbot)
priorites: P1 incohérence majeure/bug · P2 UX importante · P3 polish · ARBITRAGE = décision Hugo requise
```

## Verdict global

Le socle du chat est **très solide** — au niveau des références du marché sur plusieurs points :
streaming avec bulle de statut détaillée par outil (titre de l'article lu, requête, nb de liens),
reprise hors-ligne (archivage serveur + poll au retour), auto-scroll intelligent avec bouton
« revenir en bas », propositions à cocher avec envoi groupé explicite, colonne de lecture 800 px,
Entrée = envoyer sur desktop seulement, essai invité 1/1 → 0/1 avec verrou serveur, disclaimers
par chatbot, reduced-motion respecté partout. Le dashboard est honnête (aucun chiffre inventé,
fail-soft par section) et le deep-link `?conversation=` qui rouvre LA conversation est un bon patron.

**Mais l'expérience n'est pas encore « adaptée à chacun des rôles »** : le chatbot étudiant repose
sur un prompt écrit pour une architecture (RAG Collèges) qui n'existe plus dans le produit (P1),
il est le seul des trois sans UI de sources interactive (P2), et la Vue d'ensemble ignore
l'activité de tous les outils professionnels (P2). S'y ajoutent des incohérences de fil
(régénérer/arrêter vs archivage serveur) et un « Copier » qui colle du texte brut technique.

---

## A. Cohérence prompt ↔ produit (le chatbot étudiant est cassé sur le fond)

### A1 · **P1 + ARBITRAGE** — Prompt étudiant v3 écrit pour un RAG inexistant
`src/ai/prompts/student.v3.ts` promet et impose :
- « utilisation exclusive des livres médicaux **fournis dans tes embeddings** », « chunks
  d'embedding », « les 36 Collèges disponibles » ;
- « **Recherche internet interdite** » par défaut ;
- un bloc obligatoire « 🎯 SCORE DE FIABILITÉ » : « Couverture par les Collèges fournis : XX % »
  + « Nombre de chunks d'embedding mobilisés : N » ;
- des citations « (Abbr · Item N° · p.XXX · Rang A) » censées venir des chunks.

Or depuis l'ADR-0024 le RAG n'est **plus branché** sur `/api/chat`, `web_search` est forcé **ON**
(`getRuntimeForFeature('chat', { webSearch: true })`), et `buildChatToolsSection` impose à TOUS
les chatbots un workflow evidence-first avec recherche Europe PMC + vérification de liens —
en **contradiction frontale** avec le prompt.

Conséquences vécues par l'étudiant :
1. le « score de fiabilité » (% de couverture, nb de chunks) est **inventé à chaque réponse** —
   violation directe de la règle d'honnêteté du dépôt (« chiffres jamais inventés ») affichée
   comme une garantie de confiance ;
2. les numéros de page/items des Collèges sont **invérifiables et probablement hallucinés**
   (aucun corpus Collèges n'est fourni au modèle) ;
3. le system prompt se contredit lui-même (internet interdit vs workflow de recherche imposé) —
   comportement instable selon les tours.

**Décision Hugo requise** (prompt produit fourni par lui — ne pas réécrire sans go) :
- option 1 : réécrire `student.v3` pour l'architecture réelle (sources en ligne vérifiables
  LiSA/HAS/Collèges publiés, workflow d'outils assumé, suppression du score de fiabilité ou
  remplacement par une auto-évaluation qualitative honnête) ;
- option 2 : brancher un vrai RAG Collèges (gros chantier, ADR dédié) avant de re-promettre cela ;
- option 3 (minimum immédiat) : retirer du prompt le SCORE DE FIABILITÉ chiffré et
  l'interdiction d'internet, en gardant le format pédagogique.

### A2 · **P2** — Étudiant : seul chatbot sans UI de sources
Le parseur (`sectionKindOf`) ne reconnaît que `^SOURCES$` ; le prompt étudiant produit
« SOURCES UTILISÉES » (sans format `SRCn ::`, sans URL). Résultat : pas de cartes sources
cliquables, pas de pastille compteur dans l'en-tête, pas de modale « niveau de preuve » —
uniquement pour l'étudiant, censé être le public le plus exigeant sur le sourçage.
À traiter conjointement avec A1 : soit le nouveau prompt étudiant adopte le format `SRCn ::`
(cartes + badges existants gratuits), soit ajouter un alias de section + une carte
« référence bibliographique » sans URL.

### A3 · **P3** — Citations inline étudiantes verbeuses
« (CMIT · Item 161 · p.186) » après chaque bloc factuel alourdit fortement la lecture, alors que
le format `SRCn` des deux autres chatbots est rendu en appels de note ¹ ² compacts et cliquables.
À prendre en compte dans la refonte A1.

---

## B. Fiabilité du fil de conversation

### B1 · **P2** — « Copier » colle le texte technique brut
`MessageActions` copie `messageText(message)` tel quel : marqueurs `SRC1 :: [OFFICIEL] …`,
titres `SOURCES` / `INTERACTION` / `AUTO-RÉFLEXION`, `<!--CALC:…-->`, options `[…]` — tout ce que
l'UI masque ou transforme part dans le presse-papiers. Créer un formateur « texte propre »
partagé (réutiliser `formatInlineCitations` + filtrage des sections techniques) et l'utiliser
pour Copier **et** l'export PDF (qui convertit les `SRCn ::` mais laisse passer les blocs
QUESTIONS_PATIENT / INTERACTION bruts).

### B2 · **P2** — Régénérer / Arrêter incohérents avec l'archivage serveur
- **Régénérer** : `/api/chat` archive CHAQUE génération terminée (`saveAssistantMessageServer`,
  aucune déduplication). Le fil courant remplace la réponse, mais la conversation rouverte
  depuis l'historique montre **les deux réponses assistant à la suite** (et l'export PDF aussi).
- **Arrêter** : le client coupe le stream mais `consumeStream()` mène la génération au bout et
  archive la réponse **complète** — l'utilisateur voit un texte partiel, l'historique en contient
  un autre ; au retour dans la conversation, la version longue « réapparaît ».
Pistes : à la régénération, remplacer le dernier message assistant archivé de la conversation
(le serveur connaît conversationId) ; à l'arrêt volontaire, transmettre l'abandon (ne pas
archiver, ou archiver le partiel).

### B3 · **P2** — Erreur `signup_required` (401) non différenciée
Le serveur renvoie un code exploitable (`error: 'signup_required'`) quand une conversation
anonyme dépasse 1 message (localStorage purgé, session expirée…). Le client affiche la bannière
générique « Une erreur est survenue » + « Réessayer » — qui reboucle sur le même 401.
Détecter ce code et afficher la carte CTA inscription/connexion existante (`guestCtaCard`)
à la place ; pour un compte connecté dont le token a expiré, proposer « Se reconnecter ».

### B4 · **P3** — Bascule de chatbot : reset silencieux
Changer d'onglet dans le `ChatbotSwitcher` repart sur un fil vierge sans confirmation ni message.
Le fil précédent est archivé (comptes connectés) mais rien ne le dit. Un toast discret
(« Conversation précédente enregistrée dans l'historique ») ou une confirmation quand le fil est
non vide suffirait.

### B5 · **P3** — Conversation rouverte d'un chatbot non autorisé
`openConversation` ne bascule le chatbot que s'il est dans `availableChatbots` ; sinon le fil se
recharge mais la suite de la conversation part vers le chatbot courant, sans l'indiquer
(cas limite : compte repassé de « étudiant vérifié » à « public »).

---

## C. Adaptation par rôle

### Invité (essai sans inscription)
Le parcours est bien conçu (3 onglets découverte, indicateur 1/1 → 0/1, verrou serveur, CTA).
- **C1 · P2** — La réponse du message d'essai est **perdue** à la moindre navigation (pas
  d'historique invité, c'est normal) mais rien ne le dit : ajouter à la carte CTA « Créez un
  compte pour conserver cette réponse » — argument de conversion gratuit et honnête.
- **C2 · P3** — Après épuisement de l'essai, les chips de suggestion restent affichées et
  cliquables en apparence (`disabled` sans style) : les griser ou les masquer.
- **C3 · P3** — Mobile : en-tête + switcher + bandeau d'essai empilent ~3 barres avant le premier
  message ; fusionner le bandeau d'essai dans l'état vide (au-dessus des suggestions).

### Grand public
- **C4 · P2** — Aucune passerelle chat ↔ outil Analyse de document, les deux seuls outils du
  rôle : quand l'utilisateur colle un très long texte (compte rendu, ordonnance) dans le
  composer, suggérer l'outil Document (heuristique client simple sur la longueur/`\n`, aucune IA).
- **C5 · P3** — Titre d'état vide générique (« Posez votre première question ») : décliner par
  chatbot (le sous-titre l'est déjà via `meta.description`).

### Étudiant
- Dominé par **A1/A2/A3** (fond du prompt). En plus :
- **C6 · P3** — Passerelles de continuité : après un fil étudiant sur un item EDN, proposer les
  outils du rôle en lien réel (« Réviser cet item → Révisions », « M'entraîner → ECOS ») ;
  inversement les suggestions d'amorce pourraient piocher dans les données réelles de
  l'utilisateur (blocs du plan de révision du jour — données utilisateur, pas d'invention).

### Professionnel
- Le format pro est le mieux servi (INTERACTION `[A]+[B]+[C]`, `<!--CALC:…-->`, essais cliniques,
  sous-agent PubMed avec libellé de statut dédié). Voir **D1** : c'est au dashboard que le rôle
  pro est le moins bien servi.

### Admin
- RAS : switch 3 chatbots + tous les outils. Le panel admin permet déjà d'éditer les prompts —
  utile pour dérisquer A1 (itération sans déploiement).

---

## D. Intégration Vue d'ensemble ↔ chat

### D1 · **P2** — « Activité récente » ignore les outils pro et communs
`buildRecentActivity` ne fusionne que conversations / passages ECOS / plans de révision.
Un **professionnel** n'y voit donc QUE ses conversations ; un public que chat. Or toutes les
données existent en tables own-row : `document_analyses`, `audio_documents`,
`presentation_decks`, `cv_documents`, `article_documents`. Étendre le module pur
(entrées typées par feature, fail-soft par source comme aujourd'hui) + les fetchs dans
`dashboard.tsx` conditionnés par `isFeatureVisible`. C'est LE correctif qui rend le dashboard
« vraiment adapté à chaque rôle ».

### D2 · **P3** — Tuile « Chatbots : 3 » (ou 1) = constante, pas une donnée
Sans plan de révision, la 3e tuile du hero affiche le nombre de chatbots — invariant, sans
valeur. Remplacer par une donnée réelle dérivable : conversations des 7 derniers jours
(`updated_at`), ou dernière note ECOS pour l'étudiant.

### D3 · **P3** — Entrée directe par chatbot depuis le dashboard
La grille « Mes outils » n'a qu'une carte « Chat » ; pour étudiant/pro/admin, proposer les
3 chatbots en accès direct (cartes ou sous-liens `?bot=public|student|professional` — le
deep-link est déjà géré par `chat.tsx`, y compris écran déjà monté). La landing le fait, pas
l'espace connecté.

### D4 · **P3** — Chatbot d'origine invisible dans l'activité et le fil d'Ariane
L'activité récente affiche titre + catégorie mais pas le chatbot de la conversation
(`CHATBot_META.shortLabel` disponible) ; le fil d'Ariane du shell affiche « Chat » sans le
chatbot actif. À l'ouverture depuis le dashboard, la bascule de chatbot est silencieuse (cf. B4).

### D5 · **P3** — Historique = modale, même sur desktop shell
À ≥ 1024 px (sidebar repliable, place disponible), l'historique reste une modale plaquée à
gauche. Un panneau latéral persistant des conversations (motif ChatGPT/Claude) dans l'écran
chat desktop serait le prochain gros gain de confort ; la modale reste pour mobile.

---

## E. Accessibilité & finitions

- **E1 · P3** — Aucune `accessibilityLiveRegion`/`aria-live` sur la bulle de statut ni sur la
  réponse en streaming : un lecteur d'écran n'est pas informé que la réponse arrive.
- **E2 · P3** — Rotation des suggestions toutes les 30 s : le contenu peut changer sous le
  curseur/focus au moment du clic. Suspendre la rotation au survol/focus (et sous
  `prefers-reduced-motion`, une rotation de contenu reste discutable).
- **E3 · P3** — Historique : pas de renommage manuel du titre (IA seulement), recherche limitée
  titre/catégorie (pas le contenu), plafond silencieux de 200 conversations / 500 messages.
- **E4 · P3** — L'export PDF n'inclut pas la date des messages ni le chatbot par message
  (une conversation peut mélanger… non — un fil = un chatbot ; date globale seule, acceptable).

---

## Hors périmètre (rappels, ne pas traiter ici)

- **SÉCU (ADR-0024)** : réintroduction classifieur/guardrails/rate-limit sur le chat après
  validation de l'ébauche — déjà planifiée, arbitrage Hugo. L'essai invité reste contournable
  côté client (localStorage) par conception ; le verrou serveur limite à 1 message par
  conversation anonyme mais pas le nombre de conversations anonymes → à couvrir par le
  rate-limit lors de la réintroduction.
- Gardes persona serveur `/api/ecos` et `/api/transcribe` : déjà tracées dans
  `UX_AUDIT_2026-07.md` (section SÉCU).

---

## Plan d'action proposé (par lots)

### Lot 0 — Arbitrage Hugo (bloquant pour le lot 2)
- [ ] **A1** — Décision sur le prompt étudiant : réécriture pour l'architecture réelle /
  RAG Collèges (ADR dédié) / retrait minimal du SCORE DE FIABILITÉ chiffré. **P1 · ARBITRAGE**

### Lot 1 — Fiabilité du fil (rapide, fort impact, sans arbitrage)
- [ ] **B1** — Formateur « texte propre » partagé pour Copier + export PDF. **P2**
- [ ] **B2** — Régénérer : remplacer (pas ajouter) la dernière réponse archivée ; Arrêter :
  ne pas archiver la version complète non vue (ou signaler la reprise). **P2**
- [ ] **B3** — Mapper le 401 `signup_required` sur la carte CTA (invité) / reconnexion (session
  expirée) au lieu de la bannière générique. **P2**
- [ ] **C1** — Carte CTA invité : mention « conservez cette réponse en créant un compte ». **P2**

### Lot 2 — Adaptation étudiant (après lot 0)
- [ ] **A2** — UI de sources pour le chatbot étudiant (format `SRCn ::` dans le nouveau prompt,
  ou alias « SOURCES UTILISÉES » + carte biblio sans URL). **P2**
- [ ] **A3** — Rendu compact des citations inline étudiantes. **P3**
- [ ] **C6** — Passerelles chat étudiant → ECOS / Révisions. **P3**

### Lot 3 — Dashboard vraiment role-aware
- [ ] **D1** — Étendre `buildRecentActivity` + fetchs dashboard à document/audio/présentations/
  CV/article (fail-soft, `isFeatureVisible`). **P2**
- [ ] **D2** — Remplacer la tuile « Chatbots » par une métrique réelle. **P3**
- [ ] **D3** — Accès direct aux 3 chatbots depuis le dashboard (`?bot=`). **P3**
- [ ] **D4** — Afficher le chatbot d'origine (activité récente, fil d'Ariane). **P3**

### Lot 4 — Confort & accessibilité
- [ ] **D5** — Panneau d'historique persistant sur desktop shell. **P3**
- [ ] **B4/B5** — Signaler la bascule de chatbot (toast/confirmation) + le cas non autorisé. **P3**
- [ ] **C2/C3/C5** — Finitions invité + état vide par chatbot. **P3**
- [ ] **E1/E2/E3** — Live region streaming, rotation suspendue au survol, renommage de
  conversation. **P3**

## Journal (à remplir au fil des correctifs)
<!-- format : - [x] Xn · <finding> — <commit sha> — <une ligne> -->
