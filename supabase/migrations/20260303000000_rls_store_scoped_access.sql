-- Ensure store-scoped access: any user whose profile has store_id X can read/write that store's data.
-- This lets owners and employees (same store_id) see orders, products, etc.

-- Helper: current user's store_id (null if no profile or no store)
CREATE OR REPLACE FUNCTION public.current_user_store_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Orders: allow read/write if user's profile has this order's store_id
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_same_store" ON public.orders;
CREATE POLICY "orders_select_same_store" ON public.orders
  FOR SELECT USING (store_id = public.current_user_store_id());

DROP POLICY IF EXISTS "orders_insert_same_store" ON public.orders;
CREATE POLICY "orders_insert_same_store" ON public.orders
  FOR INSERT WITH CHECK (store_id = public.current_user_store_id());

DROP POLICY IF EXISTS "orders_update_same_store" ON public.orders;
CREATE POLICY "orders_update_same_store" ON public.orders
  FOR UPDATE USING (store_id = public.current_user_store_id());

-- Order items: allow access if the order belongs to user's store
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select_same_store" ON public.order_items;
CREATE POLICY "order_items_select_same_store" ON public.order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM public.orders WHERE store_id = public.current_user_store_id())
  );

DROP POLICY IF EXISTS "order_items_insert_same_store" ON public.order_items;
CREATE POLICY "order_items_insert_same_store" ON public.order_items
  FOR INSERT WITH CHECK (
    order_id IN (SELECT id FROM public.orders WHERE store_id = public.current_user_store_id())
  );

-- Products: allow read/write if user's profile has this product's store_id
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_same_store" ON public.products;
CREATE POLICY "products_select_same_store" ON public.products
  FOR SELECT USING (store_id = public.current_user_store_id());

DROP POLICY IF EXISTS "products_insert_same_store" ON public.products;
CREATE POLICY "products_insert_same_store" ON public.products
  FOR INSERT WITH CHECK (store_id = public.current_user_store_id());

DROP POLICY IF EXISTS "products_update_same_store" ON public.products;
CREATE POLICY "products_update_same_store" ON public.products
  FOR UPDATE USING (store_id = public.current_user_store_id());

DROP POLICY IF EXISTS "products_delete_same_store" ON public.products;
CREATE POLICY "products_delete_same_store" ON public.products
  FOR DELETE USING (store_id = public.current_user_store_id());

-- Stores: allow read/update for user's own store
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stores_select_own" ON public.stores;
CREATE POLICY "stores_select_own" ON public.stores
  FOR SELECT USING (id = public.current_user_store_id());

DROP POLICY IF EXISTS "stores_insert_own" ON public.stores;
CREATE POLICY "stores_insert_own" ON public.stores
  FOR INSERT WITH CHECK (true); -- onboarding creates store then links profile; profile not yet set

DROP POLICY IF EXISTS "stores_update_own" ON public.stores;
CREATE POLICY "stores_update_own" ON public.stores
  FOR UPDATE USING (id = public.current_user_store_id());

-- store_payment_configs: only for user's store
ALTER TABLE public.store_payment_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_payment_configs_select_same_store" ON public.store_payment_configs;
CREATE POLICY "store_payment_configs_select_same_store" ON public.store_payment_configs
  FOR SELECT USING (store_id = public.current_user_store_id());

DROP POLICY IF EXISTS "store_payment_configs_upsert_same_store" ON public.store_payment_configs;
CREATE POLICY "store_payment_configs_upsert_same_store" ON public.store_payment_configs
  FOR ALL USING (store_id = public.current_user_store_id());

-- Profiles: read own profile + read other profiles in same store (for employee list)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_same_store" ON public.profiles;
CREATE POLICY "profiles_select_same_store" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR store_id = public.current_user_store_id()
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());
