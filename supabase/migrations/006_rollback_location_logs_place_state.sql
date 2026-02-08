-- =====================================================
-- Rollback: Remove place_name and state from location_logs
-- =====================================================
-- Run this in Supabase SQL Editor to undo 005.
-- Location Trail will still show place/state via client-side reverse geocode.

alter table public.location_logs
  drop column if exists place_name,
  drop column if exists state;
