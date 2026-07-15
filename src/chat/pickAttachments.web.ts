/**
 * Sélection de pièces jointes du chat — implémentation WEB (résolue par Metro).
 *
 * Ouvre un sélecteur de fichiers natif du navigateur (photos JPEG/PNG/WebP/GIF + PDF),
 * puis prépare chaque fichier en data URL pour l'envoi en file part AI SDK :
 *  - les PHOTOS lourdes sont RECOMPRESSÉES côté client (canvas : côté max 1600 px,
 *    JPEG qualité 0,85) — une photo de téléphone de 6 Mo devient ~300-800 Ko, sous
 *    les plafonds serveur (src/chat/attachments.ts) et la limite de corps de requête ;
 *  - les PDF ne sont pas compressibles : refusés au-delà de ~3 Mo, avec un message clair ;
 *  - les GIF (souvent animés) ne passent pas par le canvas (l'animation serait perdue).
 *
 * Aucune donnée n'est envoyée ici : tout reste local jusqu'à l'envoi du message.
 */
import type { PickedAttachment, PickResult } from './pickAttachments';

export type { PickedAttachment, PickResult } from './pickAttachments';

export const CHAT_ATTACHMENTS_SUPPORTED =
  typeof document !== 'undefined' && typeof FileReader !== 'undefined';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';

/** Plafonds côté client (le serveur garde les siens — src/chat/attachments.ts). */
const MAX_PDF_BYTES = 3 * 1024 * 1024; // non compressible
const MAX_GIF_BYTES = 2 * 1024 * 1024; // non recompressé (animation)
const MAX_IMAGE_INPUT_BYTES = 20 * 1024 * 1024; // au-delà, même la compression n'y suffira pas
const MAX_IMAGE_OUTPUT_BYTES = 2.5 * 1024 * 1024; // après compression
const MAX_IMAGE_SIDE = 1600; // px
const COMPRESS_THRESHOLD_BYTES = 1.2 * 1024 * 1024; // en dessous : envoi tel quel

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(blob);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('image_decode_failed'));
    img.onload = () => resolve(img);
    img.src = dataUrl;
  });
}

/** Octets approximatifs encodés dans une data URL base64. */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const payload = comma >= 0 ? dataUrl.length - comma - 1 : dataUrl.length;
  return Math.floor(payload * 0.75);
}

/**
 * Recompresse une photo au canvas si elle est lourde ou très grande.
 * Retourne la data URL retenue (originale si déjà raisonnable, sinon JPEG compressé).
 */
async function prepareImage(file: File): Promise<string> {
  const original = await readAsDataUrl(file);
  if (file.size <= COMPRESS_THRESHOLD_BYTES) {
    const img = await loadImage(original);
    if (Math.max(img.naturalWidth, img.naturalHeight) <= MAX_IMAGE_SIDE) return original;
    // Petite en octets mais très grande en pixels : on réduit quand même (tokens vision).
    return drawToJpeg(img);
  }
  const img = await loadImage(original);
  return drawToJpeg(img);
}

function drawToJpeg(img: HTMLImageElement): string {
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');
  // Fond blanc : les PNG transparents deviennent lisibles une fois aplatis en JPEG.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

async function prepareFile(file: File): Promise<{ ok: true; att: PickedAttachment } | { ok: false; error: string }> {
  const name = file.name || 'fichier';
  const type = (file.type || '').toLowerCase();

  if (type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) {
      return { ok: false, error: `« ${name} » : PDF trop lourd (3 Mo maximum).` };
    }
    const dataUrl = await readAsDataUrl(file);
    return { ok: true, att: { filename: name, mediaType: type, dataUrl, bytes: file.size } };
  }

  if (type === 'image/gif') {
    if (file.size > MAX_GIF_BYTES) {
      return { ok: false, error: `« ${name} » : GIF trop lourd (2 Mo maximum).` };
    }
    const dataUrl = await readAsDataUrl(file);
    return { ok: true, att: { filename: name, mediaType: type, dataUrl, bytes: file.size } };
  }

  if (type === 'image/jpeg' || type === 'image/png' || type === 'image/webp') {
    if (file.size > MAX_IMAGE_INPUT_BYTES) {
      return { ok: false, error: `« ${name} » : photo trop lourde (20 Mo maximum).` };
    }
    try {
      const dataUrl = await prepareImage(file);
      const bytes = dataUrlBytes(dataUrl);
      if (bytes > MAX_IMAGE_OUTPUT_BYTES) {
        return { ok: false, error: `« ${name} » : photo trop lourde même compressée.` };
      }
      const mediaType = dataUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : type;
      return { ok: true, att: { filename: name, mediaType, dataUrl, bytes } };
    } catch {
      return { ok: false, error: `« ${name} » : image illisible.` };
    }
  }

  return { ok: false, error: `« ${name} » : format non pris en charge (photos ou PDF).` };
}

/**
 * Ouvre le sélecteur de fichiers et prépare les fichiers choisis.
 * Résout `{ files: [], errors: [] }` si l'utilisateur annule.
 */
export function pickChatAttachments(): Promise<PickResult> {
  if (!CHAT_ATTACHMENTS_SUPPORTED) return Promise.resolve({ files: [], errors: [] });

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT;
    input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const finish = async (fileList: FileList | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      const files: PickedAttachment[] = [];
      const errors: string[] = [];
      for (const file of Array.from(fileList ?? [])) {
        const prepared = await prepareFile(file);
        if (prepared.ok) files.push(prepared.att);
        else errors.push(prepared.error);
      }
      resolve({ files, errors });
    };

    input.addEventListener('change', () => void finish(input.files));
    // Annulation sans sélection (supporté par les navigateurs récents).
    input.addEventListener('cancel', () => void finish(null));
    input.click();
  });
}
