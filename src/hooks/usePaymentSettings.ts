import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentSettings {
  midtransEnabled: boolean;
  adminFeePercentage: number;
}

export const usePaymentSettings = () => {
  const [settings, setSettings] = useState<PaymentSettings>({
    midtransEnabled: false, // Start with false as default for safety
    adminFeePercentage: 0.07
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      console.log('usePaymentSettings: Fetching settings...');
      setLoading(true);
      
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['midtrans_enabled', 'midtrans_admin_fee_percentage']);

      if (error && error.code !== 'PGRST116') {
        console.error('usePaymentSettings: Error fetching payment settings:', error);
        return;
      }

      console.log('usePaymentSettings: Raw data:', data);

      const settingsMap = (data || []).reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, string>);

      console.log('usePaymentSettings: Settings map:', settingsMap);

      const newSettings = {
        midtransEnabled: settingsMap.midtrans_enabled === 'true',
        adminFeePercentage: parseFloat(settingsMap.midtrans_admin_fee_percentage || '0.07')
      };
      
      console.log('usePaymentSettings: New settings applied:', newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error('usePaymentSettings: Error fetching payment settings:', error);
      // Keep safe defaults on error
      setSettings({
        midtransEnabled: false,
        adminFeePercentage: 0.07
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    
    // Set up real-time subscription to system_settings changes
    console.log('usePaymentSettings: Setting up real-time subscription');
    const subscription = supabase
      .channel(`system_settings_changes_${Date.now()}`) // Unique channel name
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: 'key=in.(midtrans_enabled,midtrans_admin_fee_percentage)'
        },
        (payload) => {
          console.log('usePaymentSettings: Real-time update received:', payload);
          // Always refetch to ensure we have the latest data
          fetchSettings();
        }
      )
      .subscribe((status) => {
        console.log('usePaymentSettings: Subscription status:', status);
      });

    return () => {
      console.log('usePaymentSettings: Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, []);

  const calculateAdminFee = (amount: number, paymentMethod: 'midtrans' | 'cash' = 'midtrans') => {
    // Only calculate admin fee if Midtrans is enabled and payment method is midtrans
    if (paymentMethod === 'cash' || !settings.midtransEnabled) {
      console.log('usePaymentSettings: No admin fee - cash payment or Midtrans disabled');
      return 0;
    }
    const fee = Math.round(amount * settings.adminFeePercentage);
    console.log('usePaymentSettings: Calculated admin fee:', fee, 'for amount:', amount);
    return fee;
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
