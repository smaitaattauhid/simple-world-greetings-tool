
-- Create helper function to check special admin emails
CREATE OR REPLACE FUNCTION public.is_special_admin_email()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'admin@admin.com',
    false
  );
$$;

-- Create helper function to check special cashier emails  
CREATE OR REPLACE FUNCTION public.is_special_cashier_email()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('kasir@kasir.com', 'admin@admin.com'),
    false
  );
$$;

-- Update user_roles policies to allow special emails
DROP POLICY IF EXISTS optimized_insert_policy ON public.user_roles;
CREATE POLICY optimized_insert_policy ON public.user_roles
FOR INSERT 
WITH CHECK (
  -- Allow if user has admin role in JWT claims
  (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'admin'::text)
  OR 
  -- Allow special admin email to insert their own role
  (is_special_admin_email() AND user_id = auth.uid())
  OR
  -- Allow special cashier email to insert their own role  
  (is_special_cashier_email() AND user_id = auth.uid())
);

DROP POLICY IF EXISTS optimized_update_policy ON public.user_roles;
CREATE POLICY optimized_update_policy ON public.user_roles
FOR UPDATE 
USING (
  -- Allow if user owns the record OR has admin role
  (auth.uid() = user_id) 
  OR 
  (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'admin'::text)
  OR
  -- Allow special emails to update their own roles
  (is_special_admin_email() AND user_id = auth.uid())
  OR
  (is_special_cashier_email() AND user_id = auth.uid())
)
WITH CHECK (
  -- Same conditions for the updated values
  (auth.uid() = user_id) 
  OR 
  (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'admin'::text)
  OR
  (is_special_admin_email() AND user_id = auth.uid())
  OR
  (is_special_cashier_email() AND user_id = auth.uid())
);

-- Update profiles INSERT policy to allow special emails to create their profile
ALTER POLICY optimized_select_policy ON public.profiles 
TO public USING (
  -- Allow user to see their own profile
  (auth.uid() = id)
  OR
  -- Allow admin to see all profiles
  (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'admin'::text)
);

-- Add INSERT policy for profiles (was missing)
DROP POLICY IF EXISTS optimized_insert_policy ON public.profiles;
CREATE POLICY optimized_insert_policy ON public.profiles
FOR INSERT 
WITH CHECK (
  -- Allow user to insert their own profile
  (auth.uid() = id)
  OR 
  -- Allow admin to insert any profile
  (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'admin'::text)
);
