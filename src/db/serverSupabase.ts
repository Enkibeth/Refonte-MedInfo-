/**
 * Client Supabase serveur — dédié aux routes API / Vercel Functions.
 *
 * La clé `service_role` contourne la RLS : elle ne doit jamais être importée par
 * du code client React Native/Web. Les routes serveur l'utilisent uniquement pour
 * les écritures d'audit sans contenu de santé identifiable (03_SECURITY §6).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface ServerSupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export interface ServerSupabaseStatus {
  configured: boolean;
  urlConfigured: boolean;
  serviceRoleConfigured: boolean;
  hostname: string | null;
}

export function getServerSupabaseConfig(): ServerSupabaseConfig | null {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

export function getServerSupabaseStatus(): ServerSupabaseStatus {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let hostname: string | null = null;
  if (url) {
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = 'invalid-url';
    }
  }

  return {
    configured: Boolean(url && serviceRoleKey),
    urlConfigured: Boolean(url),
    serviceRoleConfigured: Boolean(serviceRoleKey),
    hostname,
  };
}

export function createServerSupabaseClient(): SupabaseClient | null {
  const config = getServerSupabaseConfig();
  if (!config) return null;

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
