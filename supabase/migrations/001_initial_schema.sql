-- =====================================================
-- Trackora Database Schema
-- =====================================================
-- This migration creates all tables, RLS policies, and functions
-- for the Trackora staff tracking application.

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLES
-- =====================================================

-- 1. Profiles Table
-- Links to Supabase Auth and stores user role information
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('staff', 'manager', 'admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Attendance Table
-- Daily attendance records with check-in/check-out
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    check_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
    check_in_lat DOUBLE PRECISION NOT NULL,
    check_in_lng DOUBLE PRECISION NOT NULL,
    check_out_time TIMESTAMP WITH TIME ZONE,
    check_out_lat DOUBLE PRECISION,
    check_out_lng DOUBLE PRECISION,
    total_minutes INTEGER,
    status TEXT CHECK (status IN ('present', 'absent', 'half-day')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Location Logs Table
-- High-volume table for tracking location every 2 minutes
CREATE TABLE IF NOT EXISTS public.location_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries on location_logs
CREATE INDEX IF NOT EXISTS idx_location_logs_user_time ON public.location_logs(user_id, recorded_at DESC);

-- 4. Teams Table (Optional)
-- Team management for organizing staff
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Team Members Table
-- Maps users to teams
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure a user can only be in a team once
    CONSTRAINT unique_team_user UNIQUE (team_id, user_id)
);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate total minutes when checking out
CREATE OR REPLACE FUNCTION calculate_total_minutes()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.check_out_time IS NOT NULL AND NEW.check_in_time IS NOT NULL THEN
        NEW.total_minutes = EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 60;
        
        -- Set status based on total minutes (8 hours = 480 minutes)
        IF NEW.total_minutes >= 480 THEN
            NEW.status = 'present';
        ELSIF NEW.total_minutes >= 240 THEN
            NEW.status = 'half-day';
        ELSE
            NEW.status = 'absent';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to prevent duplicate attendance on same day
CREATE OR REPLACE FUNCTION check_duplicate_attendance()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if user already has attendance for this date
    IF EXISTS (
        SELECT 1 FROM public.attendance
        WHERE user_id = NEW.user_id
        AND DATE(check_in_time) = DATE(NEW.check_in_time)
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
        RAISE EXCEPTION 'User already has attendance record for this date';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to update updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on attendance
CREATE TRIGGER update_attendance_updated_at
    BEFORE UPDATE ON public.attendance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to calculate total minutes on attendance
CREATE TRIGGER calculate_attendance_minutes
    BEFORE INSERT OR UPDATE ON public.attendance
    FOR EACH ROW
    EXECUTE FUNCTION calculate_total_minutes();

-- Trigger to check for duplicate attendance
CREATE TRIGGER check_duplicate_attendance_trigger
    BEFORE INSERT OR UPDATE ON public.attendance
    FOR EACH ROW
    EXECUTE FUNCTION check_duplicate_attendance();

-- Trigger to update updated_at on teams
CREATE TRIGGER update_teams_updated_at
    BEFORE UPDATE ON public.teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

-- Staff can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Staff can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Managers can view their team members' profiles
CREATE POLICY "Managers can view team profiles"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.teams t
            JOIN public.team_members tm ON t.id = tm.team_id
            WHERE t.manager_id = auth.uid() AND tm.user_id = profiles.id
        )
    );

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admins can insert, update, delete profiles
CREATE POLICY "Admins can manage profiles"
    ON public.profiles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- ATTENDANCE POLICIES
-- =====================================================

-- Staff can view their own attendance
CREATE POLICY "Users can view own attendance"
    ON public.attendance FOR SELECT
    USING (auth.uid() = user_id);

-- Staff can insert their own attendance
CREATE POLICY "Users can insert own attendance"
    ON public.attendance FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Staff can update their own attendance (for check-out)
CREATE POLICY "Users can update own attendance"
    ON public.attendance FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Managers can view team members' attendance
CREATE POLICY "Managers can view team attendance"
    ON public.attendance FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.teams t
            JOIN public.team_members tm ON t.id = tm.team_id
            WHERE t.manager_id = auth.uid() AND tm.user_id = attendance.user_id
        )
    );

-- Managers can edit same-day attendance for team members
CREATE POLICY "Managers can edit same-day team attendance"
    ON public.attendance FOR UPDATE
    USING (
        DATE(check_in_time) = CURRENT_DATE
        AND EXISTS (
            SELECT 1 FROM public.teams t
            JOIN public.team_members tm ON t.id = tm.team_id
            WHERE t.manager_id = auth.uid() AND tm.user_id = attendance.user_id
        )
    );

-- Admins can manage all attendance
CREATE POLICY "Admins can manage all attendance"
    ON public.attendance FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- LOCATION LOGS POLICIES
-- =====================================================

-- Staff can insert their own location logs
CREATE POLICY "Users can insert own location logs"
    ON public.location_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Staff can view their own location logs
CREATE POLICY "Users can view own location logs"
    ON public.location_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Managers can view team members' location logs
CREATE POLICY "Managers can view team location logs"
    ON public.location_logs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.teams t
            JOIN public.team_members tm ON t.id = tm.team_id
            WHERE t.manager_id = auth.uid() AND tm.user_id = location_logs.user_id
        )
    );

-- Admins can manage all location logs
CREATE POLICY "Admins can manage all location logs"
    ON public.location_logs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- TEAMS POLICIES
-- =====================================================

-- All authenticated users can view teams
CREATE POLICY "Authenticated users can view teams"
    ON public.teams FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Admins can manage teams
CREATE POLICY "Admins can manage teams"
    ON public.teams FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- TEAM MEMBERS POLICIES
-- =====================================================

-- All authenticated users can view team members
CREATE POLICY "Authenticated users can view team members"
    ON public.team_members FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Admins can manage team members
CREATE POLICY "Admins can manage team members"
    ON public.team_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- HELPER FUNCTION: Create profile on signup
-- =====================================================

-- This function automatically creates a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, role, is_active)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'staff'),
        true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for faster queries on attendance
CREATE INDEX IF NOT EXISTS idx_attendance_user_date 
    ON public.attendance(user_id, check_in_time DESC);

CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant access to tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
