
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentSettings {
  midtransEnabled: boolean;
  adminFeePercentage: number;
}

export const usePaymentSettings = () => {
  const [settings, setSettings] = useState<PaymentSettings>({
    midtransEnabled: true,
    adminFeePercentage: 0.07
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['midtrans_enabled', 'midtrans_admin_fee_percentage']);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const settingsMap = (data || []).reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, string>);

      setSettings({
        midtransEnabled: settingsMap.midtrans_enabled !== 'false',
        adminFeePercentage: parseFloat(settingsMap.midtrans_admin_fee_percentage || '0.07')
      });
    } catch (error) {
      console.error('Error fetching payment settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAdminFee = (amount: number, paymentMethod: 'midtrans' | 'cash' = 'midtrans') => {
    if (paymentMethod === 'cash') return 0;
    return Math.round(amount * settings.adminFeePercentage / 100);
  };

  const calculateTotalWithFee = (amount: number, paymentMethod: 'midtrans' | 'cash' = 'midtrans') => {
    const adminFee = calculateAdminFee(amount, paymentMethod);
    return amount + adminFee;
  };

  return {
    settings,
    loading,
    calculateAdminFee,
    calculateTotalWithFee,
    refetch: fetchSettings
  };
};
