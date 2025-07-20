
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { UserRole, ProfileUser, ProfileData } from '@/types/userManagement';

export const useUserManagement = () => {
  const [profileUsers, setProfileUsers] = useState<ProfileUser[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsersAndRoles();
  }, []);

  const fetchUsersAndRoles = async () => {
    try {
      console.log('Fetching users and roles...');
      
      // Fetch from profiles table
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, created_at, role');
        
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }
      
      console.log('Profiles data:', profilesData);
      
      // Fetch user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        throw rolesError;
      }
      
      console.log('Roles data:', rolesData);
      
      // Convert profiles data to ProfileUser format
      let combinedUsers: ProfileUser[] = [];
      
      if (profilesData && Array.isArray(profilesData)) {
        combinedUsers = (profilesData as ProfileData[]).map((profile: ProfileData) => ({
          id: profile.id,
          full_name: profile.full_name,
          created_at: profile.created_at,
          role: profile.role,
          email: null // We can't access emails without admin API, so we'll show user ID instead
        }));
      }
      
      // Add users that exist in user_roles but not in profiles
      if (rolesData && Array.isArray(rolesData)) {
        const existingProfileIds = combinedUsers.map(user => user.id);
        const missingUsers = rolesData
          .filter(role => !existingProfileIds.includes(role.user_id))
          .map(role => ({
            id: role.user_id,
            full_name: null,
            created_at: new Date().toISOString(),
            role: role.role,
            email: null
          }));
        
        combinedUsers = [...combinedUsers, ...missingUsers];
        console.log('Combined users with missing profiles:', combinedUsers);
      }
      
      setProfileUsers(combinedUsers);
      setUserRoles(rolesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data pengguna. Pastikan Anda memiliki akses admin.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      console.log('Updating role for user:', userId, 'to:', newRole);
      
      // First, try to update existing role
      const { data: existingRole, error: checkError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing role:', checkError);
        throw checkError;
      }

      let roleError;
      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);
        roleError = error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });
        roleError = error;
      }

      if (roleError) {
        console.error('Error updating user_roles:', roleError);
        throw roleError;
      }

      // Update profiles table as well
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (profileError) {
        console.error('Error updating profiles:', profileError);
        // Don't throw here as the main role update succeeded
        console.warn('Profile role update failed but user_roles was updated successfully');
      }

      toast({
        title: "Berhasil",
        description: `Role pengguna berhasil diubah menjadi ${newRole}`,
      });

      // Refresh data
      await fetchUsersAndRoles();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Gagal mengubah role pengguna. Periksa izin admin Anda.",
        variant: "destructive",
      });
    }
  };

  const getUserRole = (userId: string) => {
    const userRole = userRoles.find(role => role.user_id === userId);
    const profileRole = profileUsers.find(user => user.id === userId)?.role;
    return userRole?.role || profileRole || 'parent';
  };

  return {
    profileUsers,
    loading,
    updateUserRole,
    getUserRole
  };
};
