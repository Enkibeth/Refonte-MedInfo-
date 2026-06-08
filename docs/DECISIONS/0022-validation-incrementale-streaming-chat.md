# ADR-0022 — Validation de sortie incrémentale (streaming progressif du chat)

```yaml
status: Proposed
date: 2026-06-08
owner: Hugo Bettembourg (arbitrage safe-box requis)
```

## Contexte

La couche 3 du safe-box (`outputValidator`, 01_REGULATION §4 / 04_CHATBOT §4) bloque toute
réponse contenant un marqueur de diagnostic individualisé et la remplace par le refus
canonique. Implémentation historique (durcissement audit B1) : la route `/api/chat`
**bufferise l'intégralité** de la réponse LLM, la valide, PUIS l'émet d'un bloc — sinon un
streaming token-par-token enverrait du texte avant validation.

Conséquence UX : la réponse apparaît d'un coup après plusieurs secondes (aucune progression
visible), perçue comme « figée ». Demande produit : restaurer un affichage progressif.

## Décision

Remplacer la bufferisation totale par une **validation incrémentale** (`src/ai/guardrails/streamGate.ts`)
qui préserve l'invariant de sûreté :

1. On accumule le texte complet `full` au fil du flux.
2. À chaque incrément, on valide le **cumul** (`validateOutput(full)`) **avant** toute émission.
3. On ne libère qu'un **préfixe déjà validé**, en gardant en réserve une marge `SAFE_MARGIN`
   (48 caractères ≥ plus long marqueur « il s'agit probablement de votre » = 31). Un marqueur
   en cours de formation reste donc non affiché tant qu'il n'est pas tranché.
4. Si le cumul est bloqué : on remplace par le refus canonique et on **coupe la suite**
   (texte restant + tool-calls `show_sources` / `propose_followups` supprimés).

**Équivalence de décision.** `validateOutput` est monotone (un marqueur présent dans le texte
final l'est dans un préfixe). Le gate bloque donc **exactement les mêmes réponses** que la
validation bufferisée — seul le *moment* du blocage change.

## Conséquences

- (+) Affichage progressif token-par-token, perçu réactif (effet « machine à écrire »).
- (+) Garantie inchangée : **aucun marqueur diagnostique complet n'est jamais affiché**
  (libération uniquement de préfixes validés + marge ≥ plus long marqueur).
- (+) Cœur pur et testable (`gateUiMessageStream`), couvert par `tests/guardrails/stream-gate.test.ts`.
- (−) **Changement de comportement assumé** : en cas de jailbreak partiel, un préfixe *validé
  (donc non diagnostique)* peut s'être affiché avant le refus, là où la version bufferisée
  n'affichait rien. Le refus reste émis ; aucune phrase diagnostique n'est montrée.
- (−) **Résiduel multi-segments** (rare, sous recherche web) : si un marqueur est délibérément
  scindé entre la fin d'une part texte (ses ≤47 derniers caractères, libérés au `text-end`) et
  une part texte suivante, le fragment partiel — incomplet, sans attribution individualisée —
  peut s'afficher avant le refus. Le marqueur **complet** n'est jamais affiché.
- Ferme : toute évolution vers un « stream puis rétractation » naïf (afficher le texte non
  validé puis le retirer), explicitement rejeté car il afficherait du contenu non validé.

## Statut

Proposed — **arbitrage Hugo requis** (modification d'un garde-fou safe-box, CLAUDE.md règle #2).
Tant que non `Accepted`, ne pas considérer la garantie comme révisée dans la doctrine
01_REGULATION §4 / 04_CHATBOT §4.
