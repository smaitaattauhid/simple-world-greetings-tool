import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice, isOrderExpired } from '@/utils/orderUtils';
import { Search, User, Calendar, CreditCard, Receipt, Eye, EyeOff, CheckSquare, Calculator } from 'lucide-react';
import { CashPayment } from '@/components/cashier/CashPayment';
import { StudentSearchCombobox } from '@/components/cashier/StudentSearchCombobox';
import { CashierBatchPayment } from '@/components/cashier/CashierBatchPayment';

interface Order {
  id: string;
  child_name: string;
  child_class: string;
  total_amount: number;
  payment_status: string;
  delivery_date: string;
  created_at: string;
  order_items: {
    id: string;
    quantity: number;
    price: number;
    menu_items: {
      name: string;
      image_url?: string;
    } | null;
  }[];
  children?: {
    nik?: string;
    nis?: string;
  } | null;
}

const CashierDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  console.log('CashierDashboard: Component rendered');

  useEffect(() => {
    fetchPendingOrders();
  }, []);

  const formatDateOnly = (dateString: string | null | undefined) => {
    if (!dateString) return 'Tidak diatur';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('CashierDashboard: Error formatting date:', error);
      return 'Format tanggal tidak valid';
    }
  };

  const fetchPendingOrders = async () => {
    try {
      console.log('CashierDashboard: Fetching pending orders');
      setLoading(true);

      // Get current user info to verify cashier role
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('CashierDashboard: User not authenticated:', userError);
        toast({
          title: "Error",
          description: "Anda harus login sebagai kasir",
          variant: "destructive",
        });
        return;
      }

      console.log('CashierDashboard: Current user:', user.email);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          child_name,
          child_class,
          total_amount,
          payment_status,
          delivery_date,
          created_at,
          child_id,
          children (
            nik,
            nis
          ),
          order_items (
            id,
            quantity,
            price,
            menu_items (
              name,
              image_url
            )
          )
        `)
        .eq('payment_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('CashierDashboard: Error fetching orders:', error);
        throw error;
      }

      console.log('CashierDashboard: Fetched orders before filtering:', data?.length || 0);
      
      // Filter out expired orders
      const validOrders = (data || []).filter(order => !isOrderExpired(order.delivery_date));
      
      console.log('CashierDashboard: Orders after filtering expired:', validOrders.length);
      setOrders(validOrders);
    } catch (error) {
      console.error('CashierDashboard: Error in fetchPendingOrders:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data pesanan. Pastikan Anda sudah login sebagai kasir.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const searchOrders = async (searchValue?: string) => {
    const termToSearch = searchValue || searchTerm;
    
    if (!termToSearch.trim()) {
      fetchPendingOrders();
      return;
    }

    try {
      console.log('CashierDashboard: Searching orders with term:', termToSearch);
      setLoading(true);

      // Search in multiple ways: by name, class, NIK, NIS
      const { data: childrenData, error: childrenError } = await supabase
        .from('children')
        .select('id, nik, nis, name, class_name')
        .or(`nik.ilike.%${termToSearch}%,nis.ilike.%${termToSearch}%,name.ilike.%${termToSearch}%,class_name.ilike.%${termToSearch}%`);

      if (childrenError) {
        console.error('CashierDashboard: Error searching children:', childrenError);
      }

      const childIds = childrenData?.map(child => child.id) || [];
      console.log('CashierDashboard: Found children IDs:', childIds);

      // Build the search query
      let query = supabase
        .from('orders')
        .select(`
          id,
          child_name,
          child_class,
          total_amount,
          payment_status,
          delivery_date,
          created_at,
          child_id,
          children (
            nik,
            nis
          ),
          order_items (
            id,
            quantity,
            price,
            menu_items (
              name,
              image_url
            )
          )
        `)
        .eq('payment_status', 'pending');

      // Add search conditions
      if (childIds.length > 0) {
        query = query.or(`child_name.ilike.%${termToSearch}%,child_class.ilike.%${termToSearch}%,child_id.in.(${childIds.join(',')})`);
      } else {
        query = query.or(`child_name.ilike.%${termToSearch}%,child_class.ilike.%${termToSearch}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('CashierDashboard: Error searching orders:', error);
        throw error;
      }

      console.log('CashierDashboard: Search results before filtering:', data?.length || 0);
      
      // Filter out expired orders from search results too
      const validOrders = (data || []).filter(order => !isOrderExpired(order.delivery_date));
      
      console.log('CashierDashboard: Search results after filtering expired:', validOrders.length);
      setOrders(validOrders);

      if (!validOrders || validOrders.length === 0) {
        toast({
          title: "Tidak Ditemukan",
          description: "Tidak ada pesanan yang sesuai dengan pencarian",
        });
      }
    } catch (error) {
      console.error('CashierDashboard: Error in searchOrders:', error);
      toast({
        title: "Error",
        description: "Gagal mencari data pesanan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (selectedSearchTerm: string) => {
    console.log('CashierDashboard: Student selected from autocomplete:', selectedSearchTerm);
    setSearchTerm(selectedSearchTerm);
    searchOrders(selectedSearchTerm);
  };

  const handlePaymentComplete = () => {
    setSelectedOrder(null);
    setIsBatchMode(false);
    setSelectedOrderIds([]);
    fetchPendingOrders();
  };

  const toggleOrderDetails = (orderId: string) => {
    console.log('CashierDashboard: Toggling details for order:', orderId);
    console.log('CashierDashboard: Current expanded order:', expandedOrderId);
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  const handleBatchSelection = (orderId: string, selected: boolean) => {
    setSelectedOrderIds(prev => 
      selected 
        ? [...prev, orderId]
        : prev.filter(id => id !== orderId)
    );
  };

  const handleSelectAllOrders = () => {
    const allOrderIds = orders.map(order => order.id);
    setSelectedOrderIds(allOrderIds);
  };

  const handleClearSelection = () => {
    setSelectedOrderIds([]);
    setIsBatchMode(false);
  };

  const handleStartBatchPayment = () => {
    if (selectedOrderIds.length === 0) {
      toast({
        title: "Pilih Pesanan",
        description: "Silakan pilih minimal satu pesanan untuk pembayaran batch",
        variant: "destructive",
      });
      return;
    }

    const selectedOrders = orders.filter(order => selectedOrderIds.includes(order.id));
    setSelectedOrder({ 
      ...selectedOrders[0], 
      batchOrders: selectedOrders,
      total_amount: selectedOrders.reduce((sum, order) => sum + order.total_amount, 0)
    } as any);
  };

  if (selectedOrder) {
    // Check if this is a batch payment
    const isBatchPayment = (selectedOrder as any).batchOrders;
    
    if (isBatchPayment) {
      return (
        <div className="container mx-auto p-6">
          <div className="mb-4">
            <Button 
              variant="outline" 
              onClick={() => setSelectedOrder(null)}
              className="mb-4"
            >
              ← Kembali ke Daftar Pesanan
            </Button>
          </div>
          <CashierBatchPayment 
            orders={(selectedOrder as any).batchOrders}
            onPaymentComplete={handlePaymentComplete}
          />
        </div>
      );
    } else {
      return (
        <div className="container mx-auto p-6">
          <div className="mb-4">
            <Button 
              variant="outline" 
              onClick={() => setSelectedOrder(null)}
              className="mb-4"
            >
              ← Kembali ke Daftar Pesanan
            </Button>
          </div>
          <CashPayment 
            order={selectedOrder} 
            onPaymentComplete={handlePaymentComplete}
          />
        </div>
      );
    }
  }

  return (
    <div className="container mx-auto p-6">
      {/* Search Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="h-5 w-5 mr-2" />
            Pencarian Pesanan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <StudentSearchCombobox
                onStudentSelect={handleStudentSelect}
                placeholder="Cari siswa dengan autocomplete..."
              />
            </div>
            <Button onClick={() => searchOrders()} disabled={loading}>
              {loading ? 'Mencari...' : 'Cari'}
            </Button>
            <Button variant="outline" onClick={fetchPendingOrders}>
              Reset
            </Button>
          </div>
          
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">Atau cari manual:</p>
            <div className="flex gap-2">
              <Input
                placeholder="Ketik nama siswa, kelas, NIK, atau NIS..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchOrders()}
                className="flex-1"
              />
            </div>
          </div>
          
          <div className="text-sm text-gray-600">
            <p>💡 Tips pencarian:</p>
            <ul className="list-disc ml-6 text-xs">
              <li>Gunakan autocomplete di atas untuk pencarian yang lebih mudah</li>
              <li>Atau ketik manual: nama siswa, kelas, NIK 16 digit, atau NIS</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Pesanan Pending Pembayaran</CardTitle>
              <p className="text-sm text-gray-600">
                Total: {orders.length} pesanan (pesanan kadaluarsa disembunyikan)
              </p>
            </div>
            
            {/* Batch Payment Controls */}
            {orders.length > 0 && (
              <div className="flex gap-2">
                {!isBatchMode ? (
                  <Button
                    variant="outline"
                    onClick={() => setIsBatchMode(true)}
                    className="flex items-center"
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Mode Batch
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleClearSelection}
                    >
                      Batal
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleSelectAllOrders}
                    >
                      Pilih Semua
                    </Button>
                    <Button
                      onClick={handleStartBatchPayment}
                      disabled={selectedOrderIds.length === 0}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Calculator className="h-4 w-4 mr-2" />
                      Bayar Batch ({selectedOrderIds.length})
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
          
          {isBatchMode && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Mode Pembayaran Batch:</strong> Pilih pesanan yang ingin dibayar sekaligus untuk memproses pembayaran tunai secara bersamaan.
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p>Memuat data pesanan...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Tidak ada pesanan pending yang dapat dibayar</p>
              <p className="text-sm text-gray-400 mt-1">Pesanan yang sudah kadaluarsa tidak ditampilkan</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order.id} className={`border-l-4 border-l-orange-500 ${isBatchMode && selectedOrderIds.includes(order.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-start gap-3">
                        {/* Batch Mode Checkbox */}
                        {isBatchMode && (
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.includes(order.id)}
                            onChange={(e) => handleBatchSelection(order.id, e.target.checked)}
                            className="mt-1 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                        )}
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-orange-600" />
                            <span className="font-semibold">{order.child_name}</span>
                            <Badge variant="outline">{order.child_class}</Badge>
                          </div>

                          {order.children && (order.children.nik || order.children.nis) && (
                            <div className="text-sm text-gray-600 mb-2">
                              {order.children.nik && (
                                <span className="mr-4">NIK: {order.children.nik}</span>
                              )}
                              {order.children.nis && (
                                <span>NIS: {order.children.nis}</span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              <span>Katering: {formatDateOnly(order.delivery_date)}</span>
                            </div>
                            <div className="flex items-center">
                              <Receipt className="h-4 w-4 mr-1" />
                              <span>{order.order_items?.length || 0} item</span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleOrderDetails(order.id)}
                              >
                                {expandedOrderId === order.id ? (
                                  <>
                                    <EyeOff className="h-4 w-4 mr-1" />
                                    Sembunyikan Detail
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-4 w-4 mr-1" />
                                    Lihat Detail
                                  </>
                                )}
                              </Button>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-orange-600">
                                {formatPrice(order.total_amount)}
                              </p>
                              {!isBatchMode && (
                                <Button
                                  onClick={() => setSelectedOrder(order)}
                                  className="mt-2"
                                  size="sm"
                                >
                                  <CreditCard className="h-4 w-4 mr-1" />
                                  Bayar Tunai
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Order Details */}
                    {expandedOrderId === order.id && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                        <h4 className="font-medium mb-3 text-lg">Detail Pesanan:</h4>
                        {order.order_items && order.order_items.length > 0 ? (
                          <div className="space-y-3">
                            {order.order_items.map((item, index) => (
                              <div key={item.id || index} className="flex justify-between items-center py-3 border-b border-gray-200 last:border-b-0">
                                <div className="flex-1">
                                  <span className="font-medium text-base">
                                    {item.menu_items?.name || 'Item Tidak Diketahui'}
                                  </span>
                                  <div className="text-sm text-gray-600 mt-1">
                                    <span>Harga satuan: {formatPrice(item.price)}</span>
                                    <span className="ml-4">Jumlah: {item.quantity}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="font-medium text-lg">
                                    {formatPrice(item.price * item.quantity)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            <p>Tidak ada detail item ditemukan</p>
                          </div>
                        )}
                        <div className="mt-4 pt-4 border-t border-gray-300">
                          <div className="flex justify-between items-center font-bold text-xl">
                            <span>Total Pembayaran:</span>
                            <span className="text-orange-600">
                              {formatPrice(order.total_amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CashierDashboard;
