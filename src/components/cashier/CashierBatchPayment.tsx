
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice, formatDate } from '@/utils/orderUtils';
import { Calculator, CreditCard, User, Calendar } from 'lucide-react';

interface Order {
  id: string;
  child_name: string;
  child_class: string;
  total_amount: number;
  payment_status: string;
  delivery_date: string;
  created_at: string;
  order_items: {
    quantity: number;
    price: number;
    menu_items: {
      name: string;
    } | null;
  }[];
}

interface CashierBatchPaymentProps {
  orders: Order[];
  onPaymentComplete: () => void;
}

export const CashierBatchPayment: React.FC<CashierBatchPaymentProps> = ({ 
  orders, 
  onPaymentComplete 
}) => {
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const totalAmount = orders.reduce((sum, order) => sum + order.total_amount, 0);
  const receivedAmountNumber = parseFloat(receivedAmount) || 0;
  const changeAmount = receivedAmountNumber - totalAmount;
  const isValidPayment = receivedAmountNumber >= totalAmount;

  const handleBatchPayment = async () => {
    if (!isValidPayment) {
      toast({
        title: "Error",
        description: "Jumlah uang yang diterima kurang dari total pembayaran",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Get current user (cashier)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Get cashier profile
      const { data: cashierProfile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('CashierBatchPayment: Error fetching cashier profile:', profileError);
      }

      const cashierName = cashierProfile?.full_name || 'Unknown Cashier';
      const batchId = `CASH_BATCH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log('CashierBatchPayment: Processing batch payment for orders:', orders.map(o => o.id));

      // Process all orders in a transaction
      for (const order of orders) {
        console.log('CashierBatchPayment: Processing order:', order.id);

        // Update order payment status and status
        const { error: orderError } = await supabase
          .from('orders')
          .update({ 
            payment_status: 'paid',
            status: 'confirmed',
            payment_method: 'cash'
          })
          .eq('id', order.id);

        if (orderError) {
          console.error('CashierBatchPayment: Error updating order:', order.id, orderError);
          throw orderError;
        }

        // Generate transaction ID for cash payment
        const transactionId = `CASH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${order.id.substring(0, 8)}`;

        // Record cash payment in payments table
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            order_id: order.id,
            amount: order.total_amount,
            payment_method: 'cash',
            status: 'completed',
            transaction_id: transactionId
          });

        if (paymentError) {
          console.error('CashierBatchPayment: Error recording payment:', order.id, paymentError);
          throw paymentError;
        }

        // Record cash payment details in cash_payments table
        const { error: cashPaymentError } = await supabase
          .from('cash_payments')
          .insert({
            order_id: order.id,
            amount: order.total_amount,
            received_amount: order.total_amount, // Individual order amount
            change_amount: 0, // No individual change for batch
            cashier_id: user.id,
            cashier_name: cashierName,
            notes: `Batch Payment ID: ${batchId}. ${notes || 'Pembayaran batch'}`
          });

        if (cashPaymentError) {
          console.error('CashierBatchPayment: Error recording cash payment details:', order.id, cashPaymentError);
          // Don't throw error here as the main payment is already completed
        }
      }

      toast({
        title: "Pembayaran Batch Berhasil",
        description: `${orders.length} pesanan telah dibayar. Total: ${formatPrice(totalAmount)}. Kembalian: ${formatPrice(Math.max(0, changeAmount))}`,
      });

      onPaymentComplete();
    } catch (error) {
      console.error('CashierBatchPayment: Error processing batch payment:', error);
      toast({
        title: "Error",
        description: "Gagal memproses pembayaran batch",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      {/* Order List */}
      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Pembayaran Batch - {orders.length} Pesanan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {orders.map((order, index) => (
              <div key={order.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-orange-600" />
                      <span className="font-medium">{order.child_name}</span>
                      <Badge variant="outline">{order.child_class}</Badge>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-1" />
                      Pengiriman: {formatDate(order.delivery_date)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      ID: {order.id.substring(0, 12)}...
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-orange-600">
                      {formatPrice(order.total_amount)}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {order.order_items.length} item
                    </Badge>
                  </div>
                </div>
                
                {/* Order Items Summary */}
                <div className="mt-3 space-y-1">
                  {order.order_items.slice(0, 2).map((item, itemIndex) => (
                    <div key={itemIndex} className="flex justify-between text-sm text-gray-600">
                      <span>{item.quantity}x {item.menu_items?.name || 'Unknown Item'}</span>
                      <span>{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  ))}
                  {order.order_items.length > 2 && (
                    <p className="text-xs text-gray-500">
                      +{order.order_items.length - 2} item lainnya
                    </p>
                  )}
                </div>
                
                {index < orders.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Payment Form */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Total Pembayaran</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Jumlah Pesanan:</span>
                <span>{orders.length} pesanan</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total:</span>
                <span className="text-orange-600">{formatPrice(totalAmount)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Jumlah Uang Diterima
                </label>
                <Input
                  type="number"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  placeholder="Masukkan jumlah uang"
                  min={totalAmount}
                  step="1000"
                />
              </div>

              {receivedAmount && receivedAmountNumber > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Kembalian:</span>
                    <span className={`text-lg font-bold ${changeAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPrice(Math.max(0, changeAmount))}
                    </span>
                  </div>
                  {changeAmount < 0 && (
                    <p className="text-red-600 text-sm mt-1">
                      Kurang: {formatPrice(Math.abs(changeAmount))}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Catatan (Opsional)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan untuk pembayaran batch..."
                  rows={3}
                />
              </div>

              <Button
                onClick={handleBatchPayment}
                disabled={!isValidPayment || loading}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <Calculator className="h-4 w-4 mr-2" />
                {loading ? 'Memproses...' : `Proses Pembayaran Batch (${formatPrice(totalAmount)})`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
