
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useUserRole = () => {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    console.log('useUserRole: user changed', user?.id, user?.email);
    if (user?.id) {
      fetchUserRole();
    } else {
      setRole(null);
      setLoading(false);
    }
  }, [user]);

  const fetchUserRole = async () => {
    if (!user?.id) {
      console.log('useUserRole: No user ID available');
      setLoading(false);
      return;
    }

    try {
      console.log('useUserRole: Fetching role for user', user.id, user.email);
      
      // First check for special admin/cashier emails as primary source
      const adminEmails = ['admin@admin.com'];
      const cashierEmails = ['kasir@kasir.com'];
      
      let determinedRole = 'parent'; // default role
      
      if (user.email && adminEmails.includes(user.email)) {
        console.log('useUserRole: Setting admin role for known admin email');
        determinedRole = 'admin';
      } else if (user.email && cashierEmails.includes(user.email)) {
        console.log('useUserRole: Setting cashier role for known cashier email');
        determinedRole = 'cashier';
      } else {
        // Try to get from user_roles table
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        console.log('useUserRole: Role data from user_roles:', roleData, 'Error:', roleError);

        if (roleData?.role) {
          console.log('useUserRole: Setting role from user_roles:', roleData.role);
          determinedRole = roleData.role;
        } else if (roleError?.code === 'PGRST116') {
          // No role found, create default parent role
          console.log('useUserRole: No role found, creating default parent role');
          await createUserRole('parent');
          determinedRole = 'parent';
        } else {
          // Fallback: try to get from profiles table
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          console.log('useUserRole: Profile data:', profileData, 'Error:', profileError);

          if (profileData?.role) {
            console.log('useUserRole: Setting role from profiles:', profileData.role);
            determinedRole = profileData.role;
          }
        }
      }

      // Set the role in state
      setRole(determinedRole);

      // For special emails, ensure they have the correct role in database
      if ((user.email === 'admin@admin.com' && determinedRole === 'admin') ||
          (user.email === 'kasir@kasir.com' && determinedRole === 'cashier')) {
        await ensureSpecialEmailRole(determinedRole);
      }

    } catch (error) {
      console.error('useUserRole: Error fetching user role:', error);
      
      // Emergency fallback for known emails
      if (user.email === 'admin@admin.com') {
        console.log('useUserRole: Emergency fallback to admin for admin@admin.com');
        setRole('admin');
        await ensureSpecialEmailRole('admin');
      } else if (user.email === 'kasir@kasir.com') {
        console.log('useUserRole: Emergency fallback to cashier for kasir@kasir.com');
        setRole('cashier');
        await ensureSpecialEmailRole('cashier');
      } else {
        console.log('useUserRole: Emergency fallback to parent for regular user');
        setRole('parent');
        await createUserRole('parent');
      }
    } finally {
      setLoading(false);
    }
  };

  const createUserRole = async (userRole: string) => {
    try {
      console.log('useUserRole: Creating role for user:', user?.id, 'role:', userRole);
      
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: user?.id, role: userRole });

      if (insertError) {
        console.error('useUserRole: Error creating user role:', insertError);
        // Don't throw error, just log it since the role is already set in state
      } else {
        console.log('useUserRole: Successfully created user role:', userRole);
      }

      // Also try to update profiles table for consistency (ignore errors)
      try {
        await supabase
          .from('profiles')
          .update({ role: userRole })
          .eq('id', user?.id);
      } catch (profileError) {
        console.log('useUserRole: Could not update profile role (not critical):', profileError);
      }

    } catch (error) {
      console.error('useUserRole: Error in createUserRole:', error);
    }
  };

  const ensureSpecialEmailRole = async (userRole: string) => {
    try {
      console.log('useUserRole: Ensuring special email role:', userRole, 'for user:', user?.email);
      
      // Check if role exists
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (existingRole) {
        // Update existing role if different
        if (existingRole.role !== userRole) {
          await supabase
            .from('user_roles')
            .update({ role: userRole })
            .eq('user_id', user?.id);
          console.log('useUserRole: Updated existing role to:', userRole);
        }
      } else {
        // Create new role
        await supabase
          .from('user_roles')
          .insert({ user_id: user?.id, role: userRole });
        console.log('useUserRole: Created new role:', userRole);
      }

      // Also update profiles table for consistency (ignore errors)
      try {
        await supabase
          .from('profiles')
          .update({ role: userRole })
          .eq('id', user?.id);
      } catch (profileError) {
        console.log('useUserRole: Could not update profile role (not critical):', profileError);
      }

    } catch (error) {
      console.error('useUserRole: Error in ensureSpecialEmailRole:', error);
    }
  };

  console.log('useUserRole: Current state - role:', role, 'loading:', loading, 'isAdmin:', role === 'admin', 'isCashier:', role === 'cashier');

  return { 
    role, 
    loading, 
    isAdmin: role === 'admin',
    isCashier: role === 'cashier' || role === 'admin' // Admin can also act as cashier
  };
};
