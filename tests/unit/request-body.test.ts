import { describe, expect, it } from 'vitest';
import { boundRequestBody } from '@/server/requestBody';

describe('HTTP body bounds before JSON/multipart parsing', () => {
  it.each(['null', '[]', '1', '"text"'])('rejects JSON primitives/arrays: %s', async (body) => {
    const req = new Request('https://app.test', { method: 'POST', body, headers: { 'content-type': 'application/json' } });
    expect((await boundRequestBody(req) as Response).status).toBe(400);
  });
  it('preserves the exact bytes (including webhook signatures) and headers', async () => {
    const original = new Request('https://app.test/api/stripe/webhook', {
      method: 'POST', headers: { authorization: 'Bearer test' }, body: ' { "a": 1 }\n',
    });
    const bounded = await boundRequestBody(original, 100);
    expect(bounded).toBeInstanceOf(Request);
    expect((bounded as Request).headers.get('authorization')).toBe('Bearer test');
    expect(await (bounded as Request).text()).toBe(' { "a": 1 }\n');
  });

  it('rejects an oversized declared Content-Length before reading', async () => {
    const req = new Request('https://app.test', {
      method: 'POST', headers: { 'content-length': '101' }, body: 'x',
    });
    expect((await boundRequestBody(req, 100) as Response).status).toBe(413);
    expect(req.bodyUsed).toBe(false);
  });

  it.each([undefined, '1'])('counts streamed bytes even with missing/false length %s', async (length) => {
    let cancelled = false;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(60));
        controller.enqueue(new Uint8Array(60));
      },
      cancel() { cancelled = true; },
    });
    const req = new Request('https://app.test', {
      method: 'POST', body: stream,
      headers: length ? { 'content-length': length } : {},
      duplex: 'half',
    } as RequestInit);
    expect((await boundRequestBody(req, 100) as Response).status).toBe(413);
    expect(cancelled).toBe(true);
  });

  it('counts UTF-8 bytes rather than characters', async () => {
    const req = new Request('https://app.test', { method: 'POST', body: 'ééé' });
    expect((await boundRequestBody(req, 5) as Response).status).toBe(413);
  });

  it('allows an exact-limit multipart body with its boundary intact', async () => {
    const form = new FormData();
    form.append('audio', new Blob(['sample']), 'test.webm');
    const req = new Request('https://app.test', { method: 'POST', body: form });
    const bytes = await req.clone().arrayBuffer();
    const bounded = await boundRequestBody(req, bytes.byteLength);
    const parsed = await (bounded as Request).formData() as unknown as { get(name: string): unknown };
    expect(parsed.get('audio')).toBeInstanceOf(Blob);
  });
});
