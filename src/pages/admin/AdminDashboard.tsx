
import { useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { CategoryManager } from '@/components/admin/CategoryManager';
import { MenuManager } from '@/components/admin/MenuManager';
import { OrderManager } from '@/components/admin/OrderManager';
import { AdminStats } from '@/components/admin/AdminStats';
import { RecentOrders } from '@/components/admin/RecentOrders';
import { PopularItems } from '@/components/admin/PopularItems';
import { PaymentSettings } from '@/components/admin/PaymentSettings';
import { Settings, ShoppingBag, Package, BarChart3, CreditCard } from 'lucide-react';

const AdminDashboard = () => {
  const { role, loading, isAdmin } = useUserRole();

  console.log('AdminDashboard: Current role state', { role, loading, isAdmin });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!isAdmin) {
    console.log('AdminDashboard: Access denied - not admin', { role, isAdmin });
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <Card>
          <CardContent className="p-8">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Akses Ditolak</h1>
            <p className="text-gray-600 mb-4">
              Anda tidak memiliki izin untuk mengakses dashboard admin.
            </p>
            <p className="text-sm text-gray-500">
              Role saat ini: {role || 'Tidak diketahui'}
            </p>
            <p className="text-sm text-gray-500">
              Silakan hubungi administrator jika Anda yakin ini adalah kesalahan.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
          Admin Dashboard
        </h1>
        <p className="text-gray-600 mt-2">Kelola menu, pesanan, dan kategori restoran</p>
        <p className="text-sm text-gray-500 mt-1">Role: {role}</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-[750px]">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 size={16} />
            Overview
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ShoppingBag size={16} />
            Orders
          </TabsTrigger>
          <TabsTrigger value="menu" className="flex items-center gap-2">
            <Package size={16} />
            Menu
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Settings size={16} />
            Categories
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard size={16} />
            Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <AdminStats />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentOrders />
            <PopularItems />
          </div>
        </TabsContent>

        <TabsContent value="orders">
          <OrderManager />
        </TabsContent>

        <TabsContent value="menu">
          <MenuManager />
        </TabsContent>

        <TabsContent value="categories">
          <CategoryManager />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
