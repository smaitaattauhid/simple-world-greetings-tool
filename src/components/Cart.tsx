
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
  const { settings: paymentSettings, loading: paymentSettingsLoading, calculateQRISAdminFee, refetch: refetchPaymentSettings } = usePaymentSettings();
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
      refetchPaymentSettings();
    }
  }, [isOpen, refetchPaymentSettings]);

  // Log payment settings for debugging
  useEffect(() => {
    console.log('Cart: Payment settings:', paymentSettings);
    console.log('Cart: Midtrans enabled?', paymentSettings.midtransEnabled);
  }, [paymentSettings, paymentSettingsLoading]);

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
    const adminFee = paymentSettings.midtransEnabled ? calculateQRISAdminFee(subtotal, 'qris') : 0;
    
    console.log('Cart: Checkout - subtotal:', subtotal, 'adminFee:', adminFee, 'total:', subtotal + adminFee);
    
    await handleCheckout(items, adminFee, () => {
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
  const adminFee = paymentSettings.midtransEnabled ? calculateQRISAdminFee(subtotal, 'qris') : 0;
  const totalWithFee = subtotal + adminFee;
  const canCheckout = selectedChildId && children.length > 0;
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
              
              {/* Show QRIS admin fee calculation with updated 0.7% rate */}
              {paymentSettings.midtransEnabled && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-orange-600">
                    <span>Biaya Admin QRIS:</span>
                    <span>{adminFee > 0 ? `+${formatPrice(adminFee)}` : 'Gratis'}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {subtotal < 628000 
                      ? `• Transaksi < Rp 628.000: 0,7% dari ${formatPrice(subtotal)} = ${formatPrice(Math.round(subtotal * 0.007))}` 
                      : `• Transaksi ≥ Rp 628.000: Biaya tetap Rp 4.400`
                    }
                  </div>
                  <div className="text-xs text-blue-600">
                    Total yang akan dibayar via QRIS: <strong>{formatPrice(totalWithFee)}</strong>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between font-semibold text-lg border-t pt-2">
                <span>Total Pembayaran:</span>
                <span className="text-orange-600">
                  {formatPrice(totalWithFee)}
                </span>
              </div>
            </div>

            {/* Payment Method Information */}
            {paymentSettingsLoading ? (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                  <p className="text-sm text-gray-600">Memuat informasi pembayaran...</p>
                </div>
              </div>
            ) : paymentSettings.midtransEnabled ? (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800 font-medium">
                  🔵 Metode Pembayaran: QRIS Only
                </p>
                <div className="text-xs text-blue-600 mt-2 space-y-1">
                  <p>• Pembayaran hanya melalui QRIS</p>
                  <p>• Biaya admin QRIS sudah termasuk dalam total</p>
                  <p>• Akan ditampilkan detail biaya di halaman pembayaran</p>
                </div>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  <strong>💰 Metode Pembayaran:</strong> Pembayaran Tunai di Kasir
                </p>
                <p className="text-xs text-yellow-600 mt-1">
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
                `Bayar QRIS ${formatPrice(totalWithFee)}`
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
