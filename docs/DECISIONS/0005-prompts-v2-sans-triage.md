# ADR-0005 — Prompts v2 : suppression du triage, tool-calling natif

```yaml
status: Accepted
date: 2026-06-02
```

## Contexte
Les prompts v1 (public/student/pro) contenaient un recueil patient (RECUEIL MINIMUM OBLIGATOIRE), un triage symptomatique et une synthèse décisionnelle — tous déclencheurs MDSW (MDCG 2019-11 Step 4). Ils reposaient aussi sur le hack des crochets AI Engine.

## Décision
Réécriture v2 : suppression du recueil patient, du triage, du différentiel individualisé (public) et de la synthèse décisionnelle (pro). Refus déterministe sur symptômes personnels. Boutons/QCM/sources via tool-calling natif Vercel AI SDK (plus de crochets). Conservation de la rigueur de sourcing, anti-hallucination, anti-déférence, ancrage Collèges.

## Conséquences
- (+) Safe-box non-MDSW défendable. (+) UX plus riche (vrais composants React).
- (−) Perte du triage conversationnel et de la synthèse décisionnelle (c'était précisément ce qui faisait basculer en MDSW).
- 04_CHATBOT.md passe en v2.0.0, supersède v1.

## Statut
Accepted.
