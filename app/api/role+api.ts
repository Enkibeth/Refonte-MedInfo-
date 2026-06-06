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
import { lookupRpps } from '@/auth/annuaireSante';

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

  // ── Bypass développement ────────────────────────────────────────────────────
  // BYPASS_ROLE_VERIFICATION=true dans .env désactive toutes les vérifications.
  // NE JAMAIS activer en production. Utile pour les tests et le staging.
  const devBypass = process.env.BYPASS_ROLE_VERIFICATION === 'true';

  // Vérification selon le rôle.
  let status: 'unverified' | 'verified' = 'unverified';
  let method: 'none' | 'academic_email' | 'rpps' = 'none';

  if (persona === 'public') {
    status = 'verified';
    method = 'none';
  } else if (persona === 'student') {
    const email = typeof body.email === 'string' ? body.email : '';
    if (!devBypass && !isAcademicEmail(email)) {
      return json({ error: 'Email étudiant non reconnu (domaine académique requis).' }, 422);
    }
    status = 'verified';
    method = 'academic_email';
  } else {
    // professional
    const rpps = typeof body.rpps === 'string' ? body.rpps : '';
    if (!devBypass && !isValidRppsFormat(rpps)) {
      return json({ error: 'Numéro RPPS invalide (11 chiffres attendus).' }, 422);
    }
    // Lookup ANS Annuaire Santé (FHIR) — ADR-0007/0011, 06_BILLING §10.2.
    // - bypass dev : accepté sans vérif ;
    // - clé ANNUAIRE_SANTE_API_KEY présente : vérification réelle (RPPS doit exister) ;
    // - sans clé : repli sur la seule validation de format (comportement historique).
    const annuaireKey = process.env.ANNUAIRE_SANTE_API_KEY;
    if (!devBypass && annuaireKey) {
      try {
        const { found } = await lookupRpps(rpps, { apiKey: annuaireKey });
        if (!found) {
          return json({ error: "Numéro RPPS introuvable dans l'Annuaire Santé." }, 422);
        }
      } catch {
        // Strict sur le pro (06_BILLING §10.4) : en cas d'indisponibilité ANS, on ne promeut pas.
        return json({ error: 'Vérification RPPS momentanément indisponible. Réessaie plus tard.' }, 502);
      }
    }
    status = 'verified';
    method = devBypass ? 'none' : 'rpps';
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
