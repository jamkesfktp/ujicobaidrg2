import XlsxPopulate from 'xlsx-populate/browser/xlsx-populate';

const downloadExcelBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  document.body.appendChild(a);
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const exportMatriksExcel = async (data, filename, password) => {
  try {
    const workbook = await XlsxPopulate.fromBlankAsync();
    const sheet = workbook.sheet(0);
    
    // Headers
    const headers = ['Tingkat Kesulitan (ICD)', 'Kasus RS Eksisting', 'Total Kasus Regional', 'Target Serapan (%)', 'Proyeksi Kasus Diserap', 'Pendapatan Eksisting (INA-CBG)', 'Proyeksi Pendapatan iDRG (Rp)', 'Pertumbuhan Kasus (+/-)'];
    
    headers.forEach((h, i) => {
      const cell = sheet.cell(1, i + 1);
      cell.value(h);
      cell.style({
        bold: true,
        fill: 'f8fafc',
        fontColor: '475569',
        border: true,
        horizontalAlignment: i === 0 ? 'left' : 'center',
        verticalAlignment: 'center'
      });
    });

    // Column widths
    sheet.column("A").width(25);
    sheet.column("B").width(18);
    sheet.column("C").width(20);
    sheet.column("D").width(18);
    sheet.column("E").width(20);
    sheet.column("F").width(30);
    sheet.column("G").width(30);
    sheet.column("H").width(22);

    let rowNum = 2;
    data.forEach((row, rowIndex) => {
      const isTotal = rowIndex === data.length - 1; // Last row is TOTAL
      
      row.forEach((val, colIndex) => {
        const cell = sheet.cell(rowNum, colIndex + 1);
        
        // Handle numbers vs strings
        if (typeof val === 'number') {
          cell.value(val);
        } else if (typeof val === 'string' && val.includes('%')) {
          cell.value(val);
        } else if (val === '-') {
          cell.value('-');
        } else {
          // Could be formatted string like "Rp 123.000", but data should ideally be raw number.
          // In the current logic, some values are numbers, some are formatted strings.
          // Let's assume they are numbers passed from the UI mapping.
          const num = Number(val);
          if (!isNaN(num) && val !== '') {
            cell.value(num);
          } else {
            cell.value(val);
          }
        }

        // Base styles
        const styles = { border: true, verticalAlignment: 'center' };
        
        if (colIndex === 0) {
          styles.bold = true;
          styles.fontColor = '334155';
          if (!isTotal && val !== 'Belum Diklasifikasi') {
            styles.fill = 'ffffff';
          } else {
            styles.fill = 'f8fafc';
          }
        } else {
          styles.horizontalAlignment = 'right';
        }

        if (isTotal) {
          styles.bold = true;
          styles.fill = 'f1f5f9';
        }

        // Colors
        if (colIndex === 5 || colIndex === 6) { // INA-CBG, iDRG
           styles.numberFormat = '"Rp "#,##0';
           styles.fontColor = colIndex === 6 ? '0369a1' : '475569';
        }
        if (colIndex === 1 || colIndex === 2 || colIndex === 4) { // Eksisting, Regional, Serap
           styles.numberFormat = '#,##0';
        }
        if (colIndex === 4) { // Serap
           styles.fontColor = '0f766e';
        }
        
        // Growth color
        if (colIndex === 7) {
          const num = Number(val);
          if (!isNaN(num)) {
            styles.numberFormat = '#,##0';
            if (num > 0) styles.fontColor = '16a34a'; // Green
            if (num < 0) styles.fontColor = 'dc2626'; // Red
            if (num === 0) styles.fontColor = '64748b'; // Gray
          }
        }

        cell.style(styles);
      });
      rowNum++;
    });

    const options = password ? { password } : {};
    const blob = await workbook.outputAsync(options);
    downloadExcelBlob(blob, filename);

  } catch (error) {
    console.error("Export Matriks Error:", error);
    alert("Gagal mengunduh Excel: " + error.message);
  }
};

export const exportLayananExcel = async (data, filename, password) => {
  try {
    const workbook = await XlsxPopulate.fromBlankAsync();
    const sheet = workbook.sheet(0);

    // Build headers
    // Row 1
    sheet.cell("A1").value("Layanan").style({ bold: true, fill: "0f766e", fontColor: "ffffff", horizontalAlignment: "center", verticalAlignment: "center", border: true });
    sheet.range("A1:A2").merged(true);

    sheet.cell("B1").value("Kapasitas RS Eksisting").style({ bold: true, fill: "0ea5e9", fontColor: "ffffff", horizontalAlignment: "center", verticalAlignment: "center", border: true });
    sheet.range("B1:F1").merged(true);

    sheet.cell("G1").value("Pasar Regional (Rujukan)").style({ bold: true, fill: "10b981", fontColor: "ffffff", horizontalAlignment: "center", verticalAlignment: "center", border: true });
    sheet.range("G1:K1").merged(true);

    sheet.cell("L1").value("Proyeksi Target (Simulasi Serapan)").style({ bold: true, fill: "f59e0b", fontColor: "ffffff", horizontalAlignment: "center", verticalAlignment: "center", border: true });
    sheet.range("L1:P1").merged(true);

    sheet.cell("Q1").value("Dampak Finansial (Proyeksi)").style({ bold: true, fill: "6366f1", fontColor: "ffffff", horizontalAlignment: "center", verticalAlignment: "center", border: true });
    sheet.range("Q1:U1").merged(true);

    // Row 2 Subheaders
    const subHeaders = [
      "Total", "Dasar", "Madya", "Utama", "Paripurna", // B-F (Eksisting)
      "Total", "Dasar", "Madya", "Utama", "Paripurna", // G-K (Regional)
      "Total Diserap", "Dasar", "Madya", "Utama", "Paripurna", // L-P (Proyeksi)
      "INA-CBG Eksisting", "Potensi iDRG", "Selisih Pendapatan", "% Selisih", "Growth Kasus" // Q-U
    ];

    const fills = [
      ...Array(5).fill("0284c7"),
      ...Array(5).fill("059669"),
      ...Array(5).fill("d97706"),
      ...Array(5).fill("4f46e5")
    ];

    subHeaders.forEach((h, i) => {
      const cell = sheet.cell(2, i + 2);
      cell.value(h).style({
        bold: true,
        fill: fills[i],
        fontColor: "ffffff",
        horizontalAlignment: "center",
        verticalAlignment: "center",
        border: true
      });
    });

    // Column Widths
    sheet.column("A").width(35); // Layanan
    for(let i = 2; i <= 16; i++) sheet.column(i).width(15); // B-P
    sheet.column("Q").width(20); // INA-CBG
    sheet.column("R").width(20); // Potensi iDRG
    sheet.column("S").width(20); // Selisih
    sheet.column("T").width(12); // % Selisih
    sheet.column("U").width(15); // Growth

    let rowNum = 3;
    data.forEach((row, rowIndex) => {
      const isTotal = rowIndex === data.length - 1;

      row.forEach((val, colIndex) => {
        const cell = sheet.cell(rowNum, colIndex + 1);
        
        let writeVal = val;
        // Parse numbers if possible, but allow strings with % to stay strings for now
        // Data contains formatted strings like "100 (50.0%)", we'll write them as string unless it's pure number.
        if (typeof val === 'number') {
           writeVal = val;
        } else if (typeof val === 'string' && /^-?\d+(\.\d+)?$/.test(val)) {
           writeVal = Number(val);
        }

        cell.value(writeVal);

        const styles = { border: true, verticalAlignment: 'center' };
        
        if (colIndex === 0) {
          styles.bold = true;
          styles.fill = isTotal ? 'f1f5f9' : 'ffffff';
          styles.fontColor = '334155';
        } else {
          styles.horizontalAlignment = 'right';
          // Light background alternating
          if (!isTotal) {
             if (colIndex >= 1 && colIndex <= 5) styles.fill = 'f0f9ff'; // Eksisting
             if (colIndex >= 6 && colIndex <= 10) styles.fill = 'f0fdf4'; // Regional
             if (colIndex >= 11 && colIndex <= 15) styles.fill = 'fffbeb'; // Proyeksi Serap
             if (colIndex >= 16) styles.fill = 'fdf4ff'; // Rupiah
          } else {
             styles.fill = 'e2e8f0';
             styles.bold = true;
          }
        }

        // Apply specific formatting
        if (colIndex === 16 || colIndex === 17 || colIndex === 18) { // INA-CBG, Potensi, Selisih
           if (typeof writeVal === 'number') {
              styles.numberFormat = '"Rp "#,##0';
           }
        }

        if (colIndex === 16) styles.fontColor = '475569';
        if (colIndex === 17) styles.fontColor = '0369a1';

        // Colored text for diff/growth
        if (colIndex === 18 || colIndex === 19 || colIndex === 20) {
           // writeVal could be number (for total row) or string with "(%)"
           const strVal = String(val);
           if (strVal.includes('-')) {
              styles.fontColor = 'dc2626';
           } else if (strVal === '0' || strVal === '0%' || strVal.startsWith('0 ')) {
              styles.fontColor = '64748b';
           } else {
              styles.fontColor = '16a34a';
           }
        }

        cell.style(styles);
      });
      rowNum++;
    });

    const options = password ? { password } : {};
    const blob = await workbook.outputAsync(options);
    downloadExcelBlob(blob, filename);

  } catch (error) {
    console.error("Export Layanan Error:", error);
    alert("Gagal mengunduh Excel: " + error.message);
  }
};
