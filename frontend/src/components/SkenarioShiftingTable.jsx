import React, { useState } from 'react';
import { formatCurrency, formatCompactCurrency } from '../utils/formatters';
import * as XLSX from 'xlsx';
import { Download, Copy, Check } from 'lucide-react';

const SkenarioShiftingTable = ({ 
  potensiKasusShifting, 
  potensiPendapatanShifting, 
  penguranganKasus = 0,
  penguranganPendapatanInacbg,
  pendapatanEksisting,
  pendapatanInacbgEksisting = 0,
  totalKasusEksisting = 0,
  targetRsName = 'Eksisting',
  skenarioList: externalSkenarioList,
  setSkenarioList: externalSetSkenarioList,
  labelTambah = 'Utama & Paripurna',
  labelKurang = 'Dasar & Madya'
}) => {
  const [internalSkenarioList, setInternalSkenarioList] = useState([
    { label: 'Skenario 1', pctTambah: 100, pctKurang: 100 },
    { label: 'Skenario 2', pctTambah: 75, pctKurang: 75 },
    { label: 'Skenario 3', pctTambah: 50, pctKurang: 50 },
    { label: 'Skenario 4', pctTambah: 25, pctKurang: 25 },
    { label: 'Skenario 5', pctTambah: 5, pctKurang: 100 },
  ]);
  const skenarioList = externalSkenarioList || internalSkenarioList;
  const setSkenarioList = externalSetSkenarioList || setInternalSkenarioList;
  const [copied, setCopied] = useState(false);

  // Helper to format values specifically for this table (often in Rp. Miliar)
  const formatM = (val) => {
    if (val === undefined || val === null) return '-';
    // Convert to Miliar (M = 1,000,000,000 in Indonesian)
    return (val / 1000000000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handlePctChange = (idx, field, val) => {
    const newList = [...skenarioList];
    let num = parseFloat(val);
    if (isNaN(num)) num = 0;
    if (num > 100) num = 100;
    if (num < 0) num = 0;
    newList[idx][field] = num;
    setSkenarioList(newList);
  };

  const generateTableData = () => {
    return skenarioList.map((sken, idx) => {
      const pctRatioTambah = sken.pctTambah / 100;
      const pctRatioKurang = sken.pctKurang / 100;
      
      const tambahanKasus = Math.round(potensiKasusShifting * pctRatioTambah);
      const tambahanPend = potensiPendapatanShifting * pctRatioTambah;
      
      const kurangKasus = Math.round(penguranganKasus * pctRatioKurang);
      const kurangPend = penguranganPendapatanInacbg * pctRatioKurang;
      
      const netKasus = tambahanKasus - kurangKasus;
      const pctNetKasusEksisting = totalKasusEksisting > 0 ? (netKasus / totalKasusEksisting) * 100 : 0;
      const netPend = tambahanPend - kurangPend;
      
      const totalPasca = pendapatanEksisting + netPend;
      const totalPascaInacbg = pendapatanInacbgEksisting + netPend;
      const pctKenaikanIdrg = pendapatanEksisting > 0 ? (netPend / pendapatanEksisting) * 100 : 0;
      const pctKenaikanInacbg = pendapatanInacbgEksisting > 0 ? (netPend / pendapatanInacbgEksisting) * 100 : 0;

      return {
        label: sken.label,
        pctTambah: sken.pctTambah,
        pctKurang: sken.pctKurang,
        tambahanKasus,
        tambahanPend,
        kurangKasus,
        kurangPend,
        netKasus,
        pctNetKasusEksisting,
        netPend,
        pendapatanEksisting,
        totalPasca,
        totalPascaInacbg,
        pctKenaikanInacbg,
        pctKenaikanIdrg
      };
    });
  };

  const handleCopy = () => {
    const data = generateTableData();
    const headers = [
      'Skenario',
      `Tambahan Kasus ${labelTambah} (%)`, `Tambahan Kasus ${labelTambah} (Jml)`, `Tambahan Pendapatan (Rp M)`,
      `Pengurangan Kasus ${labelKurang} (%)`, `Pengurangan Kasus ${labelKurang} (Jml)`, `Pengurangan Pendapatan (Rp M)`,
      'Net +/- Kasus', 'Net % Kasus', 'Net +/- Pendapatan (Rp M)',
      `Pendapatan Eksisting INA-CBG (Rp M)`,
      `% Kenaikan thd INA-CBG Eksisting`
    ];
    
    let tsv = headers.join('\t') + '\n';
    data.forEach(row => {
      const rowData = [
        row.label,
        row.pctTambah,
        row.tambahanKasus,
        (row.tambahanPend / 1000000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        row.pctKurang,
        row.kurangKasus,
        (row.kurangPend / 1000000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        row.netKasus,
        row.pctNetKasusEksisting.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        (row.netPend / 1000000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        (pendapatanInacbgEksisting / 1000000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        row.pctKenaikanInacbg.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})
      ];
      tsv += rowData.join('\t') + '\n';
    });
    
    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadExcel = () => {
    const data = generateTableData();
    const exportData = data.map(row => ({
      'Skenario': row.label,
      [`Persentase Tambahan ${labelTambah} (%)`]: row.pctTambah / 100,
      [`Tambahan Kasus ${labelTambah}`]: row.tambahanKasus,
      'Tambahan Pendapatan (Rp M)': row.tambahanPend / 1000000000,
      [`Persentase Pengurangan ${labelKurang} (%)`]: row.pctKurang / 100,
      [`Pengurangan Kasus ${labelKurang}`]: row.kurangKasus,
      'Pengurangan Pendapatan (Rp M)': row.kurangPend / 1000000000,
      'Net Kasus': row.netKasus,
      'Net % thd Total Eksisting': row.pctNetKasusEksisting / 100,
      'Net Pendapatan (Rp M)': row.netPend / 1000000000,
      'Pendapatan Eksisting INA-CBG (Rp M)': pendapatanInacbgEksisting / 1000000000,
      '% Kenaikan thd INA-CBG Eksisting': row.pctKenaikanInacbg / 100
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Style formatting for percentages
    for (let col of ['B', 'E', 'I', 'L']) {
      for (let i = 2; i <= data.length + 1; i++) {
        const cell = worksheet[`${col}${i}`];
        if (cell) cell.z = '0.00%';
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Simulasi Shifting');
    XLSX.writeFile(workbook, `Simulasi_Shifting_${targetRsName}.xlsx`);
  };

  const tableData = generateTableData();

  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', marginTop: '24px' }}>
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <h4 style={{ margin: 0, color: '#334155' }}>Tabel Simulasi Shifting</h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', color: '#475569' }}>
            {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <button onClick={handleDownloadExcel} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
            <Download size={14} />
            Download Excel
          </button>
        </div>
      </div>
      <div className="table-container" style={{ padding: '16px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
              <th rowSpan="2" style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#334155', verticalAlign: 'middle' }}>Skenario</th>
              <th colSpan="3" style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#047857' }}>Tambahan Kasus {labelTambah}</th>
              <th colSpan="3" style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#be123c' }}>Pengurangan Kasus {labelKurang}</th>
              <th colSpan="3" style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#0f766e' }}>Net +/- Pasca iDRG & RBKP</th>
              <th rowSpan="2" style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#334155', verticalAlign: 'middle', maxWidth: '150px' }}>Pendapatan Eksisting INA-CBG {targetRsName} (Rp. M)</th>
              <th rowSpan="2" style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#334155', verticalAlign: 'middle' }}>% Kenaikan thd INA-CBG Eksisting*</th>
            </tr>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>Persentase (%)</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>Jumlah Kasus</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>Tambahan Pendapatan (Rp M)</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>Persentase (%)</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>Jumlah Kasus</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>Pengurangan Pendapatan (Rp M)</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>+/- Jumlah Kasus</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>% thd total kasus eksisting</th>
              <th style={{ padding: '8px', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>+/- Pendapatan (Rp M)</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => {
              return (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 700, color: '#334155' }}>{row.label}</td>
                  
                  {/* Tambahan */}
                  <td style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input 
                        type="number" 
                        value={row.pctTambah} 
                        onChange={(e) => handlePctChange(idx, 'pctTambah', e.target.value)}
                        style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '0.85rem' }}
                      />
                      <span style={{ marginLeft: '4px', color: '#64748b' }}>%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#047857' }}>{row.tambahanKasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#047857' }}>{formatM(row.tambahanPend)}</td>
                  
                  {/* Pengurangan */}
                  <td style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <input 
                        type="number" 
                        value={row.pctKurang} 
                        onChange={(e) => handlePctChange(idx, 'pctKurang', e.target.value)}
                        style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '0.85rem' }}
                      />
                      <span style={{ marginLeft: '4px', color: '#64748b' }}>%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#be123c' }}>{row.kurangKasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#be123c' }}>{formatM(row.kurangPend)}</td>
                  
                  {/* Net */}
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 600, color: row.netKasus >= 0 ? '#0f766e' : '#be123c' }}>{row.netKasus > 0 ? '+' : ''}{row.netKasus.toLocaleString('id-ID')}</td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#334155' }}>{row.pctNetKasusEksisting.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%</td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 600, color: row.netPend >= 0 ? '#0f766e' : '#be123c' }}>{formatM(row.netPend)}</td>
                  
                  {/* Eksisting INA-CBG & Kenaikan */}
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', color: '#64748b' }}>{formatM(pendapatanInacbgEksisting)}</td>
                  <td style={{ padding: '10px', border: '1px solid #e2e8f0', fontWeight: 700, color: row.pctKenaikanInacbg >= 0 ? '#0f766e' : '#be123c' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span>{row.pctKenaikanInacbg > 0 ? '+' : ''}{row.pctKenaikanInacbg.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%</span>
                      {pendapatanInacbgEksisting === 0 && <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 'normal' }}>(N/A)</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '12px 16px', background: '#f8fafc', fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid #e2e8f0' }}>
        * Kolom <b>% Kenaikan thd INA-CBG Eksisting</b> menghitung: <code>(Pendapatan Net +/- Pasca iDRG & RBKP) / Pendapatan INA-CBG Eksisting RS</code>.
      </div>
    </div>
  );
};

export default SkenarioShiftingTable;
