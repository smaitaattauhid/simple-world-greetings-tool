
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentSettings {
  midtransEnabled: boolean;
  adminFeePercentage: number;
}

export const usePaymentSettings = () => {
  const [settings, setSettings] = useState<PaymentSettings>({
    midtransEnabled: false, // Start with false as default for safety
    adminFeePercentage: 0.7 // Updated to 0.7%
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
        adminFeePercentage: parseFloat(settingsMap.midtrans_admin_fee_percentage || '0.7') // Updated default to 0.7%
      };
      
      console.log('usePaymentSettings: New settings applied:', newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error('usePaymentSettings: Error fetching payment settings:', error);
      // Keep safe defaults on error
      setSettings({
        midtransEnabled: false,
        adminFeePercentage: 0.7 // Updated default to 0.7%
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    
    // Set up real-time subscription to system_settings changes with aggressive refresh
    console.log('usePaymentSettings: Setting up real-time subscription');
    const channelName = `system_settings_changes_${Date.now()}_${Math.random()}`;
    const subscription = supabase
      .channel(channelName)
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
          // Force immediate refetch with a small delay to ensure DB consistency
          setTimeout(() => {
            console.log('usePaymentSettings: Force refetching after real-time update');
            fetchSettings();
          }, 100);
        }
      )
      .subscribe((status) => {
        console.log('usePaymentSettings: Subscription status:', status);
      });

    // Also poll every 5 seconds as backup
    const pollInterval = setInterval(() => {
      console.log('usePaymentSettings: Polling for settings updates');
      fetchSettings();
    }, 5000);

    return () => {
      console.log('usePaymentSettings: Cleaning up subscription and polling');
      subscription.unsubscribe();
      clearInterval(pollInterval);
    };
  }, []);

  // Legacy method for backward compatibility
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

  // Updated QRIS admin fee calculation with 0.7% for small transactions
  const calculateQRISAdminFee = (amount: number, paymentMethod: 'qris' | 'cash' = 'qris') => {
    // Only calculate admin fee if Midtrans is enabled and payment method is QRIS
    if (paymentMethod === 'cash' || !settings.midtransEnabled) {
      console.log('usePaymentSettings: No admin fee - cash payment or Midtrans disabled');
      return 0;
    }

    let fee = 0;
    
    if (amount < 628000) {
      // If total transaction is less than 628,000, admin fee is 0.7% of total
      fee = Math.round(amount * 0.007); // 0.7%
    } else {
      // If total transaction is 628,000 or more, admin fee is fixed at Rp 4,400
      fee = 4400;
    }

    console.log('usePaymentSettings: Calculated QRIS admin fee:', fee, 'for amount:', amount);
    return fee;
  };

  const calculateTotalWithFee = (amount: number, paymentMethod: 'midtrans' | 'cash' = 'midtrans') => {
    const adminFee = calculateAdminFee(amount, paymentMethod);
    return amount + adminFee;
  };

  // New method for QRIS total calculation
  const calculateQRISTotalWithFee = (amount: number, paymentMethod: 'qris' | 'cash' = 'qris') => {
    const adminFee = calculateQRISAdminFee(amount, paymentMethod);
    return amount + adminFee;
  };

  return {
    settings,
    loading,
    calculateAdminFee,
    calculateQRISAdminFee,
    calculateTotalWithFee,
    calculateQRISTotalWithFee,
    refetch: fetchSettings
  };
};
