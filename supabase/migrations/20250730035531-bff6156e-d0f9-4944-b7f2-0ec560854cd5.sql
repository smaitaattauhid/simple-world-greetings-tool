
-- Create helper functions for role checking
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- First check for special admin emails
  SELECT CASE 
    WHEN (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@admin.com' THEN 'admin'
    WHEN (SELECT email FROM auth.users WHERE id = auth.uid()) = 'kasir@kasir.com' THEN 'cashier' 
    ELSE COALESCE(
      (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1),
      (SELECT role FROM public.profiles WHERE id = auth.uid()),
      'parent'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.get_current_user_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION public.is_cashier()
RETURNS boolean  
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.get_current_user_role() IN ('admin', 'cashier');
$$;

-- Profiles table policies
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- User roles table policies
CREATE POLICY "Users can view own role" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admin can manage all roles" ON public.user_roles
FOR ALL USING (public.is_admin());

CREATE POLICY "Users can create own role" ON public.user_roles
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (
    public.is_admin() OR 
    (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('admin@admin.com', 'kasir@kasir.com')
  )
);

-- Children table policies  
CREATE POLICY "Parents can manage own children" ON public.children
FOR ALL USING (auth.uid() = user_id OR public.is_cashier());

-- Orders table policies
CREATE POLICY "Users can view own orders" ON public.orders
FOR SELECT USING (auth.uid() = user_id OR auth.uid() = created_by OR public.is_cashier());

CREATE POLICY "Users can create orders" ON public.orders
FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = created_by);

CREATE POLICY "Users can update own orders" ON public.orders
FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = created_by OR public.is_cashier());

CREATE POLICY "Admin can delete orders" ON public.orders
FOR DELETE USING (public.is_admin());

-- Order items table policies
CREATE POLICY "Users can manage order items" ON public.order_items
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND (orders.user_id = auth.uid() OR orders.created_by = auth.uid() OR public.is_cashier())
  )
);

-- Menu items table policies
CREATE POLICY "Everyone can view menu items" ON public.menu_items
FOR SELECT USING (true);

CREATE POLICY "Admin can manage menu items" ON public.menu_items
FOR ALL USING (public.is_admin());

-- Categories table policies
CREATE POLICY "Everyone can view categories" ON public.categories
FOR SELECT USING (true);

CREATE POLICY "Admin can manage categories" ON public.categories
FOR ALL USING (public.is_admin());

-- Order schedules table policies
CREATE POLICY "Everyone can view schedules" ON public.order_schedules
FOR SELECT USING (true);

CREATE POLICY "Admin can manage schedules" ON public.order_schedules
FOR ALL USING (public.is_admin());

-- Payments table policies
CREATE POLICY "Users can view related payments" ON public.payments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = payments.order_id 
    AND (orders.user_id = auth.uid() OR orders.created_by = auth.uid())
  ) OR public.is_cashier()
);

CREATE POLICY "Cashier can manage payments" ON public.payments
FOR ALL USING (public.is_cashier());

-- Cash payments table policies
CREATE POLICY "Cashier can manage cash payments" ON public.cash_payments
FOR ALL USING (public.is_cashier());

-- Students table policies
CREATE POLICY "Everyone can view students" ON public.students
FOR SELECT USING (true);

CREATE POLICY "Admin can manage students" ON public.students
FOR ALL USING (public.is_admin());

-- Classes table policies
CREATE POLICY "Everyone can view active classes" ON public.classes
FOR SELECT USING (is_active = true OR public.is_admin());

CREATE POLICY "Admin can manage classes" ON public.classes
FOR ALL USING (public.is_admin());

-- System settings table policies
CREATE POLICY "Everyone can view system settings" ON public.system_settings
FOR SELECT USING (true);

CREATE POLICY "Admin can manage system settings" ON public.system_settings
FOR ALL USING (public.is_admin());

-- Batch orders table policies
CREATE POLICY "Users can view related batch orders" ON public.batch_orders
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = batch_orders.order_id 
    AND (orders.user_id = auth.uid() OR orders.created_by = auth.uid())
  ) OR public.is_cashier()
);

CREATE POLICY "Cashier can manage batch orders" ON public.batch_orders
FOR ALL USING (public.is_cashier());
