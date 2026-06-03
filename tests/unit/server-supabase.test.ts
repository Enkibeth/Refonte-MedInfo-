import { afterEach, describe, expect, it } from 'vitest';

import {
  getServerSupabaseConfig,
  getServerSupabaseStatus,
} from '@/db/serverSupabase';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('server Supabase config', () => {
  it('reports missing service role without throwing', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(getServerSupabaseConfig()).toBeNull();
    expect(getServerSupabaseStatus()).toEqual({
      configured: false,
      urlConfigured: false,
      serviceRoleConfigured: false,
      hostname: null,
    });
  });

  it('uses SUPABASE_URL before the public fallback for server calls', () => {
    process.env.SUPABASE_URL = 'https://dedicated-medinfo.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://public-fallback.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';

    expect(getServerSupabaseConfig()).toEqual({
      url: 'https://dedicated-medinfo.supabase.co',
      serviceRoleKey: 'service-role-test-key',
    });
    expect(getServerSupabaseStatus()).toMatchObject({
      configured: true,
      urlConfigured: true,
      serviceRoleConfigured: true,
      hostname: 'dedicated-medinfo.supabase.co',
    });
  });
});
