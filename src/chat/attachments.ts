/**
 * Pièces jointes du chat (2026-07) — module PUR (constantes + validation serveur).
 *
 * Les 3 chatbots acceptent des documents (PDF) et des photos (JPEG/PNG/WebP/GIF)
 * joints au message : le client les envoie en `file parts` AI SDK (data URL), la
 * route /api/chat les fait suivre au modèle via convertToModelMessages. Le document
 * n'est JAMAIS stocké : ni archivé dans l'historique (chat_messages ne garde que le
 * texte), ni loggé — même doctrine que l'outil Analyse de document (ADR-0024).
 *
 * Ce module est la barrière serveur : types autorisés, tailles, nombre, et refus des
 * pièces jointes anonymes (l'essai invité reste un simple message texte). Les data URLs
 * base64 pèsent ~4/3 du fichier brut et le corps de requête est plafonné par
 * l'hébergeur (~4,5 Mo sur Vercel) : les plafonds ci-dessous gardent une marge, et le
 * client compresse les photos avant envoi (canvas, côté web).
 *
 * Aucune dépendance UI/réseau : testé dans tests/unit/chat-attachments.test.ts.
 */

/** Types MIME autorisés en pièce jointe du chat. */
export const ALLOWED_CHAT_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

export const CHAT_ATTACHMENT_LIMITS = {
  /** Nombre maximal de pièces jointes sur UN message. */
  maxFilesPerMessage: 4,
  /** Nombre maximal de pièces jointes cumulées dans la requête (toute la conversation). */
  maxFilesPerRequest: 8,
  /** Taille maximale d'UNE pièce jointe, en caractères de data URL (~3 Mo bruts). */
  maxFileDataUrlChars: 4_000_000,
  /**
   * Taille maximale CUMULÉE des data URLs de la requête. L'historique complet étant
   * renvoyé à chaque tour, les pièces jointes des tours précédents comptent aussi :
   * au-delà, on invite à démarrer une nouvelle conversation.
   */
  maxTotalDataUrlChars: 4_200_000,
  /** Longueur maximale conservée pour un nom de fichier. */
  maxFilenameChars: 200,
} as const;

/** Résultat de l'inspection des file parts d'une requête chat. */
export type AttachmentScan =
  | { ok: true; fileCount: number }
  | { ok: false; status: number; error: string };

interface LoosePart {
  type?: unknown;
  mediaType?: unknown;
  url?: unknown;
  filename?: unknown;
}

interface LooseMessage {
  role?: unknown;
  parts?: unknown;
}

/**
 * Valide (et normalise en place les noms trop longs) les pièces jointes des UIMessages
 * d'une requête /api/chat. Fail-closed : la moindre pièce hors cadre rejette la requête
 * avec un message clair — on ne « répare » jamais silencieusement un fichier suspect.
 */
export function scanChatAttachments(
  uiMessages: unknown[],
  opts: { allowFiles: boolean },
): AttachmentScan {
  let total = 0;
  let totalChars = 0;

  for (const raw of uiMessages) {
    const message = (raw ?? {}) as LooseMessage;
    const parts = Array.isArray(message.parts) ? (message.parts as LoosePart[]) : [];
    let inMessage = 0;

    for (const part of parts) {
      if (part?.type !== 'file') continue;

      if (!opts.allowFiles) {
        return {
          ok: false,
          status: 401,
          error: 'Créez un compte gratuit pour joindre des documents ou des photos au chat.',
        };
      }
      if (message.role !== 'user') {
        return { ok: false, status: 400, error: 'Pièce jointe inattendue hors message utilisateur.' };
      }

      const mediaType = typeof part.mediaType === 'string' ? part.mediaType.toLowerCase() : '';
      if (!ALLOWED_CHAT_ATTACHMENT_TYPES.has(mediaType)) {
        return {
          ok: false,
          status: 400,
          error: 'Format de pièce jointe non pris en charge (photos JPEG/PNG/WebP/GIF ou PDF uniquement).',
        };
      }

      const url = typeof part.url === 'string' ? part.url : '';
      // Data URL exigée : jamais d'URL distante (le serveur ne télécharge rien — anti-SSRF).
      if (!url.startsWith('data:')) {
        return { ok: false, status: 400, error: 'Pièce jointe invalide (données du fichier attendues).' };
      }
      if (url.length > CHAT_ATTACHMENT_LIMITS.maxFileDataUrlChars) {
        return {
          ok: false,
          status: 400,
          error: 'Pièce jointe trop lourde (environ 3 Mo maximum par fichier).',
        };
      }

      if (typeof part.filename === 'string' && part.filename.length > CHAT_ATTACHMENT_LIMITS.maxFilenameChars) {
        part.filename = part.filename.slice(0, CHAT_ATTACHMENT_LIMITS.maxFilenameChars);
      }

      inMessage += 1;
      total += 1;
      totalChars += url.length;

      if (inMessage > CHAT_ATTACHMENT_LIMITS.maxFilesPerMessage) {
        return {
          ok: false,
          status: 400,
          error: `Au plus ${CHAT_ATTACHMENT_LIMITS.maxFilesPerMessage} pièces jointes par message.`,
        };
      }
      if (total > CHAT_ATTACHMENT_LIMITS.maxFilesPerRequest || totalChars > CHAT_ATTACHMENT_LIMITS.maxTotalDataUrlChars) {
        return {
          ok: false,
          status: 400,
          error:
            'Trop de pièces jointes dans cette conversation — démarrez une nouvelle conversation pour joindre d\'autres fichiers.',
        };
      }
    }
  }

  return { ok: true, fileCount: total };
}

/** Taille lisible d'un fichier (« 1,2 Mo », « 640 Ko ») pour les puces du composer. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${Math.round(bytes)} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

/** Somme des caractères de data URL déjà présents dans un fil (pièces des tours passés). */
export function totalAttachmentChars(uiMessages: ReadonlyArray<{ parts?: unknown }>): number {
  let sum = 0;
  for (const message of uiMessages) {
    const parts = Array.isArray(message.parts) ? (message.parts as LoosePart[]) : [];
    for (const part of parts) {
      if (part?.type === 'file' && typeof part.url === 'string') sum += part.url.length;
    }
  }
  return sum;
}
