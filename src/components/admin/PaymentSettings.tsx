
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, CreditCard, Percent, QrCode } from 'lucide-react';

export const PaymentSettings = () => {
  const [midtransEnabled, setMidtransEnabled] = useState(true);
  const [adminFeePercentage, setAdminFeePercentage] = useState(0.7); // Updated to 0.7%
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      console.log('PaymentSettings: Fetching settings...');
      
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .in('key', ['midtrans_enabled', 'midtrans_admin_fee_percentage']);

      if (error && error.code !== 'PGRST116') {
        console.error('PaymentSettings: Error fetching settings:', error);
        throw error;
      }

      console.log('PaymentSettings: Fetched data:', data);

      const settingsMap = (data || []).reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, string>);

      console.log('PaymentSettings: Settings map:', settingsMap);

      setMidtransEnabled(settingsMap.midtrans_enabled === 'true');
      setAdminFeePercentage(parseFloat(settingsMap.midtrans_admin_fee_percentage || '0.7')); // Updated default to 0.7%
      
    } catch (error) {
      console.error('PaymentSettings: Error in fetchSettings:', error);
      toast({
        title: "Error",
        description: "Gagal memuat pengaturan pembayaran",
        variant: "destructive",
      });
    } finally {
      setLoadingSettings(false);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    try {
      console.log('PaymentSettings: Updating setting:', key, '=', value);
      
      // Use upsert instead of checking existence first
      const { error } = await supabase
        .from('system_settings')
        .upsert(
          {
            key,
            value,
            description: key === 'midtrans_enabled' 
              ? 'Enable/disable Midtrans QRIS payment method' 
              : 'Admin fee percentage for Midtrans QRIS payments',
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'key'
          }
        );

      console.log('PaymentSettings: Upsert result error:', error);

      if (error) {
        console.error('PaymentSettings: Database error:', error);
        throw error;
      }

      console.log('PaymentSettings: Successfully updated setting');
      
    } catch (error) {
      console.error('PaymentSettings: Error in updateSetting:', error);
      throw error;
    }
  };

  const handleMidtransToggle = async (enabled: boolean) => {
    console.log('PaymentSettings: Toggle called with:', enabled);
    setLoading(true);
    
    try {
      await updateSetting('midtrans_enabled', enabled.toString());
      setMidtransEnabled(enabled);
      
      toast({
        title: "Berhasil",
        description: `Pembayaran QRIS ${enabled ? 'diaktifkan' : 'dinonaktifkan'}`,
      });
      
      console.log('PaymentSettings: Toggle successful');
    } catch (error) {
      console.error('PaymentSettings: Toggle failed:', error);
      toast({
        title: "Error",
        description: "Gagal mengubah pengaturan QRIS. Silakan coba lagi.",
        variant: "destructive",
      });
      // Revert the toggle state on error
      setMidtransEnabled(!enabled);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminFeeUpdate = async () => {
    if (adminFeePercentage < 0 || adminFeePercentage > 10) {
      toast({
        title: "Error",
        description: "Biaya admin harus antara 0% dan 10%",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await updateSetting('midtrans_admin_fee_percentage', adminFeePercentage.toString());
      
      toast({
        title: "Berhasil",
        description: `Biaya admin diubah menjadi ${adminFeePercentage}%`,
      });
    } catch (error) {
      console.error('PaymentSettings: Admin fee update failed:', error);
      toast({
        title: "Error",
        description: "Gagal mengubah biaya admin. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingSettings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Pengaturan Pembayaran QRIS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          Pengaturan Pembayaran QRIS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QRIS Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center space-x-3">
            <QrCode className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="font-medium">Pembayaran QRIS</h3>
              <p className="text-sm text-gray-600">
                {midtransEnabled 
                  ? 'Orang tua dapat membayar melalui QRIS (Snap)'
                  : 'Hanya pembayaran tunai yang tersedia'
                }
              </p>
            </div>
          </div>
          <Switch
            checked={midtransEnabled}
            onCheckedChange={handleMidtransToggle}
            disabled={loading}
          />
        </div>

        {/* QRIS Admin Fee Structure */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center space-x-3 mb-4">
            <Percent className="h-5 w-5 text-green-600" />
            <div>
              <h3 className="font-medium">Struktur Biaya Admin QRIS</h3>
              <p className="text-sm text-gray-600">
                Biaya admin yang dikenakan untuk pembayaran QRIS
              </p>
            </div>
          </div>

          {/* QRIS Fee Structure Display */}
          <div className="bg-blue-50 p-4 rounded-lg mb-4">
            <h4 className="font-medium text-blue-800 mb-2">Struktur Biaya:</h4>
            <div className="text-sm text-blue-700 space-y-2">
              <div className="flex justify-between">
                <span>Transaksi &lt; Rp 628.000:</span>
                <span className="font-medium">0,7% dari total</span>
              </div>
              <div className="flex justify-between">
                <span>Transaksi ≥ Rp 628.000:</span>
                <span className="font-medium">Rp 4.400 (tetap)</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <Label htmlFor="admin-fee">Persentase untuk Transaksi Kecil (%)</Label>
              <Input
                id="admin-fee"
                type="number"
                min="0"
                max="10"
                step="0.01"
                value={adminFeePercentage}
                onChange={(e) => setAdminFeePercentage(parseFloat(e.target.value) || 0)}
                disabled={loading}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Default: 0,7% (hanya untuk transaksi &lt; Rp 628.000)
              </p>
            </div>
            <Button
              onClick={handleAdminFeeUpdate}
              disabled={loading}
              size="sm"
            >
              {loading ? 'Menyimpan...' : 'Update'}
            </Button>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">Informasi QRIS:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Pembayaran tunai tidak dikenakan biaya admin</li>
            <li>• Biaya admin QRIS otomatis dihitung berdasarkan total transaksi</li>
            <li>• Pembayaran dibatasi hanya ke QRIS (tidak ada metode lain)</li>
            <li>• Biaya transparan ditampilkan kepada pengguna sebelum bayar</li>
            <li>• Jika QRIS dinonaktifkan, hanya kasir yang dapat memproses pembayaran</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
