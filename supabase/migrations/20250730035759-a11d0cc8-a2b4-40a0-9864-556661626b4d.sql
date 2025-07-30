
-- Drop existing policy for user_roles insert
DROP POLICY IF EXISTS "Users can create own role" ON public.user_roles;

-- Create new policy that allows users to create their own role
CREATE POLICY "Users can create own role" ON public.user_roles
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (
    -- Admin can create any role
    public.is_admin() OR 
    -- Special emails can create their own role
    (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('admin@admin.com', 'kasir@kasir.com') OR
    -- Regular users can only create 'parent' role for themselves
    role = 'parent'
  )
);

-- Also create a policy for updating roles
CREATE POLICY "Users can update own role" ON public.user_roles
FOR UPDATE USING (
  auth.uid() = user_id AND (
    -- Admin can update any role
    public.is_admin() OR 
    -- Special emails can update their own role  
    (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('admin@admin.com', 'kasir@kasir.com')
  )
);
