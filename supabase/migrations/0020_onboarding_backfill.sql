-- Migration 0020: ensure onboarding_completed exists and backfill existing users
-- Idempotent: safe to run multiple times

-- Add column if it doesn't exist yet (may already exist in some envs)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Backfill: mark every existing user as already onboarded
-- so they are never sent through the onboarding wizard
UPDATE user_profiles
  SET onboarding_completed = true
  WHERE onboarding_completed = false;
