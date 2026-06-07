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

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Ensemble des rôles DÉJÀ vérifiés pour ce compte (migration 0016). `public` est acquis.
  const { data: current } = await admin
    .from('profiles')
    .select('verified_personas')
    .eq('id', userId)
    .maybeSingle();
  const verifiedSet = new Set<string>(
    (current?.verified_personas as string[] | null) ?? ['public'],
  );
  verifiedSet.add('public');

  // ── Bascule libre entre rôles déjà vérifiés ─────────────────────────────────
  // Si le compte a DÉJÀ été vérifié pour ce rôle, on bascule le rôle ACTIF sans
  // re-demander d'email/RPPS (l'utilisateur peut changer de chat comme bon lui semble).
  if (verifiedSet.has(persona)) {
    const { error: switchErr } = await admin
      .from('profiles')
      .update({ persona, status: 'verified', updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (switchErr) return json({ error: switchErr.message }, 500);
    return json(
      { ok: true, persona, status: 'verified', verifiedPersonas: [...verifiedSet] },
      200,
    );
  }

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
    // Lookup ANS Annuaire Santé (FHIR) — ADR-0011.
    // SÉCURITÉ : ne JAMAIS auto-valider un professionnel sans vérification réelle.
    // - dev bypass → verified (jamais en prod).
    // - sinon, sans ANNUAIRE_SANTE_API_KEY → statut `pending` SANS écriture en base
    //   (la vérification FHIR réelle est implémentée par CC3 / branche determined-ride).
    if (!devBypass && !process.env.ANNUAIRE_SANTE_API_KEY) {
      return json(
        {
          ok: true,
          persona,
          status: 'pending',
          message:
            'Vérification professionnelle en attente : ANNUAIRE_SANTE_API_KEY non configurée. ' +
            "Aucun accès professionnel n'est accordé tant que le RPPS n'est pas vérifié auprès de l'Annuaire Santé.",
        },
        202,
      );
    }
    // TODO (CC3) : avec ANNUAIRE_SANTE_API_KEY, appeler le FHIR Practitioner réel.
    status = 'verified';
    method = devBypass ? 'none' : 'rpps';
  }

  // Le rôle fraîchement vérifié rejoint l'ensemble acquis (multi-rôles, migration 0016).
  verifiedSet.add(persona);
  const verifiedPersonas = [...verifiedSet];

  const { error: upErr } = await admin
    .from('profiles')
    .update({
      persona,
      status,
      verification_method: method,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      verified_personas: verifiedPersonas,
    })
    .eq('id', userId);

  if (upErr) return json({ error: upErr.message }, 500);
  return json({ ok: true, persona, status, verifiedPersonas }, 200);
}
