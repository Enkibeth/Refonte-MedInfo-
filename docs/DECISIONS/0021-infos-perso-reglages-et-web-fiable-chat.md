# ADR-0021 — Infos perso, réglages de réponse et recherche web fiable (chat)

```yaml
status: Accepted
date: 2026-06-07
owner: Hugo Bettembourg
```

## Contexte
Le chat MedInfo (personas public/student/professional) souffrait de deux frictions terrain :
1. Aucune personnalisation : impossible d'adapter le registre à l'utilisateur ; aucun réglage de
   profondeur/longueur de réponse.
2. Le corpus RAG HAS/ANSM interne est encore réduit. Le garde-fou « cite-or-refuse » strict
   refusait donc beaucoup de questions générales légitimes faute d'extrait local, rendant le chat
   peu utilisable.

## Décision
1. **Infos perso de profil** : ajout de `first_name`, `last_name`, `age`, `sex` à `profiles`
   (migration 0017, own-row RLS, hors verrou anti-élévation). Saisies par l'utilisateur, elles
   personnalisent l'INFORMATION GÉNÉRALE uniquement (registre, dépistages selon âge/sexe). Ce ne
   sont pas des données de santé ; elles n'autorisent aucun diagnostic/anamnèse/triage : le
   safe-box non-MDSW reste entier.
2. **Réglages de réponse** : curseurs utilisateur « Réflexion » (rapide→maximal) et « Détail »
   (simple→complet) envoyés par requête, surchargeant la config admin (effort de raisonnement,
   verbosité, budget de sortie). La « Rapidité » est dérivée automatiquement (moins de réflexion
   = plus rapide), affichée mais non réglable.
3. **Recherche web fiable d'abord** : le corpus interne étant réduit, le chat n'oppose plus un
   refus déterministe quand le RAG est vide. Le LLM s'appuie sur une recherche web RESTREINTE aux
   sources officielles fiables (HAS, ANSM, SPF, ameli, INCa, CRAT, BDPM, OMS, sociétés savantes,
   PubMed/Cochrane), avec citation obligatoire. Le RAG reste injecté en appui quand il matche.
   Le principe « cite-or-refuse » est conservé (citer une source fiable ou le dire).
4. **Auto-réflexion** : chaque réponse substantielle se termine par un bloc encadré
   `⟦REFLEXION⟧ … ⟦/REFLEXION⟧`, extrait et rendu dans une carte dédiée côté UI.

## Conséquences
- Positif : chat réellement utilisable malgré un corpus réduit ; personnalisation douce ;
  contrôle utilisateur sur profondeur/longueur ; transparence via l'auto-réflexion.
- Négatif / vigilance : on s'éloigne du cite-or-refuse 100 % RAG (web fiable d'abord) — la qualité
  dépend de la whitelist de sources dans le prompt et de la disponibilité de l'outil web du
  provider (modèle chat = Claude Sonnet 4.6, `webSearch` supporté). À ré-arbitrer quand le corpus
  RAG sera peuplé (revenir éventuellement à RAG-first).
- Les infos perso sont des données personnelles (RGPD) mais non sanitaires : minimisation,
  own-row RLS, suppression possible par l'utilisateur, jamais envoyées à des sources externes.

## Statut
Accepted
