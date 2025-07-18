
-- Fix RLS policies for cashier access to orders and related data
-- First, let's ensure cashiers can properly view order details

-- Drop existing problematic policies if any
DROP POLICY IF EXISTS "Cashiers can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Cashiers can update payment status" ON public.orders;

-- Create better policies for cashier access to orders
CREATE POLICY "Cashiers can view orders for payment processing" 
  ON public.orders 
  FOR SELECT 
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'cashier'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Cashiers can update orders for payment processing" 
  ON public.orders 
  FOR UPDATE 
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('cashier', 'admin')
    )
  );

-- Ensure cashiers can view order_items for order details
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
CREATE POLICY "Users and cashiers can view order items" 
  ON public.order_items 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_items.order_id 
      AND (
        orders.user_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.role IN ('cashier', 'admin')
        )
      )
    )
  );

-- Ensure payments table has proper access for cashiers
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
CREATE POLICY "Users and cashiers can view payments" 
  ON public.payments 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = payments.order_id 
      AND (
        orders.user_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.role IN ('cashier', 'admin')
        )
      )
    )
  );

-- Add policy for cashiers to create payments
CREATE POLICY "Cashiers can create payments" 
  ON public.payments 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('cashier', 'admin')
    )
  );

-- Update cash_payments table to track which cashier processed each payment
-- Add cashier_name field for easier reporting
ALTER TABLE public.cash_payments 
ADD COLUMN IF NOT EXISTS cashier_name TEXT;

-- Update existing cash_payments with cashier names
UPDATE public.cash_payments 
SET cashier_name = (
  SELECT profiles.full_name 
  FROM public.profiles 
  WHERE profiles.id = cash_payments.cashier_id
)
WHERE cashier_name IS NULL;

-- Create index for better performance on cashier queries
CREATE INDEX IF NOT EXISTS idx_cash_payments_cashier_name ON public.cash_payments(cashier_name);
CREATE INDEX IF NOT EXISTS idx_cash_payments_created_at ON public.cash_payments(created_at);

-- Fix the cash_payments RLS policy to be more specific
DROP POLICY IF EXISTS "Cashiers can manage cash payments" ON public.cash_payments;
CREATE POLICY "Cashiers can manage their own cash payments" 
  ON public.cash_payments 
  FOR ALL 
  USING (
    cashier_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allow cashiers to view cash payments for reporting
CREATE POLICY "Cashiers can view cash payments for reporting" 
  ON public.cash_payments 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('cashier', 'admin')
    )
  );
