# [TITRE PRUDENT] — gabarit d'article public

> Référence : `docs/10_BENCHMARK.md §13`. **Aucun claim de supériorité clinique.** Exemples montrés = questions génériques uniquement. Relecture juridique des claims obligatoire avant publication.

## Titre (choisir, sans claim excessif)
1. MedInfo AI vs modèles généralistes : sourçage, prudence et refus — résultats et méthode ouverte
2. Information médicale française : comment MedInfo cite ses sources (sur notre échantillon)
3. Benchmark transparent : qualité du sourçage et sécurité du refus de MedInfo AI
4. Ce que nous avons mesuré (et pas mesuré) en comparant MedInfo à des IA généralistes
5. Refus, sources, pédagogie : un benchmark reproductible de MedInfo AI

## Encadré intended purpose (obligatoire, en tête)
> Ce benchmark évalue la qualité informationnelle, pédagogique, le sourçage et le comportement de sécurité (refus) de MedInfo AI comparé à des modèles généralistes, sur un échantillon publié. Il n'évalue pas, et ne doit pas être interprété comme évaluant, une performance diagnostique, pronostique ou thérapeutique. MedInfo AI est une plateforme d'information éducative non destinée à être un dispositif médical (règlement UE 2017/745).

## 1. Résumé exécutif
- Ce qu'on a mesuré / ce qu'on n'a PAS mesuré.
- 2-3 résultats bornés (« sur cet échantillon, … »).

## 2. Méthodologie (transparence)
- Golden set publié (lien) + barème + prompts.
- **Versions exactes** des modèles, datées.
- Double évaluation aveugle + κ ; IC 95%.

## 3. Résultats
- Graphes par dimension **avec barres d'erreur**.
- Leaderboards **par usage** (pas de score global isolé).

## 4. Exemples comparés (questions GÉNÉRIQUES uniquement)
- Ex. « Que recommande la HAS pour le dépistage du cancer colorectal ? » → réponses côte à côte + sources.
- ⚠️ Ne jamais montrer de question individualisée.

## 5. Ce que MedInfo fait mieux (mesuré)
- Sourçage officiel FR, fidélité aux recos, refus déterministe (SHR, recall refus).

## 6. Ce que MedInfo ne fait PAS
- Pas de diagnostic, pas de triage, pas de conseil individualisé, **pas de preuve de supériorité clinique**.

## 7. Limites
- Échantillon, instant T, conflit d'intérêt déclaré, fuite dataset possible, juge LLM faillible, avantage structurel RAG/safe-box déclaré.

## 8. Prochaines étapes
- Élargir le set, audit externe, ré-exécution à chaque nouvelle version.

---
### Marketing — autorisé / interdit (rappel)
- ✅ « mieux sourcé sur cet échantillon », « refuse correctement les demandes individualisées », « méthode et données ouvertes ».
- ❌ « plus sûr/fiable cliniquement », « diagnostique mieux », « supérieur aux médecins/à ChatGPT en médecine », chiffre présenté comme garantie, comparaison non datée.
