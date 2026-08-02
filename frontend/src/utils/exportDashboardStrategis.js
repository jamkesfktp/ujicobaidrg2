import XlsxPopulate from 'xlsx-populate/browser/xlsx-populate';
import { applySheetData } from './exportExcel';
import { buildKompetensiSheet } from './exportKompetensiExcel';

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

export const exportDashboardStrategisMaster = async (sheetsData, filename, password = null) => {
  try {
    const wb = await XlsxPopulate.fromBlankAsync();
    
    let sheetIndex = 0;
    // Rename first default sheet
    wb.sheet(0).name("Sheet1");

    for (const item of sheetsData) {
      if (!item) continue;
      let sheet;
      if (sheetIndex === 0) {
        sheet = wb.sheet(0);
        sheet.name(item.sheetName || `Sheet${sheetIndex+1}`);
      } else {
        sheet = wb.addSheet(item.sheetName || `Sheet${sheetIndex+1}`);
      }

      if (item.type === 'kompetensi') {
         buildKompetensiSheet(sheet, item.tableData, item.grandTotal, item.validKomp);
      } else {
         applySheetData(sheet, item.headers, item.dataRows, item.groupHeaders);
      }
      sheetIndex++;
    }
    
    if (password) {
      wb.password(password);
    }

    const blob = await wb.outputAsync();
    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Error exporting master Excel:', error);
    alert('Gagal mengunduh Excel: ' + error.message);
  }
};
