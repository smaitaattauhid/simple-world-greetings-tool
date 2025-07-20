
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ShoppingCart } from 'lucide-react';
import { CartItem } from '@/types/cart';
import { useCartOperations } from '@/hooks/useCartOperations';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';
import CartItemList from '@/components/cart/CartItemList';
import CheckoutForm from '@/components/cart/CheckoutForm';

declare global {
  interface Window {
    snap: {
      pay: (token: string, options?: {
        onSuccess?: (result: any) => void;
        onPending?: (result: any) => void;
        onError?: (result: any) => void;
        onClose?: () => void;
      }) => void;
    };
  }
}

interface CartProps {
  items: CartItem[];
  onUpdateCart: (items: CartItem[]) => void;
}

const Cart = ({ items, onUpdateCart }: CartProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { settings: paymentSettings, loading: paymentSettingsLoading, calculateAdminFee, refetch: refetchPaymentSettings } = usePaymentSettings();
  const {
    children,
    selectedChildId,
    setSelectedChildId,
    notes,
    setNotes,
    loading,
    fetchChildren,
    handleCheckout
  } = useCartOperations();

  useEffect(() => {
    if (isOpen) {
      fetchChildren();
      // Force refresh payment settings when cart opens
      refetchPaymentSettings();
    }
  }, [isOpen, refetchPaymentSettings]);

  // Log payment settings for debugging with more detail
  useEffect(() => {
    console.log('Cart: Payment settings updated:', paymentSettings);
    console.log('Cart: Midtrans enabled?', paymentSettings.midtransEnabled);
    console.log('Cart: Payment settings loading?', paymentSettingsLoading);
  }, [paymentSettings, paymentSettingsLoading]);

  // Force refresh every time cart dialog opens
  useEffect(() => {
    if (isOpen) {
      console.log('Cart: Dialog opened, forcing payment settings refresh');
      setTimeout(() => {
        refetchPaymentSettings();
      }, 100);
    }
  }, [isOpen, refetchPaymentSettings]);

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity === 0) {
      onUpdateCart(items.filter(item => item.id !== itemId));
    } else {
      onUpdateCart(items.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      ));
    }
  };

  const removeItem = (itemId: string) => {
    onUpdateCart(items.filter(item => item.id !== itemId));
  };

  const getSubtotal = () => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const onCheckout = async () => {
    const subtotal = getSubtotal();
    // When Midtrans is disabled, don't calculate admin fee for parent orders
    const adminFee = paymentSettings.midtransEnabled ? calculateAdminFee(subtotal, 'midtrans') : 0;
    
    console.log('Cart: Checkout with settings:', {
      midtransEnabled: paymentSettings.midtransEnabled,
      subtotal,
      adminFee
    });
    
    await handleCheckout(items, adminFee, () => {
      // Clear cart and close dialog
      onUpdateCart([]);
      setIsOpen(false);
      setSelectedChildId('');
      setNotes('');
    });
  };

  if (items.length === 0) {
    return null;
  }

  const subtotal = getSubtotal();
  // Show admin fee only when Midtrans is enabled
  const adminFee = paymentSettings.midtransEnabled ? calculateAdminFee(subtotal, 'midtrans') : 0;
  const totalWithFee = subtotal + adminFee;
  const canCheckout = selectedChildId && children.length > 0;

  // Show loading price if payment settings are still loading
  const displayTotal = paymentSettingsLoading ? subtotal : totalWithFee;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="fixed bottom-4 right-4 rounded-full shadow-lg bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 z-50"
        >
          <ShoppingCart className="h-5 w-5 mr-2" />
          {getTotalItems()} item • {formatPrice(displayTotal)}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keranjang Belanja</DialogTitle>
          <DialogDescription>
            Review pesanan Anda dan pilih anak untuk pengiriman
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cart Items */}
          <CartItemList
            items={items}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            formatPrice={formatPrice}
          />

          {/* Checkout Form */}
          <CheckoutForm
            children={children}
            selectedChildId={selectedChildId}
            onChildSelect={setSelectedChildId}
            notes={notes}
            onNotesChange={setNotes}
          />

          {/* Order Summary */}
          <div className="border-t pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              
              {/* Only show admin fee if Midtrans is enabled and fee > 0 */}
              {paymentSettings.midtransEnabled && adminFee > 0 && (
                <div className="flex justify-between text-sm text-orange-600">
                  <span>Biaya Admin ({(paymentSettings.adminFeePercentage * 100).toFixed(2)}%):</span>
                  <span>{formatPrice(adminFee)}</span>
                </div>
              )}
              
              <div className="flex justify-between font-semibold text-lg border-t pt-2">
                <span>Total:</span>
                <span className="text-orange-600">
                  {formatPrice(totalWithFee)}
                </span>
              </div>
            </div>

            {/* Payment Method Information with refresh indicator */}
            {paymentSettingsLoading ? (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                  <p className="text-sm text-gray-600">Memuat informasi pembayaran...</p>
                </div>
              </div>
            ) : paymentSettings.midtransEnabled ? (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>✅ Metode Pembayaran:</strong> Midtrans (Online) atau Tunai di Kasir
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  * Pembayaran tunai tidak dikenakan biaya admin
                </p>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  <strong>💰 Metode Pembayaran:</strong> Pembayaran Tunai di Kasir
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  * Pesanan akan dibuat dan dapat dibayar tunai di kasir
                </p>
                <p className="text-xs text-yellow-600">
                  * Pembayaran online sedang tidak tersedia
                </p>
              </div>
            )}

            <Button 
              onClick={onCheckout}
              disabled={loading || !canCheckout || paymentSettingsLoading}
              className="w-full mt-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              size="lg"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Memproses...
                </div>
              ) : paymentSettingsLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Memuat...
                </div>
              ) : paymentSettings.midtransEnabled ? (
                `Checkout ${formatPrice(totalWithFee)}`
              ) : (
                `Buat Pesanan Tunai ${formatPrice(subtotal)}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Cart;
