/**
 * Battement de cœur des flux SSE (src/server/sseHeartbeat.ts).
 *
 * Le flux est produit par le VRAI AI SDK (createUIMessageStreamResponse, comme /api/chat) et
 * relu par le VRAI transport du client (DefaultChatTransport, comme useChat) : un battement
 * qui gênerait le client ferait échouer la validation de ses fragments.
 */
import { describe, it, expect } from 'vitest';
import { createUIMessageStream, createUIMessageStreamResponse, DefaultChatTransport } from 'ai';

import { SSE_HEARTBEAT_INTERVAL_MS, withSseHeartbeat } from '@/server/sseHeartbeat';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const INTERVAL = 40;

/** Réponse de chat dont la « réflexion » reste muette `silenceMs` avant le texte. */
function chatResponse(silenceMs: number): Response {
  const stream = createUIMessageStream({
    generateId: () => 'msg-1',
    execute: async ({ writer }) => {
      writer.write({ type: 'start' });
      await sleep(silenceMs);
      writer.write({ type: 'text-start', id: 't' });
      writer.write({ type: 'text-delta', id: 't', delta: 'Bonjour' });
      writer.write({ type: 'text-end', id: 't' });
    },
  });
  return createUIMessageStreamResponse({ stream, headers: { 'X-Accel-Buffering': 'no' } });
}

/** Fragments tels que les reçoit useChat (transport réel, validation de schéma comprise). */
async function clientChunks(response: Response): Promise<unknown[]> {
  const transport = new DefaultChatTransport({ api: '/api/chat', fetch: (async () => response) as typeof fetch });
  const stream = await transport.sendMessages({
    chatId: 'c',
    messages: [],
    abortSignal: undefined,
    trigger: 'submit-message',
    messageId: undefined,
  });
  const chunks: unknown[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return chunks;
    chunks.push(value);
  }
}

/** Source contrôlée octet par octet. */
function controlledSource() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let cancelReason: unknown = 'non annulée';
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel(reason) {
      cancelReason = reason;
    },
  });
  const encoder = new TextEncoder();
  return {
    response: new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    write: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
    fail: (error: Error) => controller.error(error),
    cancelReason: () => cancelReason,
  };
}

describe('withSseHeartbeat', () => {
  it('intervalle de production bien sous les délais usuels de proxy (60 s)', () => {
    expect(SSE_HEARTBEAT_INTERVAL_MS).toBeLessThanOrEqual(20_000);
  });

  it('silence prolongé → commentaires SSE, et le client reçoit exactement les mêmes fragments', async () => {
    const raw = await withSseHeartbeat(chatResponse(INTERVAL * 5), { intervalMs: INTERVAL }).text();
    expect(raw).toContain(': keep-alive\n\n');
    expect(raw.indexOf(': keep-alive')).toBeLessThan(raw.indexOf('text-start'));

    const withBeat = await clientChunks(withSseHeartbeat(chatResponse(INTERVAL * 5), { intervalMs: INTERVAL }));
    const without = await clientChunks(chatResponse(INTERVAL * 5));
    expect(withBeat).toEqual(without);
    expect(withBeat).toContainEqual({ type: 'text-delta', id: 't', delta: 'Bonjour' });
  });

  it('flux régulier : aucun battement superflu', async () => {
    const src = controlledSource();
    // Écritures toutes les 20 ms contre un délai de 400 ms : marge large même sur une CI chargée.
    const out = withSseHeartbeat(src.response, { intervalMs: INTERVAL * 10 });
    const text = out.text();
    for (let i = 0; i < 8; i++) {
      src.write(`data: {"n":${i}}\n\n`);
      await sleep(INTERVAL / 2);
    }
    src.close();
    expect(await text).not.toContain('keep-alive');
  });

  it('jamais au milieu d’un événement : ni dans une ligne coupée, ni entre deux lignes `data:`', async () => {
    const src = controlledSource();
    const text = withSseHeartbeat(src.response, { intervalMs: INTERVAL }).text();
    src.write('data: {"a":');
    await sleep(INTERVAL * 4);
    src.write('1}\ndata: {"b":2}\n');
    await sleep(INTERVAL * 4);
    src.write('\n');
    src.close();
    expect(await text).toBe('data: {"a":1}\ndata: {"b":2}\n\n');
  });

  it('conserve statut et en-têtes ; une réponse sans corps est renvoyée telle quelle', async () => {
    const src = controlledSource();
    const out = withSseHeartbeat(src.response);
    expect(out.status).toBe(200);
    expect(out.headers.get('content-type')).toBe('text/event-stream');
    src.close();
    await out.text();

    const empty = new Response(null, { status: 204 });
    expect(withSseHeartbeat(empty)).toBe(empty);
  });

  it('client parti : la source est annulée et plus rien n’est écrit', async () => {
    const src = controlledSource();
    const out = withSseHeartbeat(src.response, { intervalMs: INTERVAL });
    const reader = out.body!.getReader();
    src.write('data: {"type":"start"}\n\n');
    await reader.read();
    await reader.cancel('client parti');
    expect(src.cancelReason()).toBe('client parti');
    await sleep(INTERVAL * 3); // le minuteur arrêté ne lève rien
  });

  it('une erreur de la source est transmise au client', async () => {
    const src = controlledSource();
    const text = withSseHeartbeat(src.response, { intervalMs: INTERVAL }).text();
    src.write('data: {"type":"start"}\n\n');
    src.fail(new Error('panne fournisseur'));
    await expect(text).rejects.toThrow('panne fournisseur');
  });
});
