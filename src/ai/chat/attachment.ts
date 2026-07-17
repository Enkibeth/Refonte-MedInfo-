/**
 * Pièce jointe (document) dans la conversation — chat étudiant / professionnel (2026-07).
 *
 * Réservé aux comptes vérifiés étudiant/pro (garde serveur + masquage UI). Le
 * document est transmis TEL QUEL au modèle multimodal (comme /api/analyze : PDF /
 * image lus nativement, fichier texte inliné) puis OUBLIÉ — jamais stocké (seule
 * la réponse est archivée dans l'historique). Envoyé en base64 dans le body JSON
 * de /api/chat.
 *
 * ⚠️ Module PUR (server-safe), sans dépendance réseau ni React.
 */

const PDF_TYPE = 'application/pdf';
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const TEXT_TYPES = new Set(['text/plain', 'text/markdown', 'text/csv']);

/** Taille max du fichier (6 Mo → ~8 Mo en base64 dans le body JSON). */
export const ATTACHMENT_MAX_BYTES = 6 * 1024 * 1024;
/** Longueur max du texte inliné pour un fichier texte. */
export const ATTACHMENT_MAX_TEXT_CHARS = 100_000;
/** Types MIME acceptés (client + serveur). */
export const ATTACHMENT_ACCEPTED_TYPES = [PDF_TYPE, ...IMAGE_TYPES, ...TEXT_TYPES];
/** Attribut `accept` de l'input fichier (web). */
export const ATTACHMENT_ACCEPT = '.pdf,.txt,.md,.csv,image/png,image/jpeg,image/webp,application/pdf,text/plain';

export interface ChatAttachment {
  /** Nom de fichier (borné, sans retour ligne). */
  name: string;
  /** Type MIME normalisé. */
  mediaType: string;
  /** Contenu en base64 (SANS le préfixe `data:...;base64,`). */
  dataBase64: string;
}

export type AttachmentModelPart =
  | { type: 'text'; text: string }
  | { type: 'file'; data: Uint8Array; mediaType: string }
  | { type: 'image'; image: Uint8Array; mediaType: string };

export function isPdfAttachment(a: ChatAttachment): boolean {
  return a.mediaType === PDF_TYPE;
}
export function isImageAttachment(a: ChatAttachment): boolean {
  return IMAGE_TYPES.has(a.mediaType);
}
export function isTextAttachment(a: ChatAttachment): boolean {
  return TEXT_TYPES.has(a.mediaType);
}

/** Valide/borne une pièce jointe reçue du client (anti-abus). Null si invalide. */
export function coerceChatAttachment(raw: unknown): ChatAttachment | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  const mediaType =
    typeof o.mediaType === 'string' ? o.mediaType.toLowerCase().split(';')[0].trim() : '';
  if (!(mediaType === PDF_TYPE || IMAGE_TYPES.has(mediaType) || TEXT_TYPES.has(mediaType))) {
    return null;
  }

  const dataBase64 = typeof o.dataBase64 === 'string' ? o.dataBase64.trim() : '';
  if (dataBase64.length === 0) return null;
  // Borne de taille : longueur base64 ≈ 4/3 des octets (+ marge de padding).
  const maxBase64 = Math.ceil((ATTACHMENT_MAX_BYTES * 4) / 3) + 16;
  if (dataBase64.length > maxBase64) return null;
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(dataBase64)) return null;

  const name =
    typeof o.name === 'string' ? o.name.replace(/[\r\n\t]/g, ' ').trim().slice(0, 200) : '';
  return { name: name || 'Document', mediaType, dataBase64 };
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '');
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(clean, 'base64'));
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Convertit la pièce jointe en parts de message MODÈLE (multimodal) :
 * - PDF  → part `file` (lu nativement par le modèle) ;
 * - image → part `image` ;
 * - texte → inliné dans une part `text` (borné).
 * Toujours précédé d'une part `text` annonçant le document joint.
 */
export function attachmentToModelParts(a: ChatAttachment): AttachmentModelPart[] {
  const header = `\n\n[Document joint par l'utilisateur : ${a.name}]`;
  if (isTextAttachment(a)) {
    let text = '';
    try {
      text = new TextDecoder().decode(base64ToBytes(a.dataBase64));
    } catch {
      text = '';
    }
    return [{ type: 'text', text: `${header}\n${text.slice(0, ATTACHMENT_MAX_TEXT_CHARS)}` }];
  }
  const bytes = base64ToBytes(a.dataBase64);
  if (isImageAttachment(a)) {
    return [
      { type: 'text', text: header },
      { type: 'image', image: bytes, mediaType: a.mediaType },
    ];
  }
  // PDF
  return [
    { type: 'text', text: header },
    { type: 'file', data: bytes, mediaType: PDF_TYPE },
  ];
}

interface MinimalModelMessage {
  role: string;
  content: unknown;
}

/**
 * Ajoute la pièce jointe au DERNIER message utilisateur des messages modèle
 * (après convertToModelMessages). Mute `messages` en place. Sans effet si aucun
 * message utilisateur.
 */
export function appendAttachmentToModelMessages(
  messages: MinimalModelMessage[],
  a: ChatAttachment,
): void {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'user') continue;
    const parts = attachmentToModelParts(a);
    const content = messages[i].content;
    if (typeof content === 'string') {
      messages[i].content = [{ type: 'text', text: content }, ...parts];
    } else if (Array.isArray(content)) {
      messages[i].content = [...content, ...parts];
    } else {
      messages[i].content = parts;
    }
    return;
  }
}
