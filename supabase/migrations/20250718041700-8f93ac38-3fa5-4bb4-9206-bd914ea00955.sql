
-- Add foreign key reference from orders to children table
ALTER TABLE public.orders 
ADD COLUMN child_id UUID REFERENCES public.children(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_orders_child_id ON public.orders(child_id);

-- Update existing orders to link with children where possible
-- This will try to match based on child_name and child_class
UPDATE public.orders 
SET child_id = c.id 
FROM public.children c 
WHERE public.orders.child_name = c.name 
  AND public.orders.child_class = c.class_name 
  AND public.orders.user_id = c.user_id
  AND public.orders.child_id IS NULL;

-- Update RLS policies to allow cashiers to search through children data
CREATE POLICY "Cashiers can view children for order search" 
  ON public.children 
  FOR SELECT 
  USING (has_role(auth.uid(), 'cashier'::text));

-- Allow cashiers to view all children data for search purposes
CREATE POLICY "Cashiers can view all children data" 
  ON public.children 
  FOR SELECT 
  USING (has_role(auth.uid(), 'cashier'::text) OR has_role(auth.uid(), 'admin'::text));
