import React, { useMemo } from 'react';
import { formatTableMiliar } from '../utils/formatters';

const formatPercent = (val) => `${(val > 0 ? '+' : '')}${val.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%`;

const RsComparisonSection = ({ selectedRs, profile, simulasiKey }) => {
  const data = useMemo(() => {
    if (!profile || !profile.crosstab || !profile.crosstab.byKompetensi) return null;
    
    // Group cases by competence
    const levels = ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'];
    const tableData = levels.map(lvl => ({ lvl, kasus: 0, ina: 0, idrg: 0 }));
    
    let totalKasus = 0;
    
    Object.values(profile.crosstab.byKompetensi).forEach(classMap => {
      ['rj', 'ri'].forEach(t => {
        if (classMap[t]) {
          levels.forEach((lvl, idx) => {
            const d = classMap[t][lvl];
            if (d) {
              const cases = d.kasus || 0;
              // Extract sum from the array format in dataset2 if needed
              // wait, the format is NOT array in crosstab.byKompetensi anymore?
              // The node script output earlier was: 
              // "dasar": {"kasus": 14385, "inacbg": 5553334500, "sim": {"tarif_1": 4484267471.479999, ...}}
              
              let inacbg = d.inacbg || 0;
              let sim = 0;
              if (d.sim) {
                sim = d.sim[simulasiKey] || d.sim[simulasiKey.replace('tarif', 'sim')] || 0;
              }

              tableData[idx].kasus += cases;
              tableData[idx].ina += inacbg;
              tableData[idx].idrg += sim;
              totalKasus += cases;
            }
          });
        }
      });
    });
    
    let sumIna = 0;
    let sumIdrg = 0;
    tableData.forEach(row => {
      row.selisih = row.idrg - row.ina;
      row.pctSelisih = row.ina > 0 ? (row.selisih / row.ina) * 100 : 0;
      row.pctKasus = totalKasus > 0 ? (row.kasus / totalKasus) * 100 : 0;
      sumIna += row.ina;
      sumIdrg += row.idrg;
    });

    const totalSelisih = sumIdrg - sumIna;
    const totalPct = sumIna > 0 ? (totalSelisih / sumIna) * 100 : 0;

    return { tableData, totalKasus, sumIna, sumIdrg, totalSelisih, totalPct };
  }, [profile, simulasiKey]);

  if (!data) return null;

  const lblMap = {
    'dasar': 'Dasar',
    'madya': 'Madya',
    'utama': 'Utama',
    'paripurna': 'Paripurna',
    'Belum ada komp. ICD': 'Lainnya*'
  };

  return (
    <div style={{ marginBottom: '32px', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f766e', color: 'white', padding: '16px 24px', borderBottom: '6px solid #d97706' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
          Perbandingan INA CBGs dan iDRG - {selectedRs?.label?.split(' (')[0] || ''}
        </h2>
        <div style={{ background: '#e11d48', padding: '4px 16px', borderRadius: '24px', fontSize: '0.85rem', fontWeight: 700 }}>
          Data Mirroring Uji Coba iDRG periode 15 Okt 2025 - 14 Mar 2026
        </div>
      </div>

      {/* Summary Row */}
      <div style={{ display: 'flex', gap: '16px', padding: '24px', background: '#f8fafc' }}>
        <div style={{ flex: 1, background: '#f1f5f9', padding: '16px', borderLeft: '4px solid #cbd5e1' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>Total Kasus:</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#b91c1c', margin: '4px 0' }}>{data.totalKasus.toLocaleString('id-ID')}</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Jumlah kasus eklaim</div>
        </div>
        <div style={{ flex: 1, background: '#f1f5f9', padding: '16px', borderLeft: '4px solid #cbd5e1' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>Pendapatan INA CBGs:</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706', margin: '4px 0' }}>Rp {formatTableMiliar(data.sumIna)} M</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Dari data 5 bulan</div>
        </div>
        <div style={{ flex: 1, background: '#f1f5f9', padding: '16px', borderLeft: '4px solid #cbd5e1' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>Pendapatan iDRG:</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a3e635', margin: '4px 0' }}>Rp {formatTableMiliar(data.sumIdrg)} M</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Klaim uji coba iDRG</div>
        </div>
        <div style={{ flex: 1, background: '#f1f5f9', padding: '16px', borderLeft: '4px solid #cbd5e1' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>Selisih Pendapatan:</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: data.totalSelisih >= 0 ? '#15803d' : '#b91c1c', margin: '4px 0' }}>
            {data.totalSelisih < 0 ? '-' : ''}Rp {formatTableMiliar(Math.abs(data.totalSelisih))} M
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>iDRG - INA CBGs</div>
        </div>
        <div style={{ flex: 1, background: '#f1f5f9', padding: '16px', borderLeft: '4px solid #cbd5e1' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>Persentase:</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: data.totalPct >= 0 ? '#15803d' : '#b91c1c', margin: '4px 0' }}>
            {formatPercent(data.totalPct)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}></div>
        </div>
      </div>

      {/* Table */}
      <div style={{ padding: '0 24px 24px 24px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead style={{ background: '#14b8a6', color: 'white' }}>
            <tr>
              <th style={{ padding: '16px 8px', border: '1px solid white' }}>Tingkat<br/>Kompetensi</th>
              <th style={{ padding: '16px 8px', border: '1px solid white' }}>Jumlah<br/>Kasus</th>
              <th style={{ padding: '16px 8px', border: '1px solid white' }}>%<br/>Kasus RS</th>
              <th style={{ padding: '16px 8px', border: '1px solid white' }}>INA-CBG<br/>(Rp) (M)</th>
              <th style={{ padding: '16px 8px', border: '1px solid white' }}>iDRG<br/>(Rp) (M)</th>
              <th style={{ padding: '16px 8px', border: '1px solid white' }}>Selisih<br/>(Rp) (M)</th>
              <th style={{ padding: '16px 8px', border: '1px solid white' }}>%<br/>Selisih</th>
            </tr>
          </thead>
          <tbody>
            {data.tableData.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px 8px', fontWeight: 700, textAlign: 'left', borderRight: '1px solid #e2e8f0' }}>{lblMap[row.lvl]}</td>
                <td style={{ padding: '12px 8px', borderRight: '1px solid #e2e8f0' }}>{row.kasus.toLocaleString('id-ID')}</td>
                <td style={{ padding: '12px 8px', borderRight: '1px solid #e2e8f0' }}>{row.pctKasus.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</td>
                <td style={{ padding: '12px 8px', borderRight: '1px solid #e2e8f0' }}>Rp {formatTableMiliar(row.ina)} M</td>
                <td style={{ padding: '12px 8px', borderRight: '1px solid #e2e8f0' }}>Rp {formatTableMiliar(row.idrg)} M</td>
                <td style={{ padding: '12px 8px', borderRight: '1px solid #e2e8f0', color: row.selisih >= 0 ? '#15803d' : '#b91c1c' }}>
                  {row.selisih < 0 ? '-' : ''}Rp {row.selisih >= -1000000000 && row.selisih <= 1000000000 ? (Math.abs(row.selisih)/1000000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Jt' : formatTableMiliar(Math.abs(row.selisih)) + ' M'}
                </td>
                <td style={{ padding: '12px 8px', color: row.pctSelisih >= 0 ? '#15803d' : '#b91c1c' }}>
                  {formatPercent(row.pctSelisih)}
                </td>
              </tr>
            ))}
            <tr style={{ background: '#dbeafe', fontWeight: 700, borderBottom: '2px solid #93c5fd' }}>
              <td style={{ padding: '12px 8px', textAlign: 'left', borderRight: '1px solid #93c5fd' }}>Total</td>
              <td style={{ padding: '12px 8px', borderRight: '1px solid #93c5fd' }}>{data.totalKasus.toLocaleString('id-ID')}</td>
              <td style={{ padding: '12px 8px', borderRight: '1px solid #93c5fd' }}>100,0%</td>
              <td style={{ padding: '12px 8px', borderRight: '1px solid #93c5fd' }}>Rp {formatTableMiliar(data.sumIna)} M</td>
              <td style={{ padding: '12px 8px', borderRight: '1px solid #93c5fd' }}>Rp {formatTableMiliar(data.sumIdrg)} M</td>
              <td style={{ padding: '12px 8px', borderRight: '1px solid #93c5fd', color: data.totalSelisih >= 0 ? '#15803d' : '#b91c1c' }}>
                {data.totalSelisih < 0 ? '-' : ''}Rp {formatTableMiliar(Math.abs(data.totalSelisih))} M
              </td>
              <td style={{ padding: '12px 8px', color: data.totalPct >= 0 ? '#15803d' : '#b91c1c' }}>
                {formatPercent(data.totalPct)}
              </td>
            </tr>
          </tbody>
        </table>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px' }}>
          <div style={{ fontSize: '0.85rem', fontStyle: 'italic', color: '#64748b' }}>
            *Lainnya Adalah Kasus yang belum terdapat Mapping Kompetensi ICD
          </div>
          <img src="/logo-kemenkes.png" alt="Kemenkes" style={{ height: '40px' }} />
        </div>
      </div>
    </div>
  );
};

export default RsComparisonSection;
