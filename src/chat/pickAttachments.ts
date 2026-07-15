/**
 * Sélection de pièces jointes du chat — implémentation NATIVE (repli inerte).
 *
 * L'app est web-first : le vrai sélecteur (input fichier + compression canvas des
 * photos) vit dans pickAttachments.web.ts, résolu automatiquement par Metro sur
 * l'export web. Sur natif, la fonctionnalité est simplement absente (le bouton
 * trombone ne s'affiche pas : CHAT_ATTACHMENTS_SUPPORTED = false).
 */

export interface PickedAttachment {
  filename: string;
  mediaType: string;
  /** Data URL (base64) prête à partir en file part AI SDK. */
  dataUrl: string;
  /** Taille indicative en octets (après compression éventuelle). */
  bytes: number;
}

export interface PickResult {
  files: PickedAttachment[];
  /** Messages d'erreur par fichier refusé (trop lourd, format non pris en charge…). */
  errors: string[];
}

export const CHAT_ATTACHMENTS_SUPPORTED = false;

export async function pickChatAttachments(): Promise<PickResult> {
  return { files: [], errors: [] };
}
