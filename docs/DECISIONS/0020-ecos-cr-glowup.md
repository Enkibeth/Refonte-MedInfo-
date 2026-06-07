# ADR-0020 — ECOS & Compte rendu : favoris, progression, import de station, modèles, export, historique local

```yaml
status: Accepted
date: 2026-06-07
owner: Hugo Bettembourg
linked_to: [ADR-0006, ADR-0017, ADR-0018, ADR-0019, 01_REGULATION §5, CLAUDE.md]
inspiration: "Reprise d'idées du projet Enkibeth/QCM-quizz (favoris ⭐, decks, traitement local privacy-first, évaluation IA des réponses)."
```

## Contexte
QCM-quizz (medoutils) apporte plusieurs idées réutilisables : système de **favoris ⭐**
+ mode révision, **gestion de decks** persistés, **traitement local dans le navigateur**
(privacy-first), **export**, et **évaluation IA** des réponses. On les transpose aux deux
modules IA existants : **ECOS** (étudiant) et **Compte rendu** (professionnel), sans dégrader
la safe-box ni la doctrine de cloisonnement par rôle.

## Décision

### ECOS (`app/(chat)/ecos.tsx`)
1. **Favoris ⭐ + mode révision** : étoile sur chaque carte, filtre « Favoris ». Persistance
   **locale** (`src/lib/ecosStore.ts` → `localStorage` web only). Cas FICTIFS (ADR-0017) :
   aucune donnée de santé.
2. **Progression** : à la fin d'une station, la note `/20` est extraite de l'évaluation
   (`parseEcosScore`, pur, testé) et une session est enregistrée localement. Carte de progression
   (nombre de stations, moyenne, meilleure note), réinitialisable.
3. **Feedback + grille notée** : le prompt `ecos_evaluate` est durci pour produire une **première
   ligne canonique `**Note : X/20**`** + une **grille détaillée item par item** (✅/⚠️/❌, points
   obtenus/possibles) avant points forts / axes / feedback.
4. **Import de station → cas fictif** (`mode: 'generate'` de `/api/ecos`, feature `ecos_generate`) :
   l'étudiant colle/importe une station corrigée ; l'IA génère un **cas ECOS FICTIF et anonyme**
   (JSON typé : brief, rôle patient, grille). Garde-fous prompt : anonymisation imposée, **refus**
   si le texte ressemble à un dossier patient réel. Le cas généré est **éphémère et local à la
   session** : il n'est **PAS** écrit dans `ecos_cases` (corpus admin curé, ADR-0017).

### Compte rendu (`app/(chat)/audio.tsx`)
5. **Import texte (pas que l'audio)** : nouvelle route `/api/report` (feature `report_generate`) —
   des notes texte (collées ou dictées) + un modèle → CR structuré. La dictée vocale (ADR-0019)
   alimente la zone de texte.
6. **Modèles de CR** (`src/lib/reportTemplates.ts`, pur, testé) : Automatique, Consultation,
   Courrier au confrère, CR opératoire, Observation d'entrée, Mise en forme d'ordonnance. Le modèle
   choisi est aussi appliqué au CR **audio** (`/api/transcribe` accepte `template`).
   Garde-fou transversal (ADR-0006) : l'IA **met en forme** ce qui est dicté, n'ajoute aucune donnée
   clinique ni décision ; le modèle « ordonnance » interdit explicitement d'ajouter/modifier
   médicament, dose ou posologie (outil de transcription, pas de prescription).
7. **CR éditable + export/copie** : aperçu markdown ↔ édition, **Copier** et **Télécharger .md**.
8. **Historique local des CR** (`src/lib/reportHistory.ts` → `localStorage` web only) : les CR
   peuvent contenir des informations de santé → ils restent **strictement sur l'appareil**, jamais
   envoyés à un serveur MedInfo, effaçables un par un ou en bloc, avec mention explicite à l'écran.

### Registre / config (convention CLAUDE.md)
- `ecos_generate` et `report_generate` ajoutés à `AI_FEATURES` (admin), `FEATURE_DEFAULTS`
  (featureModel), `PROMPT_DEFAULTS` (promptStore) et seedés par la migration
  `0016_ecos_cr_features.sql` (UPDATE admin ⇒ lignes préexistantes obligatoires).

## Conséquences
- Données persistées **localement uniquement** (web) : aucune nouvelle table santé, aucune
  donnée patient envoyée. Cohérent avec la doctrine privacy-first et `ai_interactions`
  (contenu sensible interdit en base).
- ECOS reste un module de cas **fictifs** ; l'import ne crée pas de cas réel et ne touche pas au
  corpus partagé.
- Cloisonnement par rôle inchangé (ADR-0018) : ECOS = étudiant, Compte rendu = professionnel.

## Rollback
- Masquer les ajouts UI (favoris/progression/import sur ECOS ; source texte/modèles/historique sur
  Audio) sans toucher aux flux existants.
- Retirer les features `ecos_generate` / `report_generate` du registre + route `/api/report` +
  mode `generate` de `/api/ecos`. La migration 0016 (seed) peut rester (lignes inertes).
- Les modules `localStore`/`ecosStore`/`reportHistory`/`reportTemplates`/`ecosProgress` sont
  isolés et supprimables.
