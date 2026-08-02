import React from 'react';
import { formatCompactCurrency, formatCurrency } from '../utils/formatters';
import DownloadExcelButton from './DownloadExcelButton';
import { exportKompetensiExcel } from '../utils/exportKompetensiExcel';

const TabelLaporanKompetensi = ({ servicesData, simulasiKey, onExportData }) => {
  if (!servicesData) return null;

  const validKomp = ['dasar', 'madya', 'utama', 'paripurna', 'tidak kompeten'];
  const allKeys = Object.keys(servicesData);
  const dataRows = allKeys.filter(k => k.toLowerCase() !== '' && !k.toLowerCase().includes('unknown') && !k.toLowerCase().includes('belum ada') && !k.toLowerCase().includes('tidak kompeten') && !k.toLowerCase().includes('n/a')).sort();
  const unknownRows = allKeys.filter(k => k.toLowerCase() === '' || k.toLowerCase().includes('unknown') || k.toLowerCase().includes('belum ada') || k.toLowerCase().includes('tidak kompeten') || k.toLowerCase().includes('n/a')).sort();
  const sortedKeys = [...dataRows, ...unknownRows];

  let grandTotal = {
    kasus: { ri: { total: 0 }, rj: { total: 0 }, total: 0 },
    inacbg: { ri: { total: 0 }, rj: { total: 0 }, total: 0 },
    idrg: { ri: { total: 0 }, rj: { total: 0 }, total: 0 }
  };
  validKomp.forEach(k => {
    grandTotal.kasus.ri[k] = 0; grandTotal.kasus.rj[k] = 0;
    grandTotal.inacbg.ri[k] = 0; grandTotal.inacbg.rj[k] = 0;
    grandTotal.idrg.ri[k] = 0; grandTotal.idrg.rj[k] = 0;
  });

  const getVal = (node, measure, komp, isSim = false) => {
    if (!node) return 0;
    if (komp === 'total') {
      if (isSim) return node[simulasiKey] || 0;
      return node[measure] || 0;
    } else {
      const compNode = node.byKomp?.[komp] || node.byKomp?.[komp.toLowerCase()];
      if (!compNode) return 0;
      if (isSim) return compNode[simulasiKey] || 0;
      return compNode[measure] || 0;
    }
  };

  const getRowData = (kelompok) => {
    const s = servicesData[kelompok];
    const ri = s.ri || {};
    const rj = s.rj || {};
    const row = { name: kelompok, kasus: { ri: {}, rj: {} }, inacbg: { ri: {}, rj: {} }, idrg: { ri: {}, rj: {} } };
    
    ['total', ...validKomp].forEach(k => {
      row.kasus.ri[k] = getVal(ri, 'kasus', k);
      row.kasus.rj[k] = getVal(rj, 'kasus', k);
      row.inacbg.ri[k] = getVal(ri, 'inacbg', k);
      row.inacbg.rj[k] = getVal(rj, 'inacbg', k);
      row.idrg.ri[k] = getVal(ri, 'idrg', k, true);
      row.idrg.rj[k] = getVal(rj, 'idrg', k, true);

      // Add to grand total
      grandTotal.kasus.ri[k] += row.kasus.ri[k]; grandTotal.kasus.rj[k] += row.kasus.rj[k];
      grandTotal.inacbg.ri[k] += row.inacbg.ri[k]; grandTotal.inacbg.rj[k] += row.inacbg.rj[k];
      grandTotal.idrg.ri[k] += row.idrg.ri[k]; grandTotal.idrg.rj[k] += row.idrg.rj[k];
    });
    
    row.kasus.total = row.kasus.ri.total + row.kasus.rj.total;
    row.inacbg.total = row.inacbg.ri.total + row.inacbg.rj.total;
    row.idrg.total = row.idrg.ri.total + row.idrg.rj.total;

    grandTotal.kasus.total += row.kasus.total;
    grandTotal.inacbg.total += row.inacbg.total;
    grandTotal.idrg.total += row.idrg.total;

    return row;
  };

  const rows = sortedKeys.map(getRowData);
  
  // Formatters
  const fNum = (v) => new Intl.NumberFormat('en-US').format(v || 0);
  const fMil = (v) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((v || 0) / 1000000);
  const fPct = (v) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((v || 0) * 100) + '%';

  const renderCells = (dataObj, measure, isSim, isTotal = false) => {
    const borderCol = isTotal ? '#ccc' : '#eee';
    const cellStyle = { textAlign: 'right', padding: '8px', border: `1px solid ${borderCol}` };
    const totalStyle = { textAlign: 'right', fontWeight: 'bold', padding: '8px', border: `1px solid ${borderCol}` };
    
    return (
      <React.Fragment>
        {validKomp.map(k => <td key={`ri-${k}`} style={cellStyle}>{measure === 'kasus' ? fNum(dataObj.ri[k]) : fMil(dataObj.ri[k])}</td>)}
        <td style={totalStyle}>{measure === 'kasus' ? fNum(dataObj.ri.total) : fMil(dataObj.ri.total)}</td>
        {validKomp.map(k => <td key={`rj-${k}`} style={cellStyle}>{measure === 'kasus' ? fNum(dataObj.rj[k]) : fMil(dataObj.rj[k])}</td>)}
        <td style={totalStyle}>{measure === 'kasus' ? fNum(dataObj.rj.total) : fMil(dataObj.rj.total)}</td>
        <td style={totalStyle}>{measure === 'kasus' ? fNum(dataObj.total) : fMil(dataObj.total)}</td>
      </React.Fragment>
    );
  };

  React.useEffect(() => {
    if (onExportData) {
      const tableData = sortedKeys.map(k => {
        const item = servicesData[k];
        const label = item.kelompok || k;
        let kasus = { ri: {}, rj: {}, total: 0, riTotal: 0, rjTotal: 0 };
        let inacbg = { ri: {}, rj: {}, total: 0, riTotal: 0, rjTotal: 0 };
        let idrg = { ri: {}, rj: {}, total: 0, riTotal: 0, rjTotal: 0 };
        
        validKomp.forEach(komp => {
          kasus.ri[komp] = getVal(item?.ri, 'kasus', komp, false);
          kasus.rj[komp] = getVal(item?.rj, 'kasus', komp, false);
          kasus.riTotal += kasus.ri[komp]; kasus.rjTotal += kasus.rj[komp];
          
          inacbg.ri[komp] = getVal(item?.ri, 'inacbg', komp, false);
          inacbg.rj[komp] = getVal(item?.rj, 'inacbg', komp, false);
          inacbg.riTotal += inacbg.ri[komp]; inacbg.rjTotal += inacbg.rj[komp];
          
          idrg.ri[komp] = getVal(item?.ri, 'idrg', komp, true);
          idrg.rj[komp] = getVal(item?.rj, 'idrg', komp, true);
          idrg.riTotal += idrg.ri[komp]; idrg.rjTotal += idrg.rj[komp];
        });
        
        kasus.ri.total = kasus.riTotal; kasus.rj.total = kasus.rjTotal; kasus.total = kasus.riTotal + kasus.rjTotal;
        inacbg.ri.total = inacbg.riTotal; inacbg.rj.total = inacbg.rjTotal; inacbg.total = inacbg.riTotal + inacbg.rjTotal;
        idrg.ri.total = idrg.riTotal; idrg.rj.total = idrg.rjTotal; idrg.total = idrg.riTotal + idrg.rjTotal;
        
        return { label, kasus, inacbg, idrg };
      });
      onExportData({ type: 'kompetensi', sheetName: 'Analisis Kompetensi', tableData, grandTotal, validKomp });
    }
  }, [sortedKeys, servicesData, grandTotal, validKomp, onExportData]);

  return (
    <div style={{ marginTop: '2rem', overflowX: 'auto', background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ color: '#2c3e50', fontSize: '1.2rem', margin: 0 }}>Tabel Laporan Analisis Kompetensi</h3>
        <DownloadExcelButton 
          customExportFn={async (password) => {
            const tableData = sortedKeys.map(k => {
              const item = servicesData[k];
              const label = k === '' || k === 'unknown' ? 'Lainnya / Tidak Diketahui' : k;
              
              const kasus = { ri: {}, rj: {}, total: 0, riTotal: 0, rjTotal: 0 };
              const inacbg = { ri: {}, rj: {}, total: 0, riTotal: 0, rjTotal: 0 };
              const idrg = { ri: {}, rj: {}, total: 0, riTotal: 0, rjTotal: 0 };
              
              validKomp.forEach(komp => {
                kasus.ri[komp] = getVal(item?.ri, 'kasus', komp, false);
                kasus.rj[komp] = getVal(item?.rj, 'kasus', komp, false);
                kasus.riTotal += kasus.ri[komp]; kasus.rjTotal += kasus.rj[komp];
                
                inacbg.ri[komp] = getVal(item?.ri, 'inacbg', komp, false);
                inacbg.rj[komp] = getVal(item?.rj, 'inacbg', komp, false);
                inacbg.riTotal += inacbg.ri[komp]; inacbg.rjTotal += inacbg.rj[komp];
                
                idrg.ri[komp] = getVal(item?.ri, 'idrg', komp, true);
                idrg.rj[komp] = getVal(item?.rj, 'idrg', komp, true);
                idrg.riTotal += idrg.ri[komp]; idrg.rjTotal += idrg.rj[komp];
              });
              
              kasus.ri.total = kasus.riTotal; kasus.rj.total = kasus.rjTotal; kasus.total = kasus.riTotal + kasus.rjTotal;
              inacbg.ri.total = inacbg.riTotal; inacbg.rj.total = inacbg.rjTotal; inacbg.total = inacbg.riTotal + inacbg.rjTotal;
              idrg.ri.total = idrg.riTotal; idrg.rj.total = idrg.rjTotal; idrg.total = idrg.riTotal + idrg.rjTotal;
              
              return { label, kasus, inacbg, idrg };
            });
            
            await exportKompetensiExcel(tableData, grandTotal, validKomp, password);
          }}
        />
      </div>
      <div style={{ textAlign: 'right', marginBottom: '8px', fontSize: '12px', color: '#666' }}>Dalam juta rupiah (kasus dalam satuan)</div>
      <table className="export-pptx-table" data-title="Laporan Analisis Kompetensi Layanan RS" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}>
        <thead>
          <tr>
            <th rowSpan={3} style={{ width: '50px', background: '#f8f9fa', padding: '8px', border: '1px solid #ddd' }}>No</th>
            <th rowSpan={3} style={{ width: '250px', background: '#f8f9fa', padding: '8px', border: '1px solid #ddd' }}>Kelompok Layanan</th>
            <th colSpan={13} style={{ background: '#3498db', color: 'white', padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>Jumlah Kasus</th>
            <th colSpan={13} style={{ background: '#9b59b6', color: 'white', padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>Tarif INA CBGs</th>
            <th colSpan={13} style={{ background: '#f1c40f', color: 'black', padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>Tarif iDRG</th>
            <th rowSpan={3} style={{ background: '#e67e22', color: 'white', padding: '8px', border: '1px solid #ddd' }}>Selisih (Rp)<br/>(Juta)</th>
            <th rowSpan={3} style={{ background: '#e67e22', color: 'white', padding: '8px', border: '1px solid #ddd' }}>Perubahan<br/>(%)</th>
          </tr>
          <tr>
            <th colSpan={6} style={{ background: '#2980b9', color: 'white', border: '1px solid #ddd', textAlign: 'center' }}>Rawat Inap</th>
            <th colSpan={6} style={{ background: '#3498db', color: 'white', border: '1px solid #ddd', textAlign: 'center' }}>Rawat Jalan</th>
            <th rowSpan={2} style={{ background: '#2c3e50', color: 'white', border: '1px solid #ddd', textAlign: 'center' }}>Total</th>
            <th colSpan={6} style={{ background: '#8e44ad', color: 'white', border: '1px solid #ddd', textAlign: 'center' }}>Rawat Inap</th>
            <th colSpan={6} style={{ background: '#9b59b6', color: 'white', border: '1px solid #ddd', textAlign: 'center' }}>Rawat Jalan</th>
            <th rowSpan={2} style={{ background: '#2c3e50', color: 'white', border: '1px solid #ddd', textAlign: 'center' }}>Total</th>
            <th colSpan={6} style={{ background: '#f39c12', color: 'white', border: '1px solid #ddd', textAlign: 'center' }}>Rawat Inap</th>
            <th colSpan={6} style={{ background: '#f1c40f', color: 'black', border: '1px solid #ddd', textAlign: 'center' }}>Rawat Jalan</th>
            <th rowSpan={2} style={{ background: '#2c3e50', color: 'white', border: '1px solid #ddd', textAlign: 'center' }}>Total</th>
          </tr>
          <tr>
            <th style={{ background: '#e0f7fa', color: '#333', border: '1px solid #ddd' }}>Dasar</th>
            <th style={{ background: '#e0f7fa', color: '#333', border: '1px solid #ddd' }}>Madya</th>
            <th style={{ background: '#e0f7fa', color: '#333', border: '1px solid #ddd' }}>Utama</th>
            <th style={{ background: '#e0f7fa', color: '#333', border: '1px solid #ddd' }}>Paripurna</th>
            <th style={{ background: '#e0f7fa', color: '#333', border: '1px solid #ddd' }}>Tdk. Komp</th>
            <th style={{ background: '#b2ebf2', color: '#333', border: '1px solid #ddd' }}>Total RI</th>
            <th style={{ background: '#e3f2fd', color: '#333', border: '1px solid #ddd' }}>Dasar</th>
            <th style={{ background: '#e3f2fd', color: '#333', border: '1px solid #ddd' }}>Madya</th>
            <th style={{ background: '#e3f2fd', color: '#333', border: '1px solid #ddd' }}>Utama</th>
            <th style={{ background: '#e3f2fd', color: '#333', border: '1px solid #ddd' }}>Paripurna</th>
            <th style={{ background: '#e3f2fd', color: '#333', border: '1px solid #ddd' }}>Tdk. Komp</th>
            <th style={{ background: '#bbdefb', color: '#333', border: '1px solid #ddd' }}>Total RJ</th>
            
            <th style={{ background: '#f3e5f5', color: '#333', border: '1px solid #ddd' }}>Dasar</th>
            <th style={{ background: '#f3e5f5', color: '#333', border: '1px solid #ddd' }}>Madya</th>
            <th style={{ background: '#f3e5f5', color: '#333', border: '1px solid #ddd' }}>Utama</th>
            <th style={{ background: '#f3e5f5', color: '#333', border: '1px solid #ddd' }}>Paripurna</th>
            <th style={{ background: '#f3e5f5', color: '#333', border: '1px solid #ddd' }}>Tdk. Komp</th>
            <th style={{ background: '#e1bee7', color: '#333', border: '1px solid #ddd' }}>Total RI</th>
            <th style={{ background: '#fce4ec', color: '#333', border: '1px solid #ddd' }}>Dasar</th>
            <th style={{ background: '#fce4ec', color: '#333', border: '1px solid #ddd' }}>Madya</th>
            <th style={{ background: '#fce4ec', color: '#333', border: '1px solid #ddd' }}>Utama</th>
            <th style={{ background: '#fce4ec', color: '#333', border: '1px solid #ddd' }}>Paripurna</th>
            <th style={{ background: '#fce4ec', color: '#333', border: '1px solid #ddd' }}>Tdk. Komp</th>
            <th style={{ background: '#f8bbd0', color: '#333', border: '1px solid #ddd' }}>Total RJ</th>
            
            <th style={{ background: '#fff8e1', color: '#333', border: '1px solid #ddd' }}>Dasar</th>
            <th style={{ background: '#fff8e1', color: '#333', border: '1px solid #ddd' }}>Madya</th>
            <th style={{ background: '#fff8e1', color: '#333', border: '1px solid #ddd' }}>Utama</th>
            <th style={{ background: '#fff8e1', color: '#333', border: '1px solid #ddd' }}>Paripurna</th>
            <th style={{ background: '#fff8e1', color: '#333', border: '1px solid #ddd' }}>Tdk. Komp</th>
            <th style={{ background: '#ffecb3', color: '#333', border: '1px solid #ddd' }}>Total RI</th>
            <th style={{ background: '#fbe9e7', color: '#333', border: '1px solid #ddd' }}>Dasar</th>
            <th style={{ background: '#fbe9e7', color: '#333', border: '1px solid #ddd' }}>Madya</th>
            <th style={{ background: '#fbe9e7', color: '#333', border: '1px solid #ddd' }}>Utama</th>
            <th style={{ background: '#fbe9e7', color: '#333', border: '1px solid #ddd' }}>Paripurna</th>
            <th style={{ background: '#fbe9e7', color: '#333', border: '1px solid #ddd' }}>Tdk. Komp</th>
            <th style={{ background: '#ffccbc', color: '#333', border: '1px solid #ddd' }}>Total RJ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const selisih = r.idrg.total - r.inacbg.total;
            const pct = r.inacbg.total > 0 ? selisih / r.inacbg.total : 0;
            const isBlank = r.name.toLowerCase() === 'belum ada komp. icd';
            const displayName = isBlank ? '(blank)*' : r.name;
            
            return (
              <tr key={r.name} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                <td style={{ padding: '8px', border: '1px solid #eee', textAlign: 'center' }}>{i + 1}</td>
                <td style={{ padding: '8px', border: '1px solid #eee' }}>{displayName}</td>
                {renderCells(r.kasus, 'kasus')}
                {renderCells(r.inacbg, 'inacbg')}
                {renderCells(r.idrg, 'idrg', true)}
                <td style={{ padding: '8px', border: '1px solid #eee', textAlign: 'right', background: '#fdf3e7' }}>{fMil(selisih)}</td>
                <td style={{ padding: '8px', border: '1px solid #eee', textAlign: 'right', background: '#fdf3e7' }}>{fPct(pct)}</td>
              </tr>
            );
          })}
          {/* Summary Row */}
          <tr style={{ background: '#e0e0e0', fontWeight: 'bold' }}>
            <td colSpan={2} style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'center' }}>Total</td>
            {renderCells(grandTotal.kasus, 'kasus', false, true)}
            {renderCells(grandTotal.inacbg, 'inacbg', false, true)}
            {renderCells(grandTotal.idrg, 'idrg', true, true)}
            <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>{fMil(grandTotal.idrg.total - grandTotal.inacbg.total)}</td>
            <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>{fPct((grandTotal.idrg.total - grandTotal.inacbg.total) / grandTotal.inacbg.total)}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: '12px', fontSize: '12px', color: '#555' }}>
        * blank: belum ada mapping kompetensi ICD ke Layanan RS
      </div>
    </div>
  );
};

export default TabelLaporanKompetensi;
