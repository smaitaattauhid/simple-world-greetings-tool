
import { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/components/AuthProvider';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import MidtransScript from '@/components/MidtransScript';
import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
import Profile from '@/pages/Profile';
import Children from '@/pages/Children';
import Orders from '@/pages/Orders';
import BatchOrders from '@/pages/BatchOrders';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import OrderManagement from '@/pages/admin/OrderManagement';
import FoodManagement from '@/pages/admin/FoodManagement';
import UserManagement from '@/pages/admin/UserManagement';
import StudentManagement from '@/pages/admin/StudentManagement';
import { OrderRecap } from '@/pages/admin/OrderRecap';
import Reports from '@/pages/admin/Reports';
import ScheduleManagement from '@/pages/admin/ScheduleManagement';
import PopulateDailyMenus from '@/pages/admin/PopulateDailyMenus';
import CashierDashboard from '@/pages/cashier/CashierDashboard';
import CashierReports from '@/pages/cashier/CashierReports';
import NotFound from '@/pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// Security headers component
const SecurityHeaders = () => {
  useEffect(() => {
    // Add Content Security Policy
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.midtrans.com https://api.midtrans.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://ymfjbcyqgnokjyvezohk.supabase.co https://api.midtrans.com wss://ymfjbcyqgnokjyvezohk.supabase.co; frame-src 'self' https://app.midtrans.com;";
    document.head.appendChild(meta);

    // Add X-Frame-Options
    const frameOptions = document.createElement('meta');
    frameOptions.httpEquiv = 'X-Frame-Options';
    frameOptions.content = 'DENY';
    document.head.appendChild(frameOptions);

    // Add X-Content-Type-Options
    const contentType = document.createElement('meta');
    contentType.httpEquiv = 'X-Content-Type-Options';
    contentType.content = 'nosniff';
    document.head.appendChild(contentType);

    // Add Referrer-Policy
    const referrer = document.createElement('meta');
    referrer.name = 'referrer';
    referrer.content = 'strict-origin-when-cross-origin';
    document.head.appendChild(referrer);

    return () => {
      document.head.removeChild(meta);
      document.head.removeChild(frameOptions);
      document.head.removeChild(contentType);
      document.head.removeChild(referrer);
    };
  }, []);

  return null;
};

// Protected Route component
const ProtectedRoute = ({ children, allowedRoles = [] }: { children: React.ReactNode; allowedRoles?: string[] }) => {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles.length > 0 && role && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// App routes component
const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Index />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      } />
      <Route path="/children" element={
        <ProtectedRoute>
          <Children />
        </ProtectedRoute>
      } />
      <Route path="/orders" element={
        <ProtectedRoute>
          <Orders />
        </ProtectedRoute>
      } />
      <Route path="/batch-orders" element={
        <ProtectedRoute>
          <BatchOrders />
        </ProtectedRoute>
      } />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/orders" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <OrderManagement />
        </ProtectedRoute>
      } />
      <Route path="/admin/food-management" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <FoodManagement />
        </ProtectedRoute>
      } />
      <Route path="/admin/user-management" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <UserManagement />
        </ProtectedRoute>
      } />
      <Route path="/admin/student-management" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <StudentManagement />
        </ProtectedRoute>
      } />
      <Route path="/admin/recap" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <OrderRecap />
        </ProtectedRoute>
      } />
      <Route path="/admin/reports" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <Reports />
        </ProtectedRoute>
      } />
      <Route path="/admin/schedule" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <ScheduleManagement />
        </ProtectedRoute>
      } />
      <Route path="/admin/populate-menus" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <PopulateDailyMenus />
        </ProtectedRoute>
      } />
      
      {/* Cashier Routes */}
      <Route path="/cashier" element={
        <ProtectedRoute allowedRoles={['cashier', 'admin']}>
          <CashierDashboard />
        </ProtectedRoute>
      } />
      <Route path="/cashier/reports" element={
        <ProtectedRoute allowedRoles={['cashier', 'admin']}>
          <CashierReports />
        </ProtectedRoute>
      } />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <SecurityHeaders />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
            <MidtransScript />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
