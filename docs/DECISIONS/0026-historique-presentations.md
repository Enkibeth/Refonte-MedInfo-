# ADR-0026 — Historique cloud des présentations (générateur)

```yaml
status: Accepted
date: 2026-06-13
owner: Hugo Bettembourg
linked_to: [ADR-0018, ADR-0019, 0020_chat_history.sql, 0026_presentation_decks.sql]
```

## Contexte
Le générateur de présentations (ADR-0018/0019, étudiants + professionnels) construisait
le deck **en mémoire** dans la page autonome (`public/presentation.html`, iframe). Tout
était perdu si l'utilisateur changeait d'onglet, rechargeait, ou fermait la page **avant
d'exporter le PPTX** — particulièrement gênant pour un éditeur où l'on construit
progressivement (mode manuel) ou tour par tour (mode IA). Décision Hugo : ajouter une
**sauvegarde cloud par compte**, comme l'historique du chat (ADR-0024 / migration 0020),
plutôt qu'un simple brouillon local navigateur.

## Décision
1. **Table `presentation_decks`** (migration `0026`, RLS **own-row stricte**) : une ligne
   par présentation enregistrée — `title`, `theme`, `deck` (JSON pivot), `ai_history`
   (échanges de co-construction IA, pour reprendre la conversation), `created_at`,
   `updated_at`. CRUD par le SEUL propriétaire (4 policies `auth.uid() = user_id`),
   GRANT `authenticated`. Test `tests/rls/presentation-decks.test.ts`.
2. **Route CRUD `/api/presentations`** (≠ `/api/presentation` qui génère via LLM) :
   GET liste, GET `?id=`, POST upsert, DELETE. Client Supabase **scopé au token**
   (Authorization Bearer) → la RLS own-row est la barrière réelle (jamais le `service_role`,
   jamais le body pour l'autorisation). Validation/bornage pur et testé :
   `src/presentation/decks.ts` (`tests/unit/presentation-decks.test.ts`).
3. **Autosave côté page autonome** : le deck (+ historique IA) est enregistré
   automatiquement (debounce ~1,2 s après modification, tick de secours 4 s, et au
   `pagehide`/`visibilitychange` via `fetch keepalive`). Indicateur d'état
   (Enregistrement… / Enregistré ✓ / Hors connexion). Panneau **« Mes présentations »**
   (liste, ouvrir, supprimer) + bouton **« Nouveau »**. Le token de session est transmis
   à l'iframe par `postMessage` (déjà en place pour le mode IA).

## Conséquences
- Plus de perte de travail : la présentation est conservée sur le compte, multi-appareils.
- `deck`/`ai_history` = information médicale **générale** (un support, jamais un dossier
  patient) ; protégés own-row comme l'historique du chat. Aucune donnée de santé
  identifiable de tiers.
- Un deck vierge n'est pas enregistré tant qu'il n'est pas édité (pas de lignes vides).
- La purge/quotas éventuels (nombre max de présentations par compte) restent à décider si
  le volume le justifie ; non bloquant pour l'ébauche.

## Rollback
Retirer le panneau « Mes présentations » + l'autosave de `public/presentation.html`
(l'outil retombe sur l'édition en mémoire), désactiver la route `/api/presentations`.
La table `presentation_decks` peut rester (inerte) ou être supprimée par une migration
descendante. Aucune autre feature n'en dépend.
