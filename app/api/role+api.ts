/**
 * Route API rôle — POST /api/role (ADR-0011).
 * Vérifie puis attribue le persona côté SERVEUR (service_role) : le client ne peut jamais
 * s'auto-promouvoir (verrou RLS/trigger côté DB).
 *   - public        → aucune vérification ;
 *   - student       → email de domaine académique (isAcademicEmail) ;
 *   - professional  → format RPPS + (à venir) lookup ANS Annuaire Santé.
 * Aucune donnée de santé. L'identité de l'utilisateur est dérivée de SON token (jamais du body).
 */
import { createClient } from '@supabase/supabase-js';

import { isAcademicEmail, isValidRppsFormat } from '@/auth/roles';

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: Request): Promise<Response> {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    return json({ error: 'Backend auth non configuré.' }, 503);
  }

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Non authentifié.' }, 401);

  let body: { persona?: unknown; email?: unknown; rpps?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON invalide.' }, 400);
  }

  const persona = body.persona;
  if (persona !== 'public' && persona !== 'student' && persona !== 'professional') {
    return json({ error: 'Rôle inconnu.' }, 400);
  }

  // Identité dérivée du token (anti-usurpation) — jamais d'id fourni par le client.
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'Session invalide.' }, 401);
  const userId = userData.user.id;

  // Vérification selon le rôle.
  let status: 'unverified' | 'verified' = 'unverified';
  let method: 'none' | 'academic_email' | 'rpps' = 'none';

  if (persona === 'public') {
    status = 'verified';
    method = 'none';
  } else if (persona === 'student') {
    const email = typeof body.email === 'string' ? body.email : '';
    if (!isAcademicEmail(email)) {
      return json({ error: 'Email étudiant non reconnu (domaine académique requis).' }, 422);
    }
    status = 'verified';
    method = 'academic_email';
  } else {
    // professional
    const rpps = typeof body.rpps === 'string' ? body.rpps : '';
    if (!isValidRppsFormat(rpps)) {
      return json({ error: 'Numéro RPPS invalide (11 chiffres attendus).' }, 422);
    }
    // Lookup ANS Annuaire Santé (FHIR Practitioner?identifier=RPPS) — ADR-0011.
    // Tant que la clé n'est pas configurée, on NE valide PAS le rôle pro (aucune auto-attribution).
    if (!process.env.ANNUAIRE_SANTE_API_KEY) {
      return json(
        {
          status: 'pending',
          message:
            "Vérification RPPS à venir : l'intégration ANS Annuaire Santé doit être configurée (ANNUAIRE_SANTE_API_KEY).",
        },
        202,
      );
    }
    // TODO(ADR-0011) : appel FHIR réel + contrôle d'existence/état avant d'accorder le rôle.
    status = 'verified';
    method = 'rpps';
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error: upErr } = await admin
    .from('profiles')
    .update({
      persona,
      status,
      verification_method: method,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (upErr) return json({ error: upErr.message }, 500);
  return json({ ok: true, persona, status }, 200);
}
