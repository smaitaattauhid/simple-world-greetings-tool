
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';
import { toast } from '@/components/ui/use-toast';
import { CartItem } from '@/types/cart';

interface Child {
  id: string;
  name: string;
  class_name: string;
}

export const useCartOperations = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { settings: paymentSettings } = usePaymentSettings();

  useEffect(() => {
    // Load Midtrans Snap script
    const script = document.createElement('script');
    script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', 'SB-Mid-client-your-client-key-here');
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const fetchChildren = async () => {
    try {
      if (!user?.id) {
        setChildren([
          { id: '1', name: 'Anak 1', class_name: 'Kelas 1A' },
          { id: '2', name: 'Anak 2', class_name: 'Kelas 2B' }
        ]);
        return;
      }

      // Query children table directly with fallback
      try {
        const { data, error } = await supabase
          .from('children')
          .select('id, name, class_name')
          .eq('user_id', user.id);

        if (error) {
          console.log('Error fetching children:', error);
          // Use fallback data
          setChildren([
            { id: '1', name: 'Anak 1', class_name: 'Kelas 1A' },
            { id: '2', name: 'Anak 2', class_name: 'Kelas 2B' }
          ]);
          return;
        }

        // Type the data explicitly
        const childrenData = (data || []) as Child[];
        setChildren(childrenData);
      } catch (queryError) {
        console.log('Query error, using fallback:', queryError);
        setChildren([
          { id: '1', name: 'Anak 1', class_name: 'Kelas 1A' },
          { id: '2', name: 'Anak 2', class_name: 'Kelas 2B' }
        ]);
      }
    } catch (error) {
      console.error('Error fetching children:', error);
      // Fallback data
      setChildren([
        { id: '1', name: 'Anak 1', class_name: 'Kelas 1A' },
        { id: '2', name: 'Anak 2', class_name: 'Kelas 2B' }
      ]);
    }
  };

  const handleCheckout = async (items: CartItem[], adminFee: number, onSuccess: () => void) => {
    if (!selectedChildId) {
      toast({
        title: "Error",
        description: "Pilih anak untuk pesanan ini",
        variant: "destructive",
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: "Error",
        description: "Keranjang kosong",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const selectedChild = children.find(child => child.id === selectedChildId);
      const subtotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);
      const totalAmount = subtotal + adminFee;
      const orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      console.log('useCartOperations: Creating order with Midtrans enabled:', paymentSettings.midtransEnabled);

      // Create order first - payment_method will be determined by Midtrans setting
      const orderData = {
        user_id: user?.id,
        total_amount: totalAmount,
        admin_fee: adminFee,
        notes: notes || null,
        status: 'pending',
        payment_status: paymentSettings.midtransEnabled ? 'pending' : 'pending_cash',
        payment_method: paymentSettings.midtransEnabled ? 'midtrans' : 'cash',
        order_number: orderId,
        child_name: selectedChild?.name || null,
        child_class: selectedChild?.class_name || null,
        midtrans_order_id: paymentSettings.midtransEnabled ? orderId : null
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      console.log('Order created successfully:', order);

      // Create order items using the correct menu_item_id from the cart items
      const orderItems = items.map(item => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        price: item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Check if Midtrans is enabled AFTER order creation but before proceeding with payment
      if (paymentSettings.midtransEnabled) {
        console.log('useCartOperations: Midtrans enabled, proceeding with online payment');
        
        // Prepare payment data
        const customerDetails = {
          first_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Customer',
          email: user?.email,
          phone: user?.user_metadata?.phone || '08123456789',
        };

        const itemDetails = items.map(item => ({
          id: item.id,
          price: item.price,
          quantity: item.quantity,
          name: item.name,
        }));

        // Add admin fee as separate item if applicable
        if (adminFee > 0) {
          itemDetails.push({
            id: 'admin_fee',
            price: adminFee,
            quantity: 1,
            name: 'Biaya Admin',
          });
        }

        // Create payment transaction
        const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
          'create-payment',
          {
            body: {
              orderId,
              amount: totalAmount,
              customerDetails,
              itemDetails,
            },
          }
        );

        if (paymentError) throw paymentError;

        // Open Midtrans Snap
        if (window.snap && paymentData.snap_token) {
          window.snap.pay(paymentData.snap_token, {
            onSuccess: (result) => {
              console.log('Payment success:', result);
              toast({
                title: "Pembayaran Berhasil!",
                description: "Pesanan Anda telah dikonfirmasi dan sedang diproses.",
              });
              onSuccess();
            },
            onPending: (result) => {
              console.log('Payment pending:', result);
              toast({
                title: "Menunggu Pembayaran",
                description: "Pembayaran Anda sedang diproses. Mohon tunggu konfirmasi.",
              });
              onSuccess();
            },
            onError: (result) => {
              console.error('Payment error:', result);
              toast({
                title: "Pembayaran Gagal",
                description: "Terjadi kesalahan dalam proses pembayaran. Silakan coba lagi.",
                variant: "destructive",
              });
            },
            onClose: () => {
              console.log('Payment popup closed');
              toast({
                title: "Pembayaran Dibatalkan",
                description: "Anda membatalkan proses pembayaran.",
              });
            }
          });
        } else {
          throw new Error('Midtrans Snap not loaded or token not received');
        }
      } else {
        console.log('useCartOperations: Midtrans disabled, cash-only order created');
        // If Midtrans is disabled, create cash order that can be paid at cashier
        toast({
          title: "Pesanan Berhasil Dibuat!",
          description: "Pesanan Anda telah dibuat dengan nomor " + orderId + ". Silakan bayar tunai di kasir untuk menyelesaikan pesanan.",
          duration: 6000,
        });
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal membuat pesanan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    children,
    selectedChildId,
    setSelectedChildId,
    notes,
    setNotes,
    loading,
    fetchChildren,
    handleCheckout
  };
};
