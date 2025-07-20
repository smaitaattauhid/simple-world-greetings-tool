
-- First, create a security definer function to get user role without recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

-- Create new policies using the security definer function
CREATE POLICY "Users can view own role"
  ON public.user_roles 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles 
  FOR SELECT 
  USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can insert roles"
  ON public.user_roles 
  FOR INSERT 
  WITH CHECK (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can update roles"
  ON public.user_roles 
  FOR UPDATE 
  USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete roles"
  ON public.user_roles 
  FOR DELETE 
  USING (public.get_current_user_role() = 'admin');

-- Also fix the profiles table policies to use the same function
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
  ON public.profiles 
  FOR SELECT 
  USING (
    (auth.uid() = id) OR 
    (public.get_current_user_role() = 'admin')
  );

CREATE POLICY "Admins can update all profiles"
  ON public.profiles 
  FOR UPDATE 
  USING (
    (auth.uid() = id) OR 
    (public.get_current_user_role() = 'admin')
  );
