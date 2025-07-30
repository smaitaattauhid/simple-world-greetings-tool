
import React from 'react';

interface MenuRecapData {
  id: string;
  menu_name: string;
  quantity: number;
}

interface MenuRecapPrintProps {
  data: MenuRecapData[];
  printerType?: string;
}

export const MenuRecapPrint: React.FC<MenuRecapPrintProps> = ({ data, printerType = 'standard' }) => {
  const printStyles = {
    standard: {
      fontSize: '12px',
      pageWidth: '210mm',
      margin: '20mm',
      fontFamily: 'Arial, sans-serif'
    },
    thermal: {
      fontSize: '10px',
      pageWidth: '80mm',
      margin: '5mm',
      fontFamily: 'Arial, sans-serif'
    },
    dotmatrix: {
      fontSize: '9px',
      pageWidth: '216mm',
      margin: '10mm',
      fontFamily: 'Courier, monospace'
    }
  };

  const currentStyle = printStyles[printerType as keyof typeof printStyles] || printStyles.standard;

  React.useEffect(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalItems = data.reduce((sum, item) => sum + item.quantity, 0);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rekapitulasi Menu</title>
          <style>
            @page {
              size: ${currentStyle.pageWidth};
              margin: ${currentStyle.margin};
            }
            body {
              font-family: ${currentStyle.fontFamily};
              font-size: ${currentStyle.fontSize};
              line-height: 1.4;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 20px;
            }
            th, td { 
              border: 1px solid #000; 
              padding: 8px; 
              text-align: left; 
            }
            th { 
              background-color: #f0f0f0; 
              font-weight: bold; 
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .summary { 
              margin-top: 20px; 
              padding: 10px; 
              border: 1px solid #000; 
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>REKAPITULASI PESANAN</h2>
            <p>Berdasarkan Tanggal Katering</p>
            <p>Dicetak: ${new Date().toLocaleString('id-ID')}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Nomor Urut</th>
                <th>Nama Pesanan</th>
                <th class="text-center">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((item, index) => `
                <tr>
                  <td class="text-center">${index + 1}</td>
                  <td>${item.menu_name}</td>
                  <td class="text-center">${item.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary">
            <h3>RINGKASAN</h3>
            <p>Total Jenis Menu: ${data.length}</p>
            <p>Total Jumlah Pesanan: ${totalItems}</p>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              }
            }
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  }, [data, printerType]);

  return null;
};
