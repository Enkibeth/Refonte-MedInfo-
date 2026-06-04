# ADR-0012 — Périmètre du cite-or-refuse RAG + persona dérivé du serveur

```yaml
status: Accepted
date: 2026-06-04
owner: Hugo Bettembourg
amends: ADR-0011 (durcit le gating persona côté serveur pour /api/chat)
linked_to: [ADR-0010, ADR-0011, 04_CHATBOT §6, §8, 08_RAG, 01_REGULATION §4]
```

## Contexte
L'étape 5 (RAG cite-or-refuse) et l'étape 6 (persona étudiant) présentaient trois défauts
constatés en production :

1. **Le chat refusait TOUT.** Le cite-or-refuse était appliqué à *tous* les messages : faute
   de source dans le petit corpus MVP (4 extraits), même « bonjour » ou une question méta
   recevait « Les sources disponibles ne permettent pas de répondre avec certitude. ». De plus
   la migration `0006` n'était pas appliquée sur le projet Supabase → 0 chunk → refus systématique.
2. **La recherche lexicale ne matchait quasi rien.** `match_rag_chunks` utilisait
   `plainto_tsquery` (ET sur tous les lexèmes) : une vraie question (« Quels sont les conseils
   pour le diabète de type 2 ? ») ne retrouvait aucun extrait pourtant présent.
3. **Le persona n'était pas vérifié côté serveur.** `/api/chat` lisait `persona` dans le body :
   n'importe quel client pouvait envoyer `persona:"student"` et débloquer `render_qcm` **et**
   l'assouplissement de la couche 1 (`allowFictiveEducationalCases`) — en contradiction avec
   l'invariant ADR-0011 (« le client ne fixe JAMAIS le persona »).

## Décision
1. **Cite-or-refuse ciblé** (`src/rag/grounding.ts`, `requiresMedicalGrounding`) : l'ancrage RAG
   n'est exigé que pour les **demandes d'information factuelle**. Les messages **purement
   conversationnels** (salutation, politesse, méta sur l'assistant) passent au LLM sans RAG.
   - Fail-safe : par défaut l'ancrage est requis ; seul un message dont l'intégralité correspond
     à une formule conversationnelle connue est exempté (la moindre adjonction médicale retombe
     en ancrage requis).
   - Les couches inchangées restent les garde-fous : couche 1 (classifieur) bloque toujours
     symptômes personnels / urgence ; couche 3 (validation de sortie) remplace toute sortie
     diagnostique. Un message conversationnel répond sous le seul prompt persona (public.v2 /
     student.v2), qui interdit diagnostic et conseil individualisé.
2. **Recherche lexicale en OU** (migration `0007_rag_match_or_semantics.sql`) : `match_rag_chunks`
   convertit le ET de `plainto_tsquery` en OU et classe par `ts_rank_cd`. Rappel rétabli sur les
   sujets couverts ; refus conservé hors corpus (aucun terme significatif présent → 0 extrait).
3. **Persona dérivé du serveur** (`resolvePersonaFromRequest`) : `/api/chat` n'utilise plus le
   body. L'identité vient du token d'auth, le persona est lu dans `profiles` sous la RLS de
   l'utilisateur. Sans token valide → `public`. Seul `student` (attribué par `/api/role` après
   vérification académique) élève les privilèges ; `professional` reste reporté (ADR-0006).

## Limites (étapes suivantes)
- Corpus MVP toujours réduit (4 extraits HAS/ANSM) : hors diabète T2 / obésité / AINS, le chat
  refuse légitimement. L'élargissement du corpus + l'ingestion d'embeddings réels (recherche
  dense) restent à faire (08_RAG).
- `requiresMedicalGrounding` est une allowlist conversationnelle volontairement étroite ; on
  l'élargira au besoin sans jamais relâcher le fail-safe.

## Impact réglementaire
None (maîtrisé) : aucune donnée de santé. La safe-box 3 couches reste appliquée intégralement ;
le changement n'autorise que des échanges conversationnels non médicaux à atteindre le LLM, et
durcit le contrôle du persona (réduction de surface, pas d'élévation de privilège côté client).

## Rollback
git revert du commit ; `match_rag_chunks` peut être restauré depuis `0006` et le cite-or-refuse
redevient global. Le persona repasserait au body (déconseillé : réintroduit la faille de gating).
