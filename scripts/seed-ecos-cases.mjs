#!/usr/bin/env node
/**
 * Seed des cas ECOS dans Supabase depuis data/ecos-cases.json (upsert par slug).
 *
 * Source de vérité : data/ecos-cases.json (généré/maintenu hors de ce script). Ce seed
 * rejoue le corpus par-dessus le seed inline de la migration 0013 sans le casser.
 * Idempotent : on conflit (slug) → mise à jour. Aucune donnée de santé identifiable.
 *
 * Écriture via service_role (RLS contournée) — JAMAIS la clé anon.
 *   SUPABASE_URL (ou EXPO_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY requis.
 *
 * Usage : node scripts/seed-ecos-cases.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(HERE, '..', 'data', 'ecos-cases.json');

function loadCases() {
  if (!existsSync(DATA_FILE)) {
    console.warn(`[seed-ecos] ${DATA_FILE} introuvable — rien à seeder (le placeholder de la migration 0013 reste en place).`);
    return [];
  }
  const parsed = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  const cases = Array.isArray(parsed) ? parsed : parsed.cases ?? [];
  return cases;
}

function normalize(c) {
  // Tolérant aux variations de schéma du corpus (autre agent) : patient_profile/grading_grid
  // peuvent arriver en objet ou en chaîne brute.
  const patientProfile =
    typeof c.patient_profile === 'string'
      ? { role_brief: c.patient_profile }
      : c.patient_profile ?? { role_brief: c.briefPatient ?? '' };
  const gradingGrid =
    typeof c.grading_grid === 'string'
      ? { markdown: c.grading_grid }
      : c.grading_grid ?? { markdown: c.grilleCorrection ?? '' };

  return {
    slug: c.slug ?? c.id,
    title: c.title ?? c.titre,
    specialty: c.specialty ?? c.specialite,
    level: c.level ?? 'DFASM',
    duration_minutes: c.duration_minutes ?? c.duree ?? 10,
    brief: c.brief ?? c.consigneCandidat ?? '',
    patient_profile: patientProfile,
    grading_grid: gradingGrid,
    is_published: c.is_published ?? true,
  };
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('[seed-ecos] SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.');
    process.exit(1);
  }

  const rows = loadCases().map(normalize).filter((r) => r.slug && r.title);
  if (rows.length === 0) {
    console.log('[seed-ecos] Aucun cas à insérer.');
    return;
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await db.from('ecos_cases').upsert(rows, { onConflict: 'slug' });
  if (error) {
    console.error('[seed-ecos] Échec upsert :', error.message);
    process.exit(1);
  }
  console.log(`[seed-ecos] ${rows.length} cas ECOS upsertés (slugs : ${rows.map((r) => r.slug).join(', ')}).`);
}

main().catch((e) => {
  console.error('[seed-ecos] Erreur :', e);
  process.exit(1);
});
