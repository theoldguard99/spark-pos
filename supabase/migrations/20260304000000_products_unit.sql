-- Add unit to products (Unit | KG). Safe if column already exists.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit text DEFAULT 'unit';

COMMENT ON COLUMN public.products.unit IS 'Display unit: unit (e.g. pieces) or kg';
