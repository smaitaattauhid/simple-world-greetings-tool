
-- Fix foreign key reference for cash_payments table
ALTER TABLE public.cash_payments 
DROP CONSTRAINT IF EXISTS cash_payments_cashier_id_fkey;

ALTER TABLE public.cash_payments 
ADD CONSTRAINT cash_payments_cashier_id_fkey 
FOREIGN KEY (cashier_id) REFERENCES public.profiles(id);

-- Ensure payments table status values are consistent
ALTER TABLE public.payments 
DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE public.payments 
ADD CONSTRAINT payments_status_check 
CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]));

-- Update existing payment status to match
UPDATE public.payments 
SET status = 'completed' 
WHERE status = 'success';

-- Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cash_payments_order_id ON public.cash_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_cash_payments_cashier_id ON public.cash_payments(cashier_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);

-- Update RLS policies for cash_payments to use profiles instead of auth.users
DROP POLICY IF EXISTS "Cashiers can manage cash payments" ON public.cash_payments;
CREATE POLICY "Cashiers can manage cash payments" 
  ON public.cash_payments 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'cashier'
    )
  );

-- Allow cashiers to view children for order search (if not exists)
DROP POLICY IF EXISTS "Cashiers can view children for order search" ON public.children;
CREATE POLICY "Cashiers can view children for order search" 
  ON public.children 
  FOR SELECT 
  USING (
    has_role(auth.uid(), 'cashier'::text) 
    OR has_role(auth.uid(), 'admin'::text) 
    OR (auth.uid() = user_id)
  );
