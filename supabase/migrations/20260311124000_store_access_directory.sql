CREATE TABLE IF NOT EXISTS public.store_access_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'employee')),
  resource text NOT NULL,
  can_access boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_access_role_permissions_unique UNIQUE (store_id, role, resource)
);

CREATE TABLE IF NOT EXISTS public.store_access_user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource text NOT NULL,
  can_access boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_access_user_permissions_unique UNIQUE (store_id, user_id, resource)
);

CREATE INDEX IF NOT EXISTS idx_store_access_role_permissions_store_id
  ON public.store_access_role_permissions(store_id);
CREATE INDEX IF NOT EXISTS idx_store_access_user_permissions_store_id
  ON public.store_access_user_permissions(store_id);
CREATE INDEX IF NOT EXISTS idx_store_access_user_permissions_user_id
  ON public.store_access_user_permissions(user_id);

ALTER TABLE public.store_access_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_access_user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_access_role_permissions_select_same_store" ON public.store_access_role_permissions;
CREATE POLICY "store_access_role_permissions_select_same_store" ON public.store_access_role_permissions
  FOR SELECT USING (store_id = public.current_user_store_id());

DROP POLICY IF EXISTS "store_access_role_permissions_upsert_same_store" ON public.store_access_role_permissions;
CREATE POLICY "store_access_role_permissions_upsert_same_store" ON public.store_access_role_permissions
  FOR ALL USING (store_id = public.current_user_store_id());

DROP POLICY IF EXISTS "store_access_user_permissions_select_same_store" ON public.store_access_user_permissions;
CREATE POLICY "store_access_user_permissions_select_same_store" ON public.store_access_user_permissions
  FOR SELECT USING (store_id = public.current_user_store_id());

DROP POLICY IF EXISTS "store_access_user_permissions_upsert_same_store" ON public.store_access_user_permissions;
CREATE POLICY "store_access_user_permissions_upsert_same_store" ON public.store_access_user_permissions
  FOR ALL USING (store_id = public.current_user_store_id());
