import { describe, it, expect } from 'vitest';
import {
  scanChatAttachments,
  formatFileSize,
  totalAttachmentChars,
  CHAT_ATTACHMENT_LIMITS,
} from '@/chat/attachments';

function filePart(overrides: Record<string, unknown> = {}) {
  return {
    type: 'file',
    mediaType: 'image/jpeg',
    filename: 'photo.jpg',
    url: `data:image/jpeg;base64,${'a'.repeat(1000)}`,
    ...overrides,
  };
}

function userMessage(parts: unknown[]) {
  return { role: 'user', parts };
}

describe('scanChatAttachments', () => {
  it('accepte un message sans pièce jointe', () => {
    const scan = scanChatAttachments(
      [userMessage([{ type: 'text', text: 'Bonjour' }])],
      { allowFiles: true },
    );
    expect(scan).toEqual({ ok: true, fileCount: 0 });
  });

  it('accepte photos et PDF dans les limites', () => {
    const scan = scanChatAttachments(
      [
        userMessage([
          { type: 'text', text: 'Voici mes documents' },
          filePart(),
          filePart({ mediaType: 'application/pdf', filename: 'bilan.pdf' }),
        ]),
      ],
      { allowFiles: true },
    );
    expect(scan).toEqual({ ok: true, fileCount: 2 });
  });

  it('refuse toute pièce jointe anonyme (essai invité) en 401', () => {
    const scan = scanChatAttachments([userMessage([filePart()])], { allowFiles: false });
    expect(scan.ok).toBe(false);
    if (!scan.ok) expect(scan.status).toBe(401);
  });

  it('refuse un type MIME hors liste blanche', () => {
    const scan = scanChatAttachments(
      [userMessage([filePart({ mediaType: 'application/zip' })])],
      { allowFiles: true },
    );
    expect(scan.ok).toBe(false);
    if (!scan.ok) expect(scan.status).toBe(400);
  });

  it('refuse une URL distante (anti-SSRF : data URL exigée)', () => {
    const scan = scanChatAttachments(
      [userMessage([filePart({ url: 'https://example.com/photo.jpg' })])],
      { allowFiles: true },
    );
    expect(scan.ok).toBe(false);
  });

  it('refuse un fichier au-delà du plafond unitaire', () => {
    const scan = scanChatAttachments(
      [userMessage([filePart({ url: `data:application/pdf;base64,${'a'.repeat(CHAT_ATTACHMENT_LIMITS.maxFileDataUrlChars + 1)}` })])],
      { allowFiles: true },
    );
    expect(scan.ok).toBe(false);
    if (!scan.ok) expect(scan.error).toContain('trop lourde');
  });

  it('refuse plus de 4 pièces sur un même message', () => {
    const scan = scanChatAttachments(
      [userMessage([filePart(), filePart(), filePart(), filePart(), filePart()])],
      { allowFiles: true },
    );
    expect(scan.ok).toBe(false);
    if (!scan.ok) expect(scan.error).toContain('4');
  });

  it('refuse le cumul au-delà du plafond de la requête (pièces des tours passés comprises)', () => {
    const bigUrl = `data:application/pdf;base64,${'a'.repeat(2_200_000)}`;
    const scan = scanChatAttachments(
      [
        userMessage([filePart({ url: bigUrl })]),
        { role: 'assistant', parts: [{ type: 'text', text: 'Réponse' }] },
        userMessage([filePart({ url: bigUrl })]),
      ],
      { allowFiles: true },
    );
    expect(scan.ok).toBe(false);
    if (!scan.ok) expect(scan.error).toContain('nouvelle conversation');
  });

  it('refuse une pièce jointe portée par un message assistant', () => {
    const scan = scanChatAttachments(
      [{ role: 'assistant', parts: [filePart()] }],
      { allowFiles: true },
    );
    expect(scan.ok).toBe(false);
  });

  it('tronque les noms de fichiers trop longs (normalisation en place)', () => {
    const part = filePart({ filename: 'x'.repeat(500) });
    const scan = scanChatAttachments([userMessage([part])], { allowFiles: true });
    expect(scan.ok).toBe(true);
    expect((part.filename as string).length).toBe(CHAT_ATTACHMENT_LIMITS.maxFilenameChars);
  });
});

describe('formatFileSize', () => {
  it('formate octets, Ko et Mo', () => {
    expect(formatFileSize(512)).toBe('512 o');
    expect(formatFileSize(2048)).toBe('2 Ko');
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1,5 Mo');
  });
  it('reste vide sur une valeur invalide', () => {
    expect(formatFileSize(Number.NaN)).toBe('');
    expect(formatFileSize(-1)).toBe('');
  });
});

describe('totalAttachmentChars', () => {
  it('additionne les data URLs des file parts du fil', () => {
    const messages = [
      userMessage([filePart({ url: 'data:image/jpeg;base64,aaaa' })]),
      { role: 'assistant', parts: [{ type: 'text', text: 'ok' }] },
      userMessage([{ type: 'text', text: 'suite' }]),
    ];
    expect(totalAttachmentChars(messages)).toBe('data:image/jpeg;base64,aaaa'.length);
  });
});
