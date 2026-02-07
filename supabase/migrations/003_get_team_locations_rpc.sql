-- =====================================================
-- RPC FUNCTION: get_team_locations
-- =====================================================
-- Fetches live team member locations for a manager in a single query.
-- Replaces 3 sequential queries with 1 server-side function.
-- Returns latest location per team member from the last 30 minutes.

create or replace function public.get_team_locations(p_manager_id uuid)
returns table (
  user_id uuid,
  full_name text,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  recorded_at timestamptz
)
language sql
security definer
stable
as $$
  with manager_teams as (
    select id from public.teams
    where manager_id = p_manager_id
  ),
  team_user_ids as (
    select distinct tm.user_id
    from public.team_members tm
    where tm.team_id in (select id from manager_teams)
  ),
  recent_logs as (
    select
      ll.user_id,
      ll.latitude,
      ll.longitude,
      ll.accuracy,
      ll.recorded_at,
      row_number() over (partition by ll.user_id order by ll.recorded_at desc) as rn
    from public.location_logs ll
    where ll.user_id in (select user_id from team_user_ids)
      and ll.recorded_at >= now() - interval '30 minutes'
  )
  select
    rl.user_id,
    coalesce(p.full_name, 'Unknown') as full_name,
    rl.latitude,
    rl.longitude,
    rl.accuracy,
    rl.recorded_at
  from recent_logs rl
  join public.profiles p on p.id = rl.user_id
  where rl.rn = 1
  order by rl.recorded_at desc;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.get_team_locations(uuid) to authenticated;
