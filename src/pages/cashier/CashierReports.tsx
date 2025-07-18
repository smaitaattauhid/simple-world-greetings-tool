
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PrintButton } from '@/components/ui/print-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice, formatDate } from '@/utils/orderUtils';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, DollarSign, Receipt, TrendingUp, User } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CashPayment {
  id: string;
  amount: number;
  created_at: string;
  order_id: string;
  cashier_name: string;
  cashier_id: string;
  orders: {
    child_name: string;
    child_class: string;
  } | null;
}

interface Cashier {
  id: string;
  full_name: string;
}

interface DailyReport {
  date: string;
  totalPayments: number;
  totalAmount: number;
  transactionCount: number;
}

const CashierReports = () => {
  const [cashPayments, setCashPayments] = useState<CashPayment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<CashPayment[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCashier, setSelectedCashier] = useState<string>('all');
  const [cashiers, setCashiers] = useState<Cashier[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Pagination untuk transaksi
  const {
    currentPage,
    totalPages,
    paginatedData: paginatedPayments,
    goToPage,
    canGoNext,
    canGoPrev,
    startIndex,
    endIndex,
    totalItems
  } = usePagination({
    data: filteredPayments,
    itemsPerPage: 20
  });

  useEffect(() => {
    // Set default dates (last 7 days)
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(lastWeek.toISOString().split('T')[0]);
    
    fetchCurrentUser();
    fetchCashPayments();
    fetchCashiers();
  }, []);

  useEffect(() => {
    filterPayments();
    generateDailyReports();
  }, [cashPayments, startDate, endDate, selectedCashier]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
      
      if (profileError) throw profileError;
      
      setCurrentUser({ ...user, profile });
      console.log('Current user profile:', profile);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchCashiers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'cashier')
        .order('full_name');

      if (error) throw error;
      setCashiers(data || []);
    } catch (error) {
      console.error('Error fetching cashiers:', error);
    }
  };

  const fetchCashPayments = async () => {
    try {
      setLoading(true);
      
      // Fetch cash payments with order details
      const { data, error } = await supabase
        .from('cash_payments')
        .select(`
          id,
          amount,
          created_at,
          order_id,
          cashier_id,
          cashier_name,
          orders (
            child_name,
            child_class
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching cash payments:', error);
        throw error;
      }

      console.log('Fetched cash payments:', data?.length || 0);
      setCashPayments(data || []);
    } catch (error) {
      console.error('Error fetching cash payments:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data pembayaran tunai",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterPayments = () => {
    let filtered = cashPayments;

    // Filter by current cashier if not admin
    if (currentUser?.profile?.role === 'cashier') {
      filtered = filtered.filter(payment => payment.cashier_id === currentUser.id);
    }

    // Filter by selected cashier (only if admin or if selected cashier matches current user)
    if (selectedCashier !== 'all') {
      if (currentUser?.profile?.role === 'admin') {
        const selectedCashierData = cashiers.find(c => c.id === selectedCashier);
        if (selectedCashierData) {
          filtered = filtered.filter(payment => payment.cashier_id === selectedCashier);
        }
      }
    }

    // Filter by date range
    if (startDate && endDate) {
      filtered = filtered.filter(payment => {
        const paymentDate = new Date(payment.created_at).toISOString().split('T')[0];
        return paymentDate >= startDate && paymentDate <= endDate;
      });
    }

    setFilteredPayments(filtered);
  };

  const generateDailyReports = () => {
    const dailyData: { [key: string]: DailyReport } = {};

    filteredPayments.forEach(payment => {
      const date = formatDate(payment.created_at);
      
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          totalPayments: 0,
          totalAmount: 0,
          transactionCount: 0
        };
      }

      dailyData[date].totalAmount += payment.amount;
      dailyData[date].totalPayments += payment.amount;
      dailyData[date].transactionCount += 1;
    });

    setDailyReports(Object.values(dailyData).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    ));
  };

  const totalStats = {
    totalTransactions: filteredPayments.length,
    totalAmount: filteredPayments.reduce((sum, payment) => sum + payment.amount, 0),
    totalReceived: filteredPayments.reduce((sum, payment) => sum + payment.amount, 0),
    totalChange: 0 // Could be calculated if we track change amounts
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const printContent = generateCashierReportHTML();
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Laporan Kasir</title>
            <style>
              body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
              .print-content { padding: 20px; }
              table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
              th { background-color: #f5f5f5; font-weight: bold; }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .bg-gray-50 { background-color: #f9f9f9; }
              .grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px; }
              .stat-box { border: 1px solid #ccc; padding: 15px; text-align: center; }
              .stat-title { font-weight: bold; font-size: 14px; margin-bottom: 10px; }
              .stat-value { font-size: 20px; font-weight: bold; }
              .text-green-600 { color: #16a34a; }
              .text-blue-600 { color: #2563eb; }
              @media print {
                body { print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 100);
    }
  };

  const generateCashierReportHTML = () => {
    const cashierName = currentUser?.profile?.role === 'cashier' 
      ? currentUser.profile.full_name 
      : selectedCashier === 'all' 
        ? 'Semua Kasir' 
        : cashiers.find(c => c.id === selectedCashier)?.full_name || 'Unknown';

    return `
      <div class="print-content">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">LAPORAN KASIR</h1>
          <p style="color: #666;">Kasir: ${cashierName}</p>
          <p style="color: #666;">Periode: ${startDate && endDate ? `${formatDate(startDate)} - ${formatDate(endDate)}` : 'Semua Data'}</p>
        </div>

        <div class="grid">
          <div class="stat-box">
            <div class="stat-title">Total Transaksi</div>
            <div class="stat-value text-blue-600">${totalStats.totalTransactions}</div>
          </div>
          <div class="stat-box">
            <div class="stat-title">Total Penjualan</div>
            <div class="stat-value text-green-600">${formatPrice(totalStats.totalAmount)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-title">Uang Diterima</div>
            <div class="stat-value">${formatPrice(totalStats.totalReceived)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-title">Total Kembalian</div>
            <div class="stat-value">${formatPrice(totalStats.totalChange)}</div>
          </div>
        </div>

        <div>
          <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 15px;">Detail Transaksi</h2>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Tanggal</th>
                <th>Nama Anak</th>
                <th>Kelas</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${filteredPayments.map((payment, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${formatDate(payment.created_at)}</td>
                  <td>${payment.orders?.child_name || 'Unknown'}</td>
                  <td>${payment.orders?.child_class || 'Unknown'}</td>
                  <td style="text-align: right;">${formatPrice(payment.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="bg-gray-50" style="font-weight: bold;">
                <td colspan="4" style="text-align: right;">Total:</td>
                <td style="text-align: right;">${formatPrice(totalStats.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #666;">
          <p>Dicetak pada: ${new Date().toLocaleString('id-ID')}</p>
        </div>
      </div>
    `;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser?.profile?.role === 'admin';
  const isCashier = currentUser?.profile?.role === 'cashier';

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-2">
            Laporan Kasir
          </h1>
          <p className="text-gray-600">
            {isCashier 
              ? `Laporan pembayaran tunai untuk ${currentUser.profile.full_name}`
              : 'Laporan pembayaran tunai dan transaksi'
            }
          </p>
        </div>
        <PrintButton onPrint={handlePrint} />
      </div>

      {/* Date Filter */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Filter Periode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tanggal Mulai</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tanggal Akhir</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium mb-2">Filter Kasir</label>
                <Select value={selectedCashier} onValueChange={setSelectedCashier}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Kasir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kasir</SelectItem>
                    {cashiers.map((cashier) => (
                      <SelectItem key={cashier.id} value={cashier.id}>
                        {cashier.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end">
              <Button onClick={() => {
                setStartDate('');
                setEndDate('');
                if (isAdmin) {
                  setSelectedCashier('all');
                }
              }} variant="outline">
                Reset Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transaksi</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalStats.totalTransactions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Penjualan</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatPrice(totalStats.totalAmount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uang Diterima</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(totalStats.totalReceived)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Kembalian</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(totalStats.totalChange)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Chart */}
      {dailyReports.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Grafik Penjualan Harian</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyReports}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="totalAmount" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>Detail Transaksi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {paginatedPayments.map((payment) => (
              <div key={payment.id} className="flex justify-between items-center p-4 border rounded">
                <div>
                  <p className="font-medium">{payment.orders?.child_name}</p>
                  <p className="text-sm text-gray-600">
                    {payment.orders?.child_class} • {formatDate(payment.created_at)}
                  </p>
                  <p className="text-xs text-blue-600 flex items-center mt-1">
                    <User className="h-3 w-3 mr-1" />
                    {payment.cashier_name || 'Unknown Cashier'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatPrice(payment.amount)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            canGoNext={canGoNext}
            canGoPrev={canGoPrev}
            startIndex={startIndex}
            endIndex={endIndex}
            totalItems={totalItems}
            itemLabel="transaksi"
          />

          {filteredPayments.length === 0 && (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium mb-2">Tidak Ada Data</h3>
              <p className="text-gray-600">Tidak ada transaksi tunai pada periode yang dipilih</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CashierReports;
