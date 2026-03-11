-- Add username to profiles for store employees (generated: 6-char + position + lastname + firstname + MMDDYY).
-- Used for username-based login when auth email is username@pos.local.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS username text;

COMMENT ON COLUMN public.profiles.username IS 'Generated login username for employees (e.g. Xk9mAbEMDelaCruzJuan030326). Used with @pos.local for auth.';
