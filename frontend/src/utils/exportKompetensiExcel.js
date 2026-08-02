import XlsxPopulate from 'xlsx-populate/browser/xlsx-populate';

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  document.body.appendChild(a);
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const buildKompetensiSheet = (sheet, tableData, grandTotal, validKomp) => {

  const headerColors = {
    no: '16a085',
    kelompok: '16a085',
    kasus: '3498db',
    inacbg: '9b59b6',
    idrg: 'f1c40f',
    selisih: 'e67e22',
    ri1: '2980b9',
    rj1: '3498db',
    ri2: '8e44ad',
    rj2: '9b59b6',
    ri3: 'f39c12',
    rj3: 'f1c40f',
    dasar: 'e0f7fa',
    madya: 'e0f7fa',
    utama: 'e0f7fa',
    paripurna: 'e0f7fa',
    total_ri: 'b2ebf2',
    dasar_rj: 'e3f2fd',
    madya_rj: 'e3f2fd',
    utama_rj: 'e3f2fd',
    paripurna_rj: 'e3f2fd',
    total_rj: '90caf9'
  };

  const styleBase = { border: true, horizontalAlignment: 'center', verticalAlignment: 'center', bold: true };
  const getStyle = (fill, fontColor = 'ffffff') => ({ ...styleBase, fill, fontColor });

  // LEVEL 1
  sheet.cell("A1").value("No").style(getStyle(headerColors.no));
  sheet.cell("B1").value("Kelompok Layanan RS").style(getStyle(headerColors.kelompok));
  sheet.cell("C1").value("Jumlah Kasus").style(getStyle(headerColors.kasus));
  sheet.cell("N1").value("Tarif INA CBGs").style(getStyle(headerColors.inacbg));
  sheet.cell("Y1").value("Tarif iDRG").style(getStyle(headerColors.idrg, '000000'));
  sheet.cell("AJ1").value("Selisih (Rp)\n(Juta)").style(getStyle(headerColors.selisih)).style('wrapText', true);
  sheet.cell("AK1").value("Perubahan\n(%)").style(getStyle(headerColors.selisih)).style('wrapText', true);
  sheet.cell("AL1").value("Selisih (Rp)\n/ Kasus").style(getStyle(headerColors.selisih)).style('wrapText', true);

  sheet.range("A1:A3").merged(true);
  sheet.range("B1:B3").merged(true);
  sheet.range("C1:M1").merged(true);
  sheet.range("N1:X1").merged(true);
  sheet.range("Y1:AI1").merged(true);
  sheet.range("AJ1:AJ3").merged(true);
  sheet.range("AK1:AK3").merged(true);
  sheet.range("AL1:AL3").merged(true);

  // LEVEL 2
  const level2 = [
    { start: 3, ri: headerColors.ri1, rj: headerColors.rj1 },
    { start: 14, ri: headerColors.ri2, rj: headerColors.rj2 },
    { start: 25, ri: headerColors.ri3, rj: headerColors.rj3 }
  ];

  level2.forEach(({ start, ri, rj }, idx) => {
    sheet.cell(2, start).value("Rawat Inap").style(getStyle(ri));
    sheet.range(2, start, 2, start + 4).merged(true);
    sheet.cell(2, start + 5).value("Rawat Jalan").style(getStyle(rj, idx === 2 ? '000000' : 'ffffff'));
    sheet.range(2, start + 5, 2, start + 9).merged(true);
    sheet.cell(2, start + 10).value("RI & RJ").style(getStyle(ri));
    sheet.range(2, start + 10, 3, start + 10).merged(true);
  });

  // LEVEL 3
  const columnsBase = [
    { name: 'Dasar', fill: headerColors.dasar }, { name: 'Madya', fill: headerColors.madya }, { name: 'Utama', fill: headerColors.utama }, { name: 'Paripurna', fill: headerColors.paripurna }, { name: 'Total RI', fill: headerColors.total_ri },
    { name: 'Dasar', fill: headerColors.dasar_rj }, { name: 'Madya', fill: headerColors.madya_rj }, { name: 'Utama', fill: headerColors.utama_rj }, { name: 'Paripurna', fill: headerColors.paripurna_rj }, { name: 'Total RJ', fill: headerColors.total_rj }
  ];

  level2.forEach(({ start }) => {
    columnsBase.forEach((col, idx) => {
      sheet.cell(3, start + idx).value(col.name).style(getStyle(col.fill, '000000'));
    });
  });

  // DATA ROWS
  let currentRow = 4;
  
  const writeRow = (item, index, isTotal = false) => {
    sheet.cell(currentRow, 1).value(isTotal ? '' : index).style({ border: true, fill: isTotal ? 'e2e8f0' : 'ffffff', horizontalAlignment: 'center' });
    sheet.cell(currentRow, 2).value(item.label).style({ border: true, bold: isTotal, fill: isTotal ? 'e2e8f0' : 'ffffff', horizontalAlignment: 'left' });

    let colIdx = 3;
    const writeMeasure = (dataObj, isDecimal = false) => {
      validKomp.forEach(k => {
        sheet.cell(currentRow, colIdx++).value(dataObj.ri[k] || 0).style({ border: true, fill: isTotal ? 'e2e8f0' : 'ffffff', numberFormat: isDecimal ? '#,##0.00' : '#,##0' });
      });
      sheet.cell(currentRow, colIdx++).value(dataObj.ri.total || 0).style({ border: true, bold: true, fill: isTotal ? 'e2e8f0' : 'ffffff', numberFormat: isDecimal ? '#,##0.00' : '#,##0' });

      validKomp.forEach(k => {
        sheet.cell(currentRow, colIdx++).value(dataObj.rj[k] || 0).style({ border: true, fill: isTotal ? 'e2e8f0' : 'ffffff', numberFormat: isDecimal ? '#,##0.00' : '#,##0' });
      });
      sheet.cell(currentRow, colIdx++).value(dataObj.rj.total || 0).style({ border: true, bold: true, fill: isTotal ? 'e2e8f0' : 'ffffff', numberFormat: isDecimal ? '#,##0.00' : '#,##0' });

      sheet.cell(currentRow, colIdx++).value(dataObj.total || 0).style({ border: true, bold: true, fill: isTotal ? 'e2e8f0' : 'ffffff', numberFormat: isDecimal ? '#,##0.00' : '#,##0' });
    };

    writeMeasure(item.kasus, false);
    // for inacbg and idrg, values are passed directly (already in million) or wait, in the UI they are divided by 1000000
    // so we should divide them by 1000000 here or expect them to be divided
    const mapMil = (obj) => {
      const res = { ri: {}, rj: {}, total: obj.total / 1000000, riTotal: obj.ri.total / 1000000, rjTotal: obj.rj.total / 1000000 };
      validKomp.forEach(k => { res.ri[k] = (obj.ri[k] || 0) / 1000000; res.rj[k] = (obj.rj[k] || 0) / 1000000; });
      res.ri.total = res.riTotal; res.rj.total = res.rjTotal;
      return res;
    };

    writeMeasure(mapMil(item.inacbg), true);
    writeMeasure(mapMil(item.idrg), true);

    const delta = (item.idrg.total - item.inacbg.total) / 1000000;
    const deltaPct = item.inacbg.total > 0 ? (item.idrg.total - item.inacbg.total) / item.inacbg.total : 0;
    const deltaPerKasus = item.kasus.total > 0 ? (item.idrg.total - item.inacbg.total) / item.kasus.total : 0;

    sheet.cell(currentRow, colIdx++).value(delta).style({ border: true, bold: isTotal, fill: delta < 0 ? 'fde2e4' : (isTotal ? 'e2e8f0' : 'ffffff'), fontColor: delta < 0 ? 'c0392b' : '27ae60', numberFormat: '#,##0.00' });
    sheet.cell(currentRow, colIdx++).value(deltaPct).style({ border: true, bold: isTotal, fill: delta < 0 ? 'fde2e4' : (isTotal ? 'e2e8f0' : 'ffffff'), fontColor: delta < 0 ? 'c0392b' : '27ae60', numberFormat: '0.00%' });
    sheet.cell(currentRow, colIdx++).value(deltaPerKasus).style({ border: true, bold: isTotal, fill: delta < 0 ? 'fde2e4' : (isTotal ? 'e2e8f0' : 'ffffff'), fontColor: delta < 0 ? 'c0392b' : '27ae60', numberFormat: '#,##0' });

    currentRow++;
  };

  tableData.forEach((item, idx) => writeRow(item, idx + 1));
  writeRow({ label: 'Grand Total', ...grandTotal }, null, true);

  // Set widths
  sheet.column(1).width(5);
  sheet.column(2).width(35);
  for (let i = 3; i <= 38; i++) sheet.column(i).width(12);

};

export const exportKompetensiExcel = async (tableData, grandTotal, validKomp, password) => {
  const wb = await XlsxPopulate.fromBlankAsync();
  const sheet = wb.sheet(0);
  sheet.name("Analisis Kompetensi");
  buildKompetensiSheet(sheet, tableData, grandTotal, validKomp);
  if (password) wb.password(password);
  const blob = await wb.outputAsync();
  downloadBlob(blob, "Tabel_Laporan_Analisis_Kompetensi.xlsx");
};
