-- Ensure profiles.created_at has a default so inserts (e.g. from triggers or Edge Function upsert) don't fail.
-- Safe to run multiple times.
ALTER TABLE public.profiles
ALTER COLUMN created_at SET DEFAULT now();
