# ADR-0004 — Domaine : repointer les DNS plutôt que transférer

```yaml
status: Accepted
date: 2026-06-02
```

## Contexte
medinfo-ai.com est enregistré chez Hostinger et pointe vers l'ancien WordPress. La refonte (ADR-0002) déploie sur Vercel. Deux options : (A) transférer la propriété du domaine vers un autre registrar, (B) garder Hostinger comme registrar et repointer les DNS vers Vercel.

## Décision
Option B. Le domaine reste chez Hostinger (~12 €/an). On change uniquement les enregistrements DNS (A/CNAME) pour pointer vers Vercel, le jour de la mise en prod. Pas de transfert.

## Conséquences
- (+) Coût 0 €, sans délai, réversible en 2 min. Aucune fenêtre de risque ICANN (verrou 60 j, code EPP).
- (+) Le site WordPress peut rester en ligne jusqu'au jour J.
- (−) Le domaine reste géré depuis l'interface Hostinger (DNS moins ergonomique que Cloudflare).
- Reporté : un transfert complet vers Cloudflare/OVH reste possible plus tard (regroupement registrar), non bloquant.
- ⚠️ Préserver les MX si emails sur le domaine (cf 02_ARCHITECTURE §10.3).

## Statut
Accepted. Procédure détaillée : docs/02_ARCHITECTURE.md §10.
