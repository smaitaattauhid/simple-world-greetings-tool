import { useOrders } from '@/hooks/useOrders';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { EmptyOrdersState } from '@/components/orders/EmptyOrdersState';
import { OrderSelectionCard } from '@/components/orders/OrderSelectionCard';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, CheckSquare } from 'lucide-react';
import { canPayOrder } from '@/utils/orderUtils';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';

const Orders = () => {
  const { orders, loading, retryPayment } = useOrders();
  const [activeTab, setActiveTab] = useState('all');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings: paymentSettings } = usePaymentSettings();

  // Filter orders berdasarkan tab aktif
  const getFilteredOrders = () => {
    switch (activeTab) {
      case 'pending':
        return orders.filter(order => order.status === 'pending');
      case 'confirmed':
        return orders.filter(order => order.status === 'confirmed');
      case 'preparing':
        return orders.filter(order => order.status === 'preparing');
      case 'delivered':
        return orders.filter(order => order.status === 'delivered');
      default:
        return orders;
    }
  };

  const filteredOrders = getFilteredOrders();

  // Get pending orders that can still be paid (not expired) - only if Midtrans is enabled
  const pendingOrders = paymentSettings.midtransEnabled 
    ? orders.filter(order => order.payment_status === 'pending' && canPayOrder(order))
    : [];

  const handleSelectionChange = (orderId: string, selected: boolean) => {
    setSelectedOrderIds(prev => 
      selected 
        ? [...prev, orderId]
        : prev.filter(id => id !== orderId)
    );
  };

  const handleSelectAll = () => {
    const allPendingIds = pendingOrders.map(order => order.id);
    setSelectedOrderIds(allPendingIds);
    setIsSelectionMode(true);
  };

  const handleClearSelection = () => {
    setSelectedOrderIds([]);
    setIsSelectionMode(false);
  };

  const handleBatchPayment = () => {
    console.log('Orders: handleBatchPayment called');
    console.log('Orders: selectedOrderIds:', selectedOrderIds);
    console.log('Orders: Available orders:', orders.length);
    
    if (selectedOrderIds.length === 0) {
      console.error('Orders: No orders selected for batch payment');
      toast({
        title: "Pilih Pesanan",
        description: "Silakan pilih minimal satu pesanan untuk dibayar",
        variant: "destructive",
      });
      return;
    }

    const selectedOrders = orders.filter(order => selectedOrderIds.includes(order.id));
    console.log('Orders: Selected orders for batch payment:', selectedOrders);
    
    if (selectedOrders.length === 0) {
      console.error('Orders: No matching orders found for selected IDs');
      toast({
        title: "Error",
        description: "Pesanan yang dipilih tidak ditemukan",
        variant: "destructive",
      });
      return;
    }

    // Verify all selected orders can be paid (not expired and pending payment)
    const invalidOrders = selectedOrders.filter(order => !canPayOrder(order));
    if (invalidOrders.length > 0) {
      console.error('Orders: Some selected orders cannot be paid:', invalidOrders);
      toast({
        title: "Error",
        description: `${invalidOrders.length} pesanan tidak dapat dibayar karena sudah kadaluarsa atau sudah dibayar`,
        variant: "destructive",
      });
      return;
    }

    console.log('Orders: Navigating to batch payment with state:', {
      selectedOrderIds,
      orders: selectedOrders
    });

    try {
      navigate('/batch-orders', { 
        state: { 
          selectedOrderIds, 
          orders: selectedOrders 
        } 
      });
    } catch (error) {
      console.error('Orders: Navigation error:', error);
      toast({
        title: "Error",
        description: "Gagal navigasi ke halaman pembayaran batch",
        variant: "destructive",
      });
    }
  };

  // Custom retry payment with expiration check
  const handleRetryPayment = (order: any) => {
    if (!canPayOrder(order)) {
      toast({
        title: "Tidak Dapat Dibayar",
        description: "Pesanan ini sudah kadaluarsa atau sudah dibayar",
        variant: "destructive",
      });
      return;
    }
    retryPayment(order);
  };

  // Pagination
  const {
    currentPage,
    totalPages,
    paginatedData: paginatedOrders,
    goToPage,
    canGoNext,
    canGoPrev,
    startIndex,
    endIndex,
    totalItems
  } = usePagination({
    data: filteredOrders,
    itemsPerPage: 12
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 md:h-32 md:w-32 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-3 md:p-6">
      <div className="text-center mb-4 md:mb-8">
        <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-1 md:mb-2">
          Riwayat Pesanan
        </h1>
        <p className="text-gray-600 text-sm md:text-base">Pantau status pesanan makanan anak Anda</p>
      </div>

      {orders.length === 0 ? (
        <EmptyOrdersState />
      ) : (
        <>
          {/* Batch Payment Controls - Only show if Midtrans is enabled */}
          {paymentSettings.midtransEnabled && pendingOrders.length > 0 && (
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">Pembayaran Batch</h3>
                    <p className="text-sm text-gray-600">
                      {pendingOrders.length} pesanan menunggu pembayaran
                    </p>
                    {isSelectionMode && (
                      <p className="text-xs text-blue-600 mt-1">
                        {selectedOrderIds.length} pesanan dipilih
                      </p>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {!isSelectionMode ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setIsSelectionMode(true)}
                          className="flex items-center"
                        >
                          <CheckSquare className="h-4 w-4 mr-2" />
                          Pilih Pesanan
                        </Button>
                        <Button
                          onClick={handleSelectAll}
                          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Bayar Semua ({pendingOrders.length})
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={handleClearSelection}
                        >
                          Batal
                        </Button>
                        <Button
                          onClick={handleBatchPayment}
                          disabled={selectedOrderIds.length === 0}
                          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Bayar Terpilih ({selectedOrderIds.length})
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                
                {isSelectionMode && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      Mode pemilihan aktif. Pilih pesanan yang ingin dibayar sekaligus, 
                      lalu klik "Bayar Terpilih" untuk melanjutkan ke pembayaran batch.
                      <span className="block mt-1 text-xs">
                        <strong>Catatan:</strong> Pesanan yang sudah lewat tanggal katering tidak dapat dibayar.
                      </span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Show info when Midtrans is disabled */}
          {!paymentSettings.midtransEnabled && orders.some(order => order.payment_status === 'pending_cash') && (
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg text-yellow-800 mb-2">Mode Pembayaran Tunai</h3>
                  <p className="text-sm text-yellow-700">
                    Pembayaran online dinonaktifkan. Semua pesanan harus dibayar tunai di kasir.
                    Tidak ada fitur pembayaran batch untuk orang tua dalam mode ini.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {isSelectionMode ? (
            <>
              {/* Selection Mode View */}
              <div className="mb-4">
                <h2 className="text-lg font-semibold mb-2">
                  Pilih Pesanan untuk Pembayaran Batch
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pendingOrders.map((order) => (
                    <OrderSelectionCard
                      key={order.id}
                      order={order}
                      isSelected={selectedOrderIds.includes(order.id)}
                      onSelectionChange={handleSelectionChange}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Normal View */}
              <OrderFilters 
                orders={paginatedOrders} 
                onRetryPayment={handleRetryPayment}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </>
          )}
          
          {!isSelectionMode && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
              canGoNext={canGoNext}
              canGoPrev={canGoPrev}
              startIndex={startIndex}
              endIndex={endIndex}
              totalItems={totalItems}
              itemLabel="pesanan"
            />
          )}
        </>
      )}
    </div>
  );
};

export default Orders;
