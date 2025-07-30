import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { formatPrice, formatDate } from '@/utils/orderUtils';
import { PrintButton } from '@/components/ui/print-button';
import { MenuRecapPrint } from '@/components/print/MenuRecapPrint';
import { DetailOrdersPrint } from '@/components/print/DetailOrdersPrint';

interface MenuRecapData {
  id: string;
  menu_name: string;
  quantity: number;
}

interface OrderDetailData {
  id: string;
  child_name: string;
  child_class: string;
  menu_name: string;
  item_code: string;
  quantity: number;
  kitchen_check: boolean;
  homeroom_check: boolean;
  delivery_date: string;
  total_amount: number;
  payment_status: string;
  order_items: {
    quantity: number;
    menu_items: { name: string } | null;
  }[];
}

interface OrderRecapProps {
  onExportData?: (data: MenuRecapData[]) => void;
}

export const OrderRecap = ({ onExportData }: OrderRecapProps) => {
  const [recapData, setRecapData] = useState<MenuRecapData[]>([]);
  const [detailedOrders, setDetailedOrders] = useState<OrderDetailData[]>([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [showRecapPrint, setShowRecapPrint] = useState(false);
  const [showDetailPrint, setShowDetailPrint] = useState(false);
  const [printType, setPrintType] = useState<string>('standard');
  
  // Filter states
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  useEffect(() => {
    fetchClasses();
    fetchData();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedClass, selectedPaymentStatus, startDate, endDate]);

  const fetchClasses = async () => {
    try {
      const { data: classesData, error } = await supabase
        .from('classes')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setClasses(classesData || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data kelas",
        variant: "destructive",
      });
    }
  };

  const generateItemCode = (menuName: string) => {
    return menuName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('');
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Build query with delivery_date filters
      let query = supabase
        .from('orders')
        .select(`
          id,
          child_name,
          child_class,
          delivery_date,
          total_amount,
          payment_status,
          order_items (
            quantity,
            menu_items (
              name
            )
          )
        `)
        .not('delivery_date', 'is', null)
        .order('delivery_date', { ascending: false });

      // Apply class filter
      if (selectedClass !== 'all') {
        query = query.eq('child_class', selectedClass);
      }

      // Apply payment status filter
      if (selectedPaymentStatus !== 'all') {
        query = query.eq('payment_status', selectedPaymentStatus);
      }

      // Apply delivery date filters
      if (startDate) {
        const startOfDay = new Date(startDate);
        startOfDay.setHours(0, 0, 0, 0);
        query = query.gte('delivery_date', startOfDay.toISOString().split('T')[0]);
      }

      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('delivery_date', endOfDay.toISOString().split('T')[0]);
      }

      const { data: ordersData, error } = await query;

      if (error) throw error;

      // Process data for recap (group by menu name)
      const recapMap = new Map<string, number>();
      const detailedOrdersData: OrderDetailData[] = [];

      ordersData?.forEach(order => {
        order.order_items.forEach(item => {
          const menuName = item.menu_items?.name || 'Unknown Item';
          
          // For recap data
          if (recapMap.has(menuName)) {
            recapMap.set(menuName, recapMap.get(menuName)! + item.quantity);
          } else {
            recapMap.set(menuName, item.quantity);
          }

          // For detailed orders
          detailedOrdersData.push({
            id: `${order.id}-${Math.random()}`,
            child_name: order.child_name || '',
            child_class: order.child_class || '',
            menu_name: menuName,
            item_code: generateItemCode(menuName),
            quantity: item.quantity,
            kitchen_check: false, // Default values, can be extended later
            homeroom_check: false,
            delivery_date: order.delivery_date,
            total_amount: order.total_amount || 0,
            payment_status: order.payment_status || 'pending',
            order_items: [item]
          });
        });
      });

      // Convert recap map to array
      const recapArray = Array.from(recapMap.entries()).map(([menuName, quantity], index) => ({
        id: `recap-${index}`,
        menu_name: menuName,
        quantity: quantity
      }));

      setRecapData(recapArray);
      setDetailedOrders(detailedOrdersData);
      
      // Call export callback if provided
      if (onExportData) {
        onExportData(recapArray);
      }
    } catch (error) {
      console.error('Error fetching recap data:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data rekapitulasi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedClass('all');
    setSelectedPaymentStatus('all');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const hasActiveFilters = selectedClass !== 'all' || selectedPaymentStatus !== 'all' || startDate || endDate;

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'paid': return 'Lunas';
      case 'pending': return 'Belum Bayar';
      case 'failed': return 'Gagal';
      case 'refunded': return 'Refund';
      default: return status;
    }
  };

  const handleRecapPrint = (printerType = 'standard') => {
    if (recapData.length === 0) {
      toast({
        title: "Tidak ada data",
        description: "Tidak ada data rekapitulasi untuk dicetak",
        variant: "destructive",
      });
      return;
    }
    setPrintType(printerType);
    setShowRecapPrint(true);
  };

  const handleDetailPrint = (printerType = 'standard') => {
    if (detailedOrders.length === 0) {
      toast({
        title: "Tidak ada data",
        description: "Tidak ada data detail pesanan untuk dicetak",
        variant: "destructive",
      });
      return;
    }
    setPrintType(printerType);
    setShowDetailPrint(true);
  };

  useEffect(() => {
    if (showRecapPrint) {
      setShowRecapPrint(false);
    }
  }, [showRecapPrint]);

  useEffect(() => {
    if (showDetailPrint) {
      setShowDetailPrint(false);
    }
  }, [showDetailPrint]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Rekapitulasi Pesanan (Berdasarkan Tanggal Katering)
            </CardTitle>
            <div className="flex items-center gap-2">
              <PrintButton
                onPrint={handleRecapPrint}
                label="Print Rekapitulasi"
                showPrinterOptions={true}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            {/* Class Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Kelas</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.name}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status Pembayaran</label>
              <Select value={selectedPaymentStatus} onValueChange={setSelectedPaymentStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="paid">Lunas</SelectItem>
                  <SelectItem value="pending">Belum Bayar</SelectItem>
                  <SelectItem value="failed">Gagal</SelectItem>
                  <SelectItem value="refunded">Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tanggal Katering Mulai</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tanggal Katering Akhir</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Hapus Semua Filter
              </Button>
            </div>
          )}

          {/* Filter Summary */}
          {hasActiveFilters && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                Menampilkan data
                {selectedClass !== 'all' && ` untuk kelas ${selectedClass}`}
                {selectedPaymentStatus !== 'all' && ` dengan status ${getPaymentStatusLabel(selectedPaymentStatus)}`}
                {startDate && ` dari tanggal katering ${format(startDate, "dd/MM/yyyy")}`}
                {endDate && ` sampai ${format(endDate, "dd/MM/yyyy")}`}
              </p>
            </div>
          )}

          {/* Recap Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-2 text-left">Nomor Urut</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Nama Pesanan</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="border border-gray-300 px-4 py-8 text-center">
                      <div className="animate-pulse">Memuat data...</div>
                    </td>
                  </tr>
                ) : recapData.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="border border-gray-300 px-4 py-8 text-center">
                      <div className="text-gray-500">
                        Tidak ada data yang sesuai dengan filter
                      </div>
                    </td>
                  </tr>
                ) : (
                  recapData.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2 text-center font-medium">
                        {index + 1}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        {item.menu_name}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {item.quantity}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Summary Cards */}
          {recapData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {recapData.length}
                </div>
                <div className="text-sm text-blue-600">Total Jenis Menu</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {recapData.reduce((sum, item) => sum + item.quantity, 0)}
                </div>
                <div className="text-sm text-green-600">Total Jumlah Pesanan</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Orders */}
      {detailedOrders.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Detail Pesanan</CardTitle>
              <PrintButton
                onPrint={handleDetailPrint}
                label="Print Detail Pesanan"
                showPrinterOptions={true}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left">Nomor Urut</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Nama Siswa</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Kelas</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Nama Pesanan</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Kode Item</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">Jumlah</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">Ceklist Dapur</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">Ceklist Walikelas</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedOrders.map((order, index) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2 text-center font-medium">
                        {index + 1}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 font-medium">
                        {order.child_name}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        {order.child_class}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        {order.menu_name}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                        {order.item_code}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {order.quantity}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        <input 
                          type="checkbox" 
                          checked={order.kitchen_check} 
                          readOnly
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        <input 
                          type="checkbox" 
                          checked={order.homeroom_check} 
                          readOnly
                          className="h-4 w-4"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Print Components */}
      {showRecapPrint && (
        <MenuRecapPrint data={recapData} printerType={printType} />
      )}
      
      {showDetailPrint && (
        <DetailOrdersPrint data={detailedOrders} printerType={printType} />
      )}
    </div>
  );
};
