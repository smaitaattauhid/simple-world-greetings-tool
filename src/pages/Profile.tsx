
import React from 'react';
import { ProfileForm } from '@/components/profile/ProfileForm';

const Profile = () => {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
          Profile Saya
        </h1>
        <p className="text-gray-600">Kelola informasi profile dan keamanan akun Anda</p>
      </div>

      <ProfileForm />
    </div>
  );
};

export default Profile;
