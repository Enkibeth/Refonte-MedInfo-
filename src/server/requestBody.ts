/** Bound actual bytes before JSON/multipart parsing, including chunked uploads. */
export const API_BODY_MAX_BYTES = 2 * 1024 * 1024;
const BODY_READ_TIMEOUT_MS = 60_000;

function tooLarge(): Response {
  return Response.json({ error: 'Requête trop volumineuse.' }, { status: 413 });
}

export async function boundRequestBody(
  request: Request,
  maxBytes = API_BODY_MAX_BYTES,
): Promise<Request | Response> {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))) {
    return Response.json({ error: 'Content-Length invalide.' }, { status: 400 });
  }
  if (declared !== null && Number(declared) > maxBytes) return tooLarge();
  if (!request.body) return request;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('body timeout')), BODY_READ_TIMEOUT_MS);
  });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        void reader.cancel().catch(() => {});
        return tooLarge();
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    if (request.headers.get('content-type')?.split(';')[0].trim() === 'application/json') {
      let parsed: unknown;
      try { parsed = JSON.parse(new TextDecoder().decode(bytes)); } catch { /* Route returns its JSON error. */ }
      if (parsed !== undefined && (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))) {
        return Response.json({ error: 'Objet JSON requis.' }, { status: 400 });
      }
    }
    // Preserve exact bytes, authorization and multipart boundary, especially the
    // signed Stripe webhook body: never parse/reserialize it here.
    return new Request(request, { body: bytes });
  } catch {
    void reader.cancel().catch(() => {});
    return Response.json({ error: 'Lecture de la requête impossible.' }, { status: 400 });
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
