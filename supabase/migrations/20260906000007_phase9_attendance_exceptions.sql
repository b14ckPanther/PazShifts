-- ============================================================================
-- YellowShifts Migration: 20260906000007_phase9_attendance_exceptions.sql
-- Description: Phase 9 — Station-level attendance tolerance settings
-- ============================================================================

-- 1. Add attendance tolerance columns to stations table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'stations' 
          AND column_name = 'allowed_late_minutes'
    ) THEN
        ALTER TABLE public.stations 
        ADD COLUMN allowed_late_minutes INTEGER NOT NULL DEFAULT 10;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'stations' 
          AND column_name = 'allowed_early_leave_minutes'
    ) THEN
        ALTER TABLE public.stations 
        ADD COLUMN allowed_early_leave_minutes INTEGER NOT NULL DEFAULT 10;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'stations' 
          AND column_name = 'left_open_warning_hours'
    ) THEN
        ALTER TABLE public.stations 
        ADD COLUMN left_open_warning_hours INTEGER NOT NULL DEFAULT 12;
    END IF;
END $$;

-- 2. Add CHECK constraints to ensure sane tolerance values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_schema = 'public'
          AND table_name = 'stations'
          AND constraint_name = 'chk_allowed_late_minutes'
    ) THEN
        ALTER TABLE public.stations
        ADD CONSTRAINT chk_allowed_late_minutes
        CHECK (allowed_late_minutes >= 0 AND allowed_late_minutes <= 120);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_schema = 'public'
          AND table_name = 'stations'
          AND constraint_name = 'chk_allowed_early_leave_minutes'
    ) THEN
        ALTER TABLE public.stations
        ADD CONSTRAINT chk_allowed_early_leave_minutes
        CHECK (allowed_early_leave_minutes >= 0 AND allowed_early_leave_minutes <= 120);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_schema = 'public'
          AND table_name = 'stations'
          AND constraint_name = 'chk_left_open_warning_hours'
    ) THEN
        ALTER TABLE public.stations
        ADD CONSTRAINT chk_left_open_warning_hours
        CHECK (left_open_warning_hours >= 1 AND left_open_warning_hours <= 48);
    END IF;
END $$;
