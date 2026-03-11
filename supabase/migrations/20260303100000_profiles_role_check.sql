-- Allow role values used by the app: owner (signup), employee, manager, admin (added by owner).
-- 1. Drop existing check (so we can fix data).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Fix any existing rows with a role that's not in our allowed list (set to owner).
UPDATE public.profiles
SET role = 'owner'
WHERE role IS NOT NULL
  AND role NOT IN ('owner', 'employee', 'manager', 'admin');

-- 3. Add the new check.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IS NULL OR role IN ('owner', 'employee', 'manager', 'admin'));
