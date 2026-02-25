-- Migration: Add admin device flag to user_devices table
-- This allows designated devices to login to any account for support purposes

-- Add is_admin_device column to user_devices
ALTER TABLE public.user_devices 
ADD COLUMN is_admin_device boolean DEFAULT false;

-- Index for quick lookup of admin devices
CREATE INDEX idx_user_devices_admin ON public.user_devices(device_uuid) 
WHERE is_admin_device = true;

-- Comment for documentation
COMMENT ON COLUMN public.user_devices.is_admin_device IS 'When true, this device can login to any user account (admin support feature)';
