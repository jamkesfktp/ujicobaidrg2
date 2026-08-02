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

// Auto-detect header color theme from keywords
const getHeaderTheme = (header) => {
  const h = (header || '').toLowerCase();
  if (h.includes('idrg') || h.includes('potensi') || h.includes('proyeksi')) return { fill: '6d28d9' };
  if (h.includes('inacbg') || h.includes('ina-cbg') || h.includes('cbg') || h.includes('spending')) return { fill: 'b45309' };
  if (h.includes('regional') || h.includes('pasar') || h.includes('sesuai')) return { fill: '16a085' };
  if (h.includes('eksisting') || h.includes('eks ') || h.startsWith('eks')) return { fill: '2980b9' };
  if (h.includes('loss')) return { fill: 'c0392b' };
  if (h.includes('selisih') || h.includes('delta')) return { fill: 'd35400' };
  if (h.includes('growth') || h.includes('pertumbuhan') || h.includes('perubahan')) return { fill: 'e67e22' };
  if (h.includes('serap') || h.includes('diserap') || h.includes('serapan')) return { fill: 'd35400' };
  if (h.includes('kelas a') || h.includes('rs a')) return { fill: 'e74c3c' };
  if (h.includes('kelas b') || h.includes('rs b')) return { fill: 'f39c12' };
  if (h.includes('kelas c') || h.includes('rs c')) return { fill: '3498db' };
  if (h.includes('kelas d') || h.includes('rs d')) return { fill: '9b59b6' };
  if (h.includes('total')) return { fill: 'd35400' };
  return { fill: '0f766e' };
};

const isCurrencyHeader = (h) => {
  const l = (h || '').toLowerCase();
  return l.includes('idrg') || l.includes('inacbg') || l.includes('ina-cbg') ||
    l.includes('pendapatan') || l.includes('potensi') || l.includes('selisih') ||
    l.includes('delta (rp)') || l.includes('spending') || l.includes('tarif');
};

const isCountHeader = (h) => {
  const l = (h || '').toLowerCase();
  return l.includes('kasus') || l.includes('jml') || l.includes('jumlah') ||
    l.includes('serap') || l.includes('growth') || l.includes('pertumbuhan');
};

/**
 * exportToExcel - Smart styled Excel export
 * @param {string[]} headers - flat array of column headers (all columns in data order)
 * @param {any[][]} dataRows - 2D array of data
 * @param {string} filename
 * @param {string} password
 * @param {Array} groupHeaders - optional. Array of row-1 group definitions:
 *   [{ label, colSpan, rowSpan, fill }]
 *   - rowSpan: 2 = this group spans both header rows (no sub-header below it)
 *   - colSpan: how many data columns this group covers
 *   - fill: hex color string (with or without #)
 */
export const applySheetData = (sheet, headers, dataRows, groupHeaders) => {

    let dataRowStart = 1;

    if (groupHeaders && groupHeaders.length > 0) {
      // ── 2-row header mode ──────────────────────────────────────────────
      dataRowStart = 3;

      // Track which columns are covered by rowSpan (so we skip writing to row 2)
      const rowSpanCols = new Set();
      // Track group fill per column for sub-header coloring
      const colGroupFill = {};
      const colGroupSubFill = {};

      let col = 1;
      groupHeaders.forEach(group => {
        const colSpan = group.colSpan || 1;
        const rowSpan = group.rowSpan || 1;
        const rawFill = (group.fill || '#0f766e').replace('#', '');

        // Compute a slightly darker sub-header color (mix with black 15%)
        const subFill = rawFill; // We'll use same fill with slightly different alpha — just keep same

        for (let i = 0; i < colSpan; i++) {
          colGroupFill[col + i] = rawFill;
          colGroupSubFill[col + i] = subFill;
          if (rowSpan === 2) rowSpanCols.add(col + i);
        }

        // Write group header cell
        const cell = sheet.cell(1, col);
        cell.value(group.label).style({
          bold: true,
          fill: rawFill,
          fontColor: 'ffffff',
          border: true,
          horizontalAlignment: 'center',
          verticalAlignment: 'center',
          wrapText: true
        });

        // Merge cells for the group
        if (rowSpan === 2 && colSpan === 1) {
          sheet.range(sheet.cell(1, col), sheet.cell(2, col)).merged(true);
        } else if (colSpan > 1) {
          sheet.range(sheet.cell(1, col), sheet.cell(1, col + colSpan - 1)).merged(true);
          if (rowSpan === 2) {
            // rowSpan + colSpan (e.g. Total header spanning 2 rows AND multiple cols)
            sheet.range(sheet.cell(1, col), sheet.cell(2, col + colSpan - 1)).merged(true);
          }
        }

        col += colSpan;
      });

      // ── Row 2: sub-headers ──────────────────────────────────────────────
      const totalCols = headers ? headers.length : 0;
      for (let c = 1; c <= totalCols; c++) {
        if (rowSpanCols.has(c)) continue; // skip — already labeled in row 1

        const subHeader = headers[c - 1] || '';
        const fill = colGroupFill[c] || '0f766e';

        // Make sub-header slightly darker by prepending a shade prefix — just use a fixed dark tint
        // We'll darken by blending: take first 2 hex chars and reduce by ~30
        const darkenHex = (hex) => {
          try {
            let r = parseInt(hex.slice(0, 2), 16);
            let g = parseInt(hex.slice(2, 4), 16);
            let b = parseInt(hex.slice(4, 6), 16);
            r = Math.max(0, r - 40);
            g = Math.max(0, g - 40);
            b = Math.max(0, b - 40);
            return [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
          } catch { return hex; }
        };

        sheet.cell(2, c).value(subHeader).style({
          bold: true,
          fill: darkenHex(fill),
          fontColor: 'ffffff',
          border: true,
          horizontalAlignment: 'center',
          verticalAlignment: 'center',
          wrapText: true
        });
      }

      // Set row heights
      sheet.row(1).height(28);
      sheet.row(2).height(24);

    } else if (headers && headers.length > 0) {
      // ── Single-row header mode ──────────────────────────────────────────
      dataRowStart = 2;
      headers.forEach((header, colIdx) => {
        const theme = getHeaderTheme(header);
        sheet.cell(1, colIdx + 1).value(header).style({
          bold: true,
          fill: theme.fill,
          fontColor: 'ffffff',
          border: true,
          horizontalAlignment: colIdx === 0 ? 'left' : 'center',
          verticalAlignment: 'center',
          wrapText: true
        });
      });
      sheet.row(1).height(28);
      sheet.freezePanes(0, 1);
    }

    // ── Column widths ──────────────────────────────────────────────────────
    (headers || []).forEach((header, idx) => {
      const len = Math.max((header || '').length, 10);
      sheet.column(idx + 1).width(Math.min(len + 4, 36));
    });
    if (headers && headers.length > 0) {
      sheet.column(1).width(30); // First col always wider
    }

    // Freeze header rows
    if (groupHeaders) {
      sheet.freezePanes(0, 2);
    } else {
      sheet.freezePanes(0, 1);
    }

    // ── Data rows ──────────────────────────────────────────────────────────
    dataRows.forEach((row, rowIdx) => {
      const isTotalRow = rowIdx === dataRows.length - 1 &&
        String(row[0] || '').toUpperCase().startsWith('TOTAL');
      const isEvenRow = rowIdx % 2 === 0;

      row.forEach((val, colIdx) => {
        const cell = sheet.cell(rowIdx + dataRowStart, colIdx + 1);
        const header = headers ? (headers[colIdx] || '') : '';

        // Parse value
        let writeVal = val;
        if (typeof val === 'number') {
          writeVal = val;
        } else if (typeof val === 'string') {
          const stripped = val.replace(/,/g, '').trim();
          if (/^-?\d+(\.\d+)?$/.test(stripped) && !val.includes('%')) {
            writeVal = Number(stripped);
          }
        }
        cell.value(writeVal);

        const styles = {
          border: true,
          verticalAlignment: 'center',
          bold: isTotalRow || colIdx === 0,
        };

        // Row background
        styles.fill = isTotalRow ? 'e2e8f0' : (isEvenRow ? 'f8fafc' : 'ffffff');

        // Alignment
        styles.horizontalAlignment = colIdx === 0 ? 'left' : 'right';
        if (colIdx === 0) styles.fontColor = '1e293b';

        // Number formats
        if (typeof writeVal === 'number') {
          const h = header.toLowerCase();
          if (h.includes('%') || h.includes('persentase') || h.includes('kenaikan')) {
            styles.numberFormat = '0.00%';
          } else if (isCurrencyHeader(header)) {
            styles.numberFormat = '"Rp "#,##0';
            styles.fontColor = isTotalRow ? '1e293b' : '4f46e5';
          } else if (isCountHeader(header)) {
            styles.numberFormat = '#,##0';
          }
        }

        // Colored font for growth/selisih/loss
        if (typeof writeVal === 'number') {
          const h = header.toLowerCase();
          if (h.includes('selisih') || h.includes('growth') || h.includes('pertumbuhan') || h.includes('delta')) {
            if (writeVal > 0) styles.fontColor = '16a34a';
            else if (writeVal < 0) styles.fontColor = 'dc2626';
            else styles.fontColor = '64748b';
          }
          if (h.includes('loss') && !h.includes('inacbg')) {
            styles.fontColor = 'dc2626';
          }
        }
        if (typeof writeVal === 'string') {
          const h = header.toLowerCase();
          if (h.includes('selisih') || h.includes('growth') || h.includes('%') || h.includes('delta')) {
            if (writeVal.startsWith('+')) styles.fontColor = '16a34a';
            else if (writeVal.startsWith('-')) styles.fontColor = 'dc2626';
          }
        }

        cell.style(styles);
      });
    });

    };

export const exportMultiSheetExcel = async (sheets, filename, password) => {
  try {
    const workbook = await XlsxPopulate.fromBlankAsync();
    
    sheets.forEach((sheetData, index) => {
      let sheet;
      if (index === 0) {
        sheet = workbook.sheet(0);
        sheet.name(sheetData.sheetName || 'Sheet' + (index+1));
      } else {
        sheet = workbook.addSheet(sheetData.sheetName || 'Sheet' + (index+1));
      }
      const { headers, dataRows, groupHeaders } = sheetData;
      applySheetData(sheet, headers, dataRows, groupHeaders);
    });

    const options = password ? { password } : {};
    const blob = await workbook.outputAsync(options);
    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Error exporting multi-sheet Excel:', error);
    alert('Gagal mengunduh Excel: ' + error.message);
  }
};

export const exportToExcel = async (headers, dataRows, filename, password, groupHeaders = null) => {
  try {
    const workbook = await XlsxPopulate.fromBlankAsync();
    const sheet = workbook.sheet(0);
    applySheetData(sheet, headers, dataRows, groupHeaders);

const options = password ? { password } : {};
    const blob = await workbook.outputAsync(options);
    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert('Gagal mengunduh Excel: ' + error.message);
  }
};
