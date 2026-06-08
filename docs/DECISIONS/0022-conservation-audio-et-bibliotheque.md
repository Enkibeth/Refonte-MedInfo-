# ADR-0022 — Conservation audio, bibliothèque de comptes rendus & export PDF

```yaml
status: Accepted
date: 2026-06-08
owner: Hugo Bettembourg
```

## Contexte
Les fonctions audio (transcription, compte rendu) étaient éphémères : le résultat
disparaissait au rechargement et l'audio n'était jamais conservé. Besoin terrain :
réécouter l'audio peu après la consultation, retrouver/organiser/supprimer les comptes
rendus, et les exporter. Contrainte : l'audio brut de consultation est sensible et ne doit
pas être conservé longtemps.

## Décision
1. **Table `audio_documents`** (migration 0019, RLS own-row stricte) : conserve
   INDÉFINIMENT le texte (transcription + compte rendu), classable par `folder`, renommable,
   supprimable par le seul propriétaire.
2. **Audio source conservé ≤ 24h** : stocké dans un bucket Supabase privé
   `consultation-audio` (RLS : chaque user n'accède qu'à `{user_id}/...`), réécoutable via URL
   signée. Purge automatique horaire par `pg_cron`
   (`supabase/setup/audio_storage_and_purge.sql`, hors harness CI). Au-delà de 24h, `audio_path`
   est détaché ; le texte reste.
3. **Export PDF** côté navigateur (fenêtre d'impression, sans dépendance) avec mini
   markdown→HTML pour un rendu sobre.
4. **Nettoyage des comptes rendus** : `sanitizeMedicalReport()` retire emojis/symboles
   décoratifs et normalise le markdown ; le prompt `audio_report` interdit désormais les emojis.

## Conséquences
- Positif : continuité d'usage, organisation, conformité « minimisation » sur l'audio
  (rétention courte) tout en gardant le livrable texte.
- Vigilance : la purge dépend de `pg_cron` côté Supabase (setup hors migrations). La
  suppression d'un fichier passe par `storage.objects` ; vérifier périodiquement l'absence
  d'orphelins. Fonctionnalité réservée au rôle professionnel (gel clinique ADR-0006 inchangé :
  ce sont des comptes rendus rédigés par le pro, pas une décision clinique de l'IA).

## Statut
Accepted
