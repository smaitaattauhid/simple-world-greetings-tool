
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { ProfileUser, UserRole } from '@/types/userManagement';

export const useUserManagement = () => {
  const [profileUsers, setProfileUsers] = useState<ProfileUser[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsersAndRoles();
  }, []);

  const fetchUsersAndRoles = async () => {
    setLoading(true);
    try {
      console.log('useUserManagement: Fetching users and roles...');
      
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('useUserManagement: Error fetching profiles:', profilesError);
        throw profilesError;
      }

      console.log('useUserManagement: Profiles fetched:', profiles?.length || 0);

      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) {
        console.error('useUserManagement: Error fetching user roles:', rolesError);
      }

      console.log('useUserManagement: User roles fetched:', roles?.length || 0);

      // Get auth users to get email information (admin only)
      let authUsers = null;
      try {
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
        if (!authError) {
          authUsers = authData;
        } else {
          console.warn('useUserManagement: Could not fetch auth users (admin required):', authError);
        }
      } catch (error) {
        console.warn('useUserManagement: Auth admin access not available:', error);
      }

      console.log('useUserManagement: Auth users fetched:', authUsers?.users?.length || 0);

      // Combine profile data with auth data
      const enrichedProfiles = profiles?.map(profile => {
        const authUser = authUsers?.users?.find(au => au.id === profile.id);
        return {
          ...profile,
          email: authUser?.email || null
        };
      }) || [];

      setProfileUsers(enrichedProfiles);
      setUserRoles(roles || []);
      
    } catch (error) {
      console.error('useUserManagement: Error in fetchUsersAndRoles:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data pengguna. Pastikan Anda memiliki akses admin.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getUserRole = (userId: string): string => {
    // First check user_roles table
    const userRole = userRoles.find(ur => ur.user_id === userId);
    if (userRole) {
      return userRole.role;
    }

    // Fallback to profiles table
    const profile = profileUsers.find(p => p.id === userId);
    if (profile?.role) {
      return profile.role;
    }

    // Check for special email addresses
    const user = profileUsers.find(p => p.id === userId);
    if (user?.email === 'admin@admin.com') {
      return 'admin';
    } else if (user?.email === 'kasir@kasir.com') {
      return 'cashier';
    }

    return 'parent';
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      console.log('useUserManagement: Updating role for user:', userId, 'to:', newRole);

      // Update or insert in user_roles table (primary source)
      const { data: existingRole, error: fetchError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (existingRole) {
        // Update existing role
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);

        if (updateError) {
          console.error('useUserManagement: Error updating user role:', updateError);
          throw updateError;
        }
      } else {
        // Insert new role
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });

        if (insertError) {
          console.error('useUserManagement: Error inserting user role:', insertError);
          throw insertError;
        }
      }

      // Also update in profiles table for consistency
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (profileError) {
        console.error('useUserManagement: Error updating profile role:', profileError);
        // Don't throw here as user_roles is the primary source
      }

      // Force the target user to refresh their session if they're currently logged in
      // This is done by updating their profile which should trigger a session refresh
      console.log('useUserManagement: Role updated successfully for user:', userId);

      toast({
        title: "Berhasil",
        description: `Role berhasil diubah ke ${newRole}. User mungkin perlu login ulang untuk melihat perubahan.`,
      });

      // Refresh data
      await fetchUsersAndRoles();
      
    } catch (error) {
      console.error('useUserManagement: Error updating user role:', error);
      toast({
        title: "Error",
        description: "Gagal mengubah role pengguna",
        variant: "destructive",
      });
    }
  };

  return {
    profileUsers,
    userRoles,
    loading,
    getUserRole,
    updateUserRole,
    refetch: fetchUsersAndRoles
  };
};
