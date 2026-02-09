import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Server-only Supabase client with service role. Use for cron jobs and
 * server actions that need to bypass RLS (e.g. fetch all attendance, all admin emails).
 */
export const supabaseServer =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey)
    : null;
