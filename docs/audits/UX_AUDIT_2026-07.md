# Plan d'action — Audit UX & bugs des outils (hors chatbot)

```yaml
status: En cours
date: 2026-07-04
scope: Expérience utilisateur 100% + correctifs de bugs, feature par feature
methode: 1 feature = 1 lot de correctifs testés = 1 commit. Cocher ici quand fini.
regle_tokens: ce fichier est la SOURCE DE VÉRITÉ durable. Une fois une feature cochée,
  ses détails peuvent sortir du contexte de travail sans rien perdre.
```

> Rapport d'audit visuel : artifact « Audit UX & bugs des outils MedInfo ».
> Priorités : **P1** bug/à corriger vite · **P2** UX importante · **P3** polish · **SÉCU** arbitrage Hugo requis.

## Ordre d'exécution (feature par feature)

### Lot 1 — Bugs & incohérences (rapide, fort impact)
- [x] **F1 · ECOS** — Corriger le chrono qui se réinitialise à chaque frappe (`Timer` : `onExpire` dans les deps `useEffect`). `app/(chat)/ecos.tsx`. **P1**
- [x] **F2 · Analyse de document** — Retirer le faux paywall « Premium » (`isPaid = Boolean(session)` stub + `PremiumGate`), s'appuyer sur `RoleGate` + serveur. `app/(chat)/document.tsx`. **P1**
- [x] **F3 · Audio** — Retirer le même faux paywall « Premium » + afficher un message quand le compte rendu échoue partiellement (`report:null` silencieux). `app/(chat)/audio.tsx`. **P1/P2**
- [x] **F4 · Présentations** — Confirmation avant suppression d'un deck dans « Mes présentations ». `public/presentation.html`. **P2**
- [x] **F5 · Partiels** — Vrai glisser-déposer (la zone dit « Déposer le fichier » mais n'a pas de handler `drop`). `public/partiel.html`. **P2**
- [x] **F6 · CV** — Échapper `photoUrl` dans `src=""` + remplacer l'octet NUL littéral de la regex par `\x00`. `public/cv-builder.html`. **P3**

### Lot 2 — UX (cohérence entre outils)
- [x] **F7 · Document** — Ajouter Copier + Export PDF du résultat + fiabiliser le refresh de l'historique (re-poll court). **P2**
- [x] **F8 · Audio** — Copier inline (transcription + compte rendu) + alerte de durée avant la limite 25 Mo. **P2**
- [x] **F9 · ECOS** — Réponses patient en streaming + confirmation avant « Terminer et évaluer » + export de l'évaluation. **P2**
- [x] **F10 · Dictée vocale** — Retour visible en cas d'échec (micro refusé / transcription échouée). `src/ui/DictationButton.tsx`. **P2**

### Lot 3 — Robustesse (fond)
- [x] **F11 · CDN** — Auto-héberger les libs (pptxgenjs, html2canvas, jsPDF, pdf.js, xlsx, mammoth) **et les polices Google Fonts** des outils autonomes dans `/public/vendor`. **P2**
- [x] **F12 · Partiels** — Fidélité PDF : couleurs résolues en dur (html2canvas 1.4.1 ne rasterise pas `color-mix()`/variables CSS dans le radar & la courbe de Gauss). **P2/P3**
- [x] **F13 · Blog / navigation** — Passe dédiée (rendu markdown des articles, états vides, navigation rôle-aware). **P3**
- [x] **F14 · Outil « Rédaction d'article » (#109)** — Audit dédié de `public/article.html` (1586 lignes) + `app/(chat)/article.tsx`. **Verdict : outil de très haute qualité** — snapshot + détection de modification avant d'appliquer une proposition IA, réduction re-comptée côté serveur (jamais sur parole de l'IA), ré-ancrage des citations, `esc()` partout, confirmations sur toutes les actions destructives, exports Word/MD échappés, liens `rel="noopener noreferrer"`, sauvegarde locale + cloud + `pagehide`. **1 durcissement** appliqué : validation du schéma http(s) sur `sourceUrl` du contrôle d'originalité (issu d'une recherche web) avant de le rendre cliquable (anti `javascript:`/`data:`). Note : l'import DOI/PMID reste un appel externe (CrossRef/Europe PMC) — inhérent (base bibliographique), dégradation propre vers la saisie manuelle.

### Hors périmètre UX — nécessite arbitrage Hugo (NE PAS toucher sans go)
- [ ] **SÉCU** — Gardes persona serveur manquantes sur `/api/ecos` (systemPrompt arbitraire) et `/api/transcribe`. Lié à la réintroduction de la sécurité (ADR-0024).

## Journal (mis à jour à chaque feature finie)
<!-- format : - [x] Fn · <feature> — <commit sha> — <une ligne> -->
- [x] F1 · ECOS — chrono stabilisé (intervalle créé une fois, callback via ref) ; plus de gel pendant la saisie.
- [x] F2 · Document — faux paywall « Premium » supprimé (outil gratuit grand public) ; RoleGate gère invité (créer un compte) et rôle.
- [x] F3 · Audio — même faux paywall supprimé (outil role-gated pro) ; message clair quand le compte rendu échoue mais que la transcription a réussi.
- [x] F4 · Présentations — confirmation avant suppression d'un deck (« Supprimer définitivement … ? »), aligné sur le CV Builder.
- [x] F5 · Partiels — vrai glisser-déposer (dragenter/over/leave/drop + surbrillance) + garde-fou fenêtre anti-navigation ; syntaxe du script vérifiée (node --check).
- [x] F6 · CV — photoUrl échappé dans src="" (plus de rupture d'attribut) ; octet NUL littéral de la regex remplacé par \x00 (fichier plus « binaire »). **Lot 1 terminé.**
- [x] F7 · Document — Copier + Export PDF du résultat (mini-markdown partagé `src/ui/miniMarkdown.ts`, exporteur `src/document/exportAnalysisPdf.ts`) ; historique ré-interrogé jusqu'à apparition (poll 1,2/2,5/4 s) au lieu d'un unique setTimeout.
- [x] F8 · Audio — Copier sur la transcription et le compte rendu ; garde-fou de taille (25 Mo) avant l'upload avec message clair au lieu d'un 413 générique.
- [x] F9 · ECOS — réponses patient affichées au fil du flux ; « Terminer et évaluer » demande confirmation (l'expiration du chrono reste automatique) ; Copier + Export PDF de l'évaluation.
- [x] F10 · Dictée — message d'erreur transitoire (bulle) si micro refusé / transcription échouée / aucune parole ; repli clavier inchangé. **Lot 2 terminé.**
- [x] F12 · Partiels — radar & courbe de Gauss (SVG) : couleurs `color-mix()`/`var(--)` remplacées par hex/rgba résolus (palette `SVGC`) pour que l'export PDF (html2canvas) les rende ; rendu écran identique. Syntaxe vérifiée (node --check).
- [x] F14 · Article — audit dédié : outil très solide (voir ci-dessus) ; seul correctif = validation http(s) de `sourceUrl` (contrôle d'originalité) avant lien cliquable. Syntaxe vérifiée (node --check).
- [x] F11 · CDN — 7 libs JS (3,9 Mo) + polices latin (5 woff2, 236 Ko) vendorisées dans `public/vendor/` ; les 4 outils autonomes (partiel/présentation/cv/article) ne référencent plus AUCUN CDN (sweep vérifié) ; worker pdf.js local ; README de provenance. Syntaxe des 4 outils vérifiée.
- [x] F13 · Blog/nav — pages blog solides (skeleton, états vide/introuvable, SEO, MarkdownRenderer) ; filet `.catch/.finally` ajouté sur les 2 chargements (plus de skeleton infini si la promesse rejette) ; navigation rôle-aware OK (outil `article` bien câblé dans featureVisibility, tests verts). Outil Article (nouveau, #109) = audit dédié à part → F14.
