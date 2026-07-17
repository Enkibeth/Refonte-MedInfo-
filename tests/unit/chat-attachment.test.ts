import { describe, it, expect } from 'vitest';

import {
  ATTACHMENT_MAX_BYTES,
  appendAttachmentToModelMessages,
  attachmentToModelParts,
  coerceChatAttachment,
  type ChatAttachment,
} from '@/ai/chat/attachment';

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

describe('attachment — coercion', () => {
  it('accepte PDF, image et texte', () => {
    expect(coerceChatAttachment({ name: 'cr.pdf', mediaType: 'application/pdf', dataBase64: b64('x') })).not.toBeNull();
    expect(coerceChatAttachment({ name: 'photo.png', mediaType: 'image/png', dataBase64: b64('x') })).not.toBeNull();
    expect(coerceChatAttachment({ name: 'note.txt', mediaType: 'text/plain', dataBase64: b64('x') })).not.toBeNull();
  });

  it('rejette un type non pris en charge ou des données invalides', () => {
    expect(coerceChatAttachment({ name: 'a.zip', mediaType: 'application/zip', dataBase64: b64('x') })).toBeNull();
    expect(coerceChatAttachment({ name: 'a.pdf', mediaType: 'application/pdf', dataBase64: '' })).toBeNull();
    expect(coerceChatAttachment({ name: 'a.pdf', mediaType: 'application/pdf', dataBase64: '@@@not base64@@@' })).toBeNull();
    expect(coerceChatAttachment(null)).toBeNull();
    expect(coerceChatAttachment('nope')).toBeNull();
  });

  it('borne le nom et fournit un défaut', () => {
    expect(coerceChatAttachment({ name: 'a\nb\tc', mediaType: 'text/plain', dataBase64: b64('x') })?.name).toBe('a b c');
    expect(coerceChatAttachment({ name: '', mediaType: 'text/plain', dataBase64: b64('x') })?.name).toBe('Document');
  });

  it('rejette un fichier trop volumineux', () => {
    const tooBig = 'A'.repeat(Math.ceil((ATTACHMENT_MAX_BYTES * 4) / 3) + 100);
    expect(coerceChatAttachment({ name: 'big.pdf', mediaType: 'application/pdf', dataBase64: tooBig })).toBeNull();
  });

  it('normalise le mediaType (casse + paramètres)', () => {
    expect(coerceChatAttachment({ name: 'a.txt', mediaType: 'TEXT/PLAIN; charset=utf-8', dataBase64: b64('x') })?.mediaType).toBe('text/plain');
  });
});

describe('attachment — parts modèle', () => {
  it('texte : inliné dans une part text avec en-tête', () => {
    const att: ChatAttachment = { name: 'note.txt', mediaType: 'text/plain', dataBase64: b64('Bonjour le monde') };
    const parts = attachmentToModelParts(att);
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe('text');
    expect((parts[0] as { text: string }).text).toContain('note.txt');
    expect((parts[0] as { text: string }).text).toContain('Bonjour le monde');
  });

  it('PDF : part file avec des octets et le bon mediaType', () => {
    const att: ChatAttachment = { name: 'cr.pdf', mediaType: 'application/pdf', dataBase64: b64('%PDF-1.4') };
    const parts = attachmentToModelParts(att);
    expect(parts[0].type).toBe('text');
    const file = parts[1] as { type: string; data: Uint8Array; mediaType: string };
    expect(file.type).toBe('file');
    expect(file.mediaType).toBe('application/pdf');
    expect(file.data).toBeInstanceOf(Uint8Array);
    expect(file.data.length).toBeGreaterThan(0);
  });

  it('image : part image avec des octets', () => {
    const att: ChatAttachment = { name: 'p.png', mediaType: 'image/png', dataBase64: b64('PNGDATA') };
    const parts = attachmentToModelParts(att);
    const img = parts[1] as { type: string; image: Uint8Array; mediaType: string };
    expect(img.type).toBe('image');
    expect(img.image).toBeInstanceOf(Uint8Array);
    expect(img.mediaType).toBe('image/png');
  });
});

describe('attachment — injection dans les messages modèle', () => {
  const att: ChatAttachment = { name: 'cr.pdf', mediaType: 'application/pdf', dataBase64: b64('%PDF') };

  it('contenu string → devient un tableau [question, …parts]', () => {
    const messages = [{ role: 'user', content: 'Analyse ce compte rendu' }];
    appendAttachmentToModelMessages(messages, att);
    expect(Array.isArray(messages[0].content)).toBe(true);
    const parts = messages[0].content as unknown as Array<{ type: string; text?: string }>;
    expect(parts[0]).toEqual({ type: 'text', text: 'Analyse ce compte rendu' });
    expect(parts.some((p) => p.type === 'file')).toBe(true);
  });

  it('contenu tableau → parts ajoutées', () => {
    const messages = [{ role: 'user', content: [{ type: 'text', text: 'Q' }] as unknown }];
    appendAttachmentToModelMessages(messages, att);
    const parts = messages[0].content as unknown[];
    expect(parts.length).toBe(3); // Q + [text header, file]
  });

  it('cible le DERNIER message utilisateur', () => {
    const messages = [
      { role: 'user', content: 'ancien' },
      { role: 'assistant', content: 'réponse' },
      { role: 'user', content: 'récent' },
    ];
    appendAttachmentToModelMessages(messages, att);
    expect(typeof messages[0].content).toBe('string'); // inchangé
    expect(Array.isArray(messages[2].content)).toBe(true); // modifié
  });

  it('aucun message utilisateur → sans effet', () => {
    const messages = [{ role: 'assistant', content: 'x' }];
    appendAttachmentToModelMessages(messages, att);
    expect(messages[0].content).toBe('x');
  });
});
