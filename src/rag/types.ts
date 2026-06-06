export type RagEmitter = 'HAS' | 'ANSM' | 'SPF' | 'INCa' | 'Orphanet' | 'ameli.fr' | 'CRAT' | 'BDPM';

// Licences déclarant la base de réutilisation (publique, avec attribution) de chaque
// émetteur whitelisté. Le gate `rag-license` exige que toute licence contienne la
// mention « réutilisation publique » (scripts/embeddings/validate-rag-metadata.mjs).
// Élargi au Lot B (CC-03) : SPF, INCa, ameli.fr, CRAT, Orphanet, BDPM.
export type RagLicense =
  | 'HAS réutilisation publique avec attribution'
  | 'ANSM réutilisation publique avec attribution'
  | 'Santé publique France réutilisation publique avec attribution'
  | 'INCa réutilisation publique avec attribution'
  | 'ameli.fr (Assurance Maladie) réutilisation publique avec attribution'
  | 'CRAT réutilisation publique avec attribution'
  | 'Orphanet réutilisation publique avec attribution'
  | 'BDPM (ANSM) réutilisation publique avec attribution';

export type RagChunkMetadata = {
  chunk_id: string;
  parent_doc_id: string;
  title: string;
  emitter: RagEmitter;
  section_path: string;
  source_url: string;
  publication_date: string;
  has_grade: 'A' | 'B' | 'C' | 'NA';
  edn_item_id: string | null;
  edn_rang: 'A' | 'B' | 'C' | 'NA';
  specialty: string;
  license: RagLicense;
  validation_hash: string;
};

export type RagChunk = RagChunkMetadata & {
  content: string;
};

export type RagCitation = {
  chunk_id: string;
  title: string;
  emitter: RagEmitter;
  url: string;
  section_path: string;
  excerpt: string;
};

export type RagRetrievalResult = {
  query: string;
  chunks: RagChunk[];
  citations: RagCitation[];
};
