-- Update profiles table for email/password authentication
-- This migration adds email column and makes phone optional

-- Add email column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- Make phone nullable (optional)
ALTER TABLE public.profiles 
ALTER COLUMN phone DROP NOT NULL;

-- Update any existing data that has emails in phone column
UPDATE public.profiles 
SET email = phone 
WHERE phone LIKE '%@%' AND email IS NULL;

-- Add index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Update RLS policies to work with email
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);
