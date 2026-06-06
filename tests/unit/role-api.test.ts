import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
const update = vi.fn();
const eq = vi.fn();
const from = vi.fn();
const createClient = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient,
}));

const ORIGINAL_ENV = { ...process.env };

function roleRequest(body: unknown, token = 'jwt-test'): Request {
  return new Request('https://medinfo.test/api/role', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function importRoute() {
  return import('../../app/api/role+api');
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  delete process.env.ANNUAIRE_SANTE_API_KEY;

  getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
  eq.mockResolvedValue({ error: null });
  update.mockReturnValue({ eq });
  from.mockReturnValue({ update });
  createClient.mockImplementation((_url: string, key: string) => {
    if (key === 'anon-test') return { auth: { getUser } };
    return { from };
  });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
  vi.resetModules();
});

describe('POST /api/role — edge cases et anti-usurpation', () => {
  it('renvoie 503 sans configuration backend et ne crée aucun client Supabase', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { POST } = await importRoute();
    const response = await POST(roleRequest({ persona: 'public' }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Backend auth non configuré.' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('renvoie 401 si le bearer token est absent avant toute lecture du body', async () => {
    const { POST } = await importRoute();
    const response = await POST(
      new Request('https://medinfo.test/api/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: 'public' }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Non authentifié.' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('renvoie 400 sur JSON invalide sans appeler Supabase', async () => {
    const { POST } = await importRoute();
    const response = await POST(
      new Request('https://medinfo.test/api/role', {
        method: 'POST',
        headers: { Authorization: 'Bearer jwt-test', 'Content-Type': 'application/json' },
        body: '{not-json',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'JSON invalide.' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('rejette un rôle inconnu avant vérification utilisateur', async () => {
    const { POST } = await importRoute();
    const response = await POST(roleRequest({ persona: 'admin', email: 'student@univ.fr' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Rôle inconnu.' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("dérive l'identité du token et ignore tout id client lors de l'attribution public", async () => {
    const { POST } = await importRoute();
    const response = await POST(roleRequest({ persona: 'public', userId: 'attacker-id' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, persona: 'public', status: 'verified' });
    expect(createClient).toHaveBeenNthCalledWith(
      1,
      'https://project.supabase.co',
      'anon-test',
      expect.objectContaining({ global: { headers: { Authorization: 'Bearer jwt-test' } } }),
    );
    expect(from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ persona: 'public', status: 'verified' }));
    expect(eq).toHaveBeenCalledWith('id', 'user-123');
    expect(eq).not.toHaveBeenCalledWith('id', 'attacker-id');
  });

  it("rejette un email étudiant non académique sans mise à jour admin", async () => {
    const { POST } = await importRoute();
    const response = await POST(roleRequest({ persona: 'student', email: 'student@gmail.com' }));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: 'Email étudiant non reconnu (domaine académique requis).' });
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });

  it('laisse un RPPS valide en attente si la clé Annuaire Santé manque, sans auto-attribution pro', async () => {
    const { POST } = await importRoute();
    const response = await POST(roleRequest({ persona: 'professional', rpps: '12345678901' }));
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.status).toBe('pending');
    expect(payload.message).toMatch(/ANNUAIRE_SANTE_API_KEY/);
    expect(from).not.toHaveBeenCalled();
  });
});
