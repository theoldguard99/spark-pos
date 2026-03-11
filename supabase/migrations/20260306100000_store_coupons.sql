-- Store-scoped coupons and coupon redemptions.
-- Better anti-abuse rule in app: one coupon per order (no stacking).

CREATE TABLE IF NOT EXISTS public.store_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric(10,2) NOT NULL CHECK (discount_value > 0),
  expires_at timestamptz NULL,
  max_total_uses integer NULL CHECK (max_total_uses IS NULL OR max_total_uses > 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_coupons_unique_code_per_store UNIQUE (store_id, code)
);

CREATE INDEX IF NOT EXISTS idx_store_coupons_store_id ON public.store_coupons(store_id);
CREATE INDEX IF NOT EXISTS idx_store_coupons_expires_at ON public.store_coupons(expires_at);

CREATE TABLE IF NOT EXISTS public.order_coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  coupon_id uuid NOT NULL REFERENCES public.store_coupons(id) ON DELETE RESTRICT,
  coupon_code text NOT NULL,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_coupon_redemptions_one_coupon_per_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_order_coupon_redemptions_store_id ON public.order_coupon_redemptions(store_id);
CREATE INDEX IF NOT EXISTS idx_order_coupon_redemptions_coupon_id ON public.order_coupon_redemptions(coupon_id);

ALTER TABLE public.store_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_coupons_select_same_store" ON public.store_coupons;
CREATE POLICY "store_coupons_select_same_store" ON public.store_coupons
  FOR SELECT USING (store_id = public.current_user_store_id());

DROP POLICY IF EXISTS "store_coupons_insert_same_store" ON public.store_coupons;
CREATE POLICY "store_coupons_insert_same_store" ON public.store_coupons
  FOR INSERT WITH CHECK (store_id = public.current_user_store_id());

DROP POLICY IF EXISTS "store_coupons_update_same_store" ON public.store_coupons;
CREATE POLICY "store_coupons_update_same_store" ON public.store_coupons
  FOR UPDATE USING (store_id = public.current_user_store_id());

DROP POLICY IF EXISTS "store_coupons_delete_same_store" ON public.store_coupons;
CREATE POLICY "store_coupons_delete_same_store" ON public.store_coupons
  FOR DELETE USING (store_id = public.current_user_store_id());

DROP POLICY IF EXISTS "order_coupon_redemptions_select_same_store" ON public.order_coupon_redemptions;
CREATE POLICY "order_coupon_redemptions_select_same_store" ON public.order_coupon_redemptions
  FOR SELECT USING (store_id = public.current_user_store_id());

DROP POLICY IF EXISTS "order_coupon_redemptions_insert_same_store" ON public.order_coupon_redemptions;
CREATE POLICY "order_coupon_redemptions_insert_same_store" ON public.order_coupon_redemptions
  FOR INSERT WITH CHECK (store_id = public.current_user_store_id());
