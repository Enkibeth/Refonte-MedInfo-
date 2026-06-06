# MedInfo AI — Pipeline RAG & Qualité des Réponses

```yaml
title: RAG Pipeline & Answer Quality
version: 1.0.0
owner: Hugo Bettembourg
status: Active
date: 2026-06-02
linked_to: [02_ARCHITECTURE.md, 04_CHATBOT.md, 01_REGULATION.md]
```

> Objectif : qualité de réponse type OpenEvidence sur le terrain FRANÇAIS (HAS/ANSM/EDN) où ils sont absents. Tout est reproductible sur Supabase ; le moat d'OpenEvidence (licences NEJM/JAMA, 735 M$) n'est pas reproductible, mais leur ingénierie RAG l'est.

---

## 1. Ce qu'on copie d'OpenEvidence (et ce qu'on ne copie pas)

**Pas reproductible** : licences NEJM/JAMA/Elsevier/NCCN, trésorerie, équipe PhD, index fermé 40M papers, marque 760k MDs.
**Reproductible** : chunking section-aware, recherche hybride BM25+dense+RRF, reranking, prompting groundé avec chunk IDs, cite-or-refuse, vérification NLI post-hoc, refresh quotidien par cron.
**Notre angle** : langue française + taxonomie EDN-R2C + HAS en citation de 1er rang + gratuité étudiants + ECOS-aware. Fossé temporel estimé 12-18 mois si OpenEvidence ouvrait une offre FR.

---

## 2. Stack RAG (validé Supabase)

| Composant | Choix MVP | Coût | Fallback |
|---|---|---|---|
| Embedding | **voyage-3.5-lite** (0,02 $/M tok, 200M offerts) | ~0 € en free tier | BGE-M3 auto-hébergé Hetzner 5 €/mois |
| Vector store | **pgvector HNSW** (Supabase) | inclus | — (largement dimensionné < 500k chunks) |
| Lexical | **tsvector français** (BM25 natif Postgres) | inclus | — |
| Fusion | **RRF k=60** (CTE SQL) | inclus | — |
| Reranker | **bge-reranker-v2-m3** (open, CPU) | gratuit | Cohere Rerank 3.5 (2 $/1000) si usage |
| LLM réponse | **Claude Sonnet 4.6** | usage-based | Opus en escalade |

**À éviter en retrieval primaire** : CamemBERT-bio / DrBERT (ce sont des encodeurs NER, pas retrieval-tuned). À garder pour tâches auxiliaires (extraction entités, classification items EDN).

Pipeline : requête → retrieval hybride top-50 → rerank → top-8 dans le contexte LLM. **Rester sur Supabase 12-18 mois** ; le corpus MVP (< 500k chunks) ne justifie aucune migration.

---

## 3. Chunking médical (littérature 2025-2026)

Le chunking adaptatif aligné sur les frontières logiques atteint ~87% de précision vs ~13% pour fixed-size sur du décisionnel clinique. Recette MedInfo :
- **Recos HAS / référentiels** : section-aware (split H1/H2/H3, métadonnées de section prepended).
- **Monographies médicamenteuses (Vidal/ANSM)** : chunks entiers 800-1200 tokens. **NE JAMAIS fragmenter une posologie ou un tableau d'interactions** (danger).
- **Narratif libre** : recursive 512 tokens / 64 overlap.
- **Tables** : converties en Markdown + verbalisation prose dans le même chunk.

Métadonnées obligatoires par chunk : `chunk_id`, `parent_doc_id`, `section_path`, `source_url`, `publication_date`, `has_grade` (A/B/C), `edn_item_id`, `edn_rang`, `specialty`, `license`, `validation_hash`. Le gate CI `rag-license` refuse tout chunk sans `source` + `license` + `validation_hash`.

---

## 4. Citation grounding (5 techniques cumulables)

1. **Inline chunk IDs** via `generateObject` (Vercel AI SDK) + schéma Zod `{answer, citations:[{chunk_id, snippet}]}`.
2. **Cite-or-refuse** strict : « si le contexte ne contient pas la réponse, répondre exactement : Les sources disponibles ne permettent pas de répondre avec certitude. »
3. **Vérification NLI post-hoc** : entailment de chaque phrase vs chunk cité (`mDeBERTa-v3-base-mnli-xnli`, gratuit, FR). Sous seuil → phrase strippée/flaggée.
4. **CRAG/Self-RAG** léger : évaluateur Correct/Ambiguous/Incorrect déclenchant refus.
5. **Footnotes cliquables** vers PDF HAS / fiche RCP ANSM.

C'est ce qui empêche les références hallucinées — point critique pour un produit médical.

---

## 5. Pipeline du pipeline RAG existant (porté de WordPress)

Le pipeline Python (PyMuPDF + Tesseract OCR pour PDF CID-encodés des Collèges) est **inchangé jusqu'à l'étape chunks**. Seule la destination bascule : AI Engine Embeddings → INSERT Supabase pgvector. Offset PDF→page calculé empiriquement par document. Citations : item EDN exact + page réelle + URL SIDES canonique + Rang A/B/C embarqué dans chaque chunk.

---

## 6. Corpus & légalité (zone grise EDN)

| Source | Statut | Usage |
|---|---|---|
| 367 items EDN + objectifs rang A/B | Programme officiel (arrêté) | **Taxonomie de navigation** — OK |
| Recos HAS | Réutilisables avec attribution (à confirmer doc par doc) | **Ingestion OK** |
| ANSM / SPF / INCa / Orphanet | Publiques | **Ingestion OK** |
| Fiches LiSA (UNESS) | Zone grise commerciale | **Lier, pas copier** verbatim ; contacter UNESS |
| Référentiels Collèges (Elsevier-Masson, Med-Line, S-Éditions) | **Strictement copyrightés** | **NE PAS ingérer**, même paraphrasés |

Base TDM : exception Art. 4 Directive DSM 2019/790 (transposée L122-5-3 CPI) autorise ingestion/embedding/scoring de contenus d'accès licite, sauf opt-out — mais **pas la communication au public** du texte. Recette sûre : item EDN = taxonomie, peuplée de HAS+ANSM+Orphanet+INCa+PMC FR. **Avis juriste IP/santé recommandé avant lancement commercial (~500-1500 €).**

---

## 7. Features différenciantes (exploitent l'angle FR/EDN)

Réviser l'item X (synthèse grounded + QCM) ; Cas clinique fictif → items EDN inférés ; Simulateur ECOS (agent joue le patient standardisé) ; HAS-watch (push nouvelles recos sur items « faibles ») ; mode réponse rapide stage (algorithme HAS + posologie RCP, cite-or-refuse) ; mode vulgarisation patient. Toutes restent hors-MDSW (génériques/pédagogiques).

---

## 8. Coûts RAG

Ingestion corpus initial (50-100M tokens) : ~0 € (free tier voyage) à < 20 €. Supabase Pro 25 $/mois (> 500k chunks ou backups). Claude Sonnet : usage-based ~50-200 €/mois selon trafic. Reranker auto-hébergé : ~0-10 €/mois. Dans l'enveloppe.

---

## 9. À benchmarker avant de figer (incertitudes)

- voyage-3.5-lite **vs** BGE-M3 sur 200 questions médicales FR (recall@3). **Décision intérimaire
  (ADR-0014)** : démarrage sur OpenAI `text-embedding-3-small` (1536, déjà câblé, aucun `ALTER`) ; ce
  benchmark — et l'alternative souveraine Mistral — tranche le modèle définitif sur corpus de masse.
- Flash-Lite **vs** Haiku 4.5 pour le classifieur (cf 07_CLASSIFIER). **Tranché (ADR-0013)** : Haiku 4.5
  câblé ; Flash-Lite reste activable via `CLASSIFIER_MODEL_ID`.
Décisions à valider empiriquement en semaine 3-4, pas sur la foi de ce doc.

---

## 12. Implémentation MVP étape 5 (2026-06-04)

Livré côté repo :

- Schéma Supabase `rag_sources` / `rag_chunks` avec pgvector, index HNSW, index lexical français et RPC `match_rag_chunks` (`supabase/migrations/0006_rag_pgvector.sql`).
- Petit corpus officiel HAS/ANSM versionné dans `src/rag/corpus/`, volontairement réduit pour valider la chaîne : HAS diabète type 2, HAS surpoids/obésité adulte, ANSM bon usage AINS.
- Gate `rag-license` réel via `npm run validate:rag` : source HTTPS, licence, date, hash, section et contenu obligatoires.
- Intégration `/api/chat` : après le classifieur couche 1, retrieval RAG pour les questions `general_info`; sans source validée, refus documentaire déterministe avant tout appel LLM.

Limites : le **pipeline d'embeddings réels** est livré (CC-03, §13, ADR-0014) et le **corpus est élargi**
(Lot B, 32 chunks réellement sourcés, §13). L'allowlist réseau est désormais ouverte, mais le
**peuplement des vecteurs** reste en attente de la confirmation OpenAI EU residency + ZDR + DPA (Hugo,
01_REGULATION §5). Le benchmark du modèle définitif (`voyage-3.5-lite` vs BGE-M3, alternative Mistral)
reste prévu sur corpus de masse. Le fallback local lexical est désactivé par défaut en production, sert
uniquement au dev/test et ne remplace pas l'ingestion large.

---

## 13. CC-03 — Pipeline d'embeddings réels (2026-06-05)

Objectif (risque **R1** de l'audit Council) : passer du retrieval **lexical-only** à la **fusion
lexical+dense** déjà portée par `match_rag_chunks` (RRF k=60), en peuplant de **vrais** vecteurs.

**Décision d'architecture** : OpenAI `text-embedding-3-small` (1536 dims) — voir **ADR-0014** (coût, EU
Data Residency + Zero Data Retention 01_REGULATION §5, alternative souveraine Mistral reportée, taille
de chunk retenue = recette §3).

**Livré (Lot A + Lot C)** :
- `src/rag/embeddings.ts` — `embedText` / `embedMany` via `@ai-sdk/openai`. **ZÉRO pseudo-embedding** :
  clé absente → `throw` à l'ingestion ; échec à la requête → **dégradation lexical-only** (jamais de
  vecteur factice). Garde de dimension stricte (1536).
- `src/rag/retrieval.ts` — génère l'embedding de la requête et le passe à `match_rag_chunks` (active le
  dense). INV-B (`buildRagSystemSection` + `sanitizeSourceContent`, marqueurs ⟦SOURCE_DATA⟧) **inchangé**.
- `scripts/embeddings/ingest-corpus.mjs` (`npm run rag:ingest`) — lit `src/rag/corpus/*.json`, embed,
  upsert `rag_sources`/`rag_chunks` AVEC `embedding` (service-role, idempotent `chunk_id`+hash,
  `--dry-run` hors réseau). Le gate `validate:rag` couvre désormais **tous** les `corpus/*.json`.
- `scripts/eval/rag-recall.mjs` (`npm run rag:recall`) + `tests/rag/recall-questions.fr.json` —
  recall@1/@3 (chunk & doc) + coût d'embedding réel en mode `fused`.

**Mesure** : baseline **lexical** live (10 questions in-corpus) = recall@1/@3 **100 %** — non informatif
sur 4 chunks (le lexical sature ; le gain du dense se mesure sur corpus élargi). Hors corpus → 0 source
→ cite-or-refuse. Le **dense** sera mesuré après peuplement.

**Lot B — corpus élargi (2026-06-06)** : l'allowlist réseau est désormais **ouverte**. Le corpus est
porté à **32 chunks réellement sourcés** (28 nouveaux, **8 émetteurs** : HAS, ANSM, SPF, INCa, ameli.fr,
CRAT, Orphanet, BDPM) dans `src/rag/corpus/lot-b-*.json` — résumés fidèles attribués (zéro contenu
inventé, pas de verbatim intégral — exception TDM §6), métadonnées + `validation_hash = sha256(content)`
+ licence « réutilisation publique », chunking §3 respecté (recos = sections ; monographies = chunk
entier, posologie non fragmentée). `RagLicense` et `recall-questions.fr.json` étendus.

**Toujours en attente (confirmation OpenAI — Hugo)** : les **embeddings restent non peuplés** et le
**recall dense n'est pas encore mesuré**. Sur décision Hugo (2026-06-06), **aucun appel OpenAI** n'est
effectué tant que la résidence EU + ZDR + DPA/SCC Module 2 du projet OpenAI n'est pas confirmée
(01_REGULATION §5). Une fois confirmé : `npm run rag:ingest` puis `npm run rag:recall -- --mode=fused`.
