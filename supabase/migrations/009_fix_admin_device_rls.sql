-- Fix RLS policy to allow admin devices to be readable by anyone
-- This is needed for the admin device login bypass feature

-- Drop the existing admin read policy
DROP POLICY IF EXISTS "admins_read_all_devices" ON public.user_devices;

-- Create new policy: anyone can read admin devices (needed for login check)
CREATE POLICY "anyone_read_admin_devices"
ON public.user_devices FOR SELECT
USING (is_admin_device = true);

-- Keep existing policy: users can read their own device
-- (This will be checked second if the above doesn't match)

-- Also create policy for admins to read all devices
CREATE POLICY "admins_read_all_devices"
ON public.user_devices FOR SELECT
USING (public.is_admin());
