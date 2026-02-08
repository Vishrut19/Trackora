-- =====================================================
-- Location logs retention: delete rows older than 30 days
-- =====================================================
-- Keeps the table bounded and reduces storage.
-- Run this function daily (e.g. via Supabase Dashboard > Database > Cron,
-- or pg_cron if enabled) to clean old location_logs.

create or replace function public.delete_old_location_logs()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.location_logs
  where recorded_at < now() - interval '30 days';
$$;

comment on function public.delete_old_location_logs() is
  'Deletes location_logs older than 30 days. Schedule daily via Supabase Dashboard > Database > Cron.';

-- Run once now to clean existing old data
select public.delete_old_location_logs();
