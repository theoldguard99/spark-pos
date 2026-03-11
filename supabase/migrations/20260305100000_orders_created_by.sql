-- Track which employee (user) created each order for reports and audit.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

COMMENT ON COLUMN public.orders.created_by IS 'User (profile) who processed this transaction.';
