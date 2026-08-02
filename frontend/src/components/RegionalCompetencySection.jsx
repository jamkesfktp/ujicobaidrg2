import React, { useMemo } from 'react';
import { filterHospital } from '../utils/filterUtils';

const formatTableMiliar = (val) => {
  if (!val || isNaN(val)) return '0';
  return (val / 1000000000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const formatPercent = (val) => `${val.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%`;

const RegionalCompetencySection = ({ selectedRs, hospitalsData, profilesData, simulasiKey, wilayahFilter = [], kabFilter = [] }) => {
  const data = useMemo(() => {
    if (!hospitalsData || !profilesData) return null;

    let effectiveWilayahFilter = wilayahFilter || [];
    if (effectiveWilayahFilter.length === 0 && (!kabFilter || kabFilter.length === 0)) {
      if (selectedRs && hospitalsData[selectedRs.value]) {
        effectiveWilayahFilter = [hospitalsData[selectedRs.value].prop];
      }
    }

    const regHospitals = [];
    Object.keys(hospitalsData).forEach(id => {
      const h = hospitalsData[id];
      
      if (!filterHospital(h, id, [], effectiveWilayahFilter, '', false, kabFilter || [], false)) {
        return;
      }
      
      regHospitals.push({ id, ...h });
    });

    const counts = { A: 0, B: 0, C: 0, D: 0 };
    let totalKasus = 0;
    let totalIna = 0;
    let totalIdrg = 0;

    // Initialize matrix
    const types = ['ri', 'rj'];
    const levels = ['paripurna', 'utama', 'madya', 'dasar', 'Belum ada komp. ICD'];
    const classes = ['A', 'B', 'C', 'D'];
    
    const matrix = {};
    types.forEach(t => {
      matrix[t] = {};
      levels.forEach(l => {
        matrix[t][l] = {};
        classes.forEach(c => {
          matrix[t][l][c] = { kasus: 0, ina: 0, idrg: 0 };
        });
        matrix[t][l]['Total'] = { kasus: 0, ina: 0, idrg: 0 };
      });
      matrix[t]['Total'] = {};
      classes.forEach(c => matrix[t]['Total'][c] = { kasus: 0, ina: 0, idrg: 0 });
      matrix[t]['Total']['Total'] = { kasus: 0, ina: 0, idrg: 0 };
    });
    
    const grandTotal = {};
    classes.forEach(c => grandTotal[c] = { kasus: 0, ina: 0, idrg: 0 });
    grandTotal['Total'] = { kasus: 0, ina: 0, idrg: 0 };

    regHospitals.forEach(h => {
      const cls = h.kelasFaskes;
      if (counts[cls] !== undefined) counts[cls]++;
      
      const prof = profilesData[h.id];
      if (prof && prof.crosstab && prof.crosstab.byKompetensi) {
        Object.values(prof.crosstab.byKompetensi).forEach(k => {
          types.forEach(t => {
            if (k[t]) {
              levels.forEach(lvl => {
                const d = k[t][lvl];
                if (d) {
                  const cases = d.kasus || 0;
                  const ina = d.inacbg || 0;
                  const idrg = (d.sim && d.sim[simulasiKey]) || 0;
                  
                  if (cls && matrix[t][lvl][cls]) {
                    matrix[t][lvl][cls].kasus += cases;
                    matrix[t][lvl][cls].ina += ina;
                    matrix[t][lvl][cls].idrg += idrg;
                  }
                }
              });
            }
          });
        });
      }
    });

    // Compute sums
    types.forEach(t => {
      levels.forEach(lvl => {
        classes.forEach(c => {
          const cell = matrix[t][lvl][c];
          // Row Total
          matrix[t][lvl]['Total'].kasus += cell.kasus;
          matrix[t][lvl]['Total'].ina += cell.ina;
          matrix[t][lvl]['Total'].idrg += cell.idrg;
          
          // Col Total (Total RI / Total RJ)
          matrix[t]['Total'][c].kasus += cell.kasus;
          matrix[t]['Total'][c].ina += cell.ina;
          matrix[t]['Total'][c].idrg += cell.idrg;
          
          // Grand Total Col
          matrix[t]['Total']['Total'].kasus += cell.kasus;
          matrix[t]['Total']['Total'].ina += cell.ina;
          matrix[t]['Total']['Total'].idrg += cell.idrg;
          
          // Grand Total Matrix
          grandTotal[c].kasus += cell.kasus;
          grandTotal[c].ina += cell.ina;
          grandTotal[c].idrg += cell.idrg;
          
          grandTotal['Total'].kasus += cell.kasus;
          grandTotal['Total'].ina += cell.ina;
          grandTotal['Total'].idrg += cell.idrg;
        });
      });
    });

    // Wait, totalKasus, totalIna, totalIdrg at regional level in the header
    totalKasus = grandTotal['Total'].kasus;
    totalIna = grandTotal['Total'].ina;
    totalIdrg = grandTotal['Total'].idrg;

    let provName = 'INDONESIA';
    if (kabFilter && kabFilter.length > 0) provName = kabFilter.join(', ');
    else if (wilayahFilter && wilayahFilter.length > 0) provName = wilayahFilter.join(', ');
    else if (selectedRs && hospitalsData[selectedRs.value] && hospitalsData[selectedRs.value].prop) provName = hospitalsData[selectedRs.value].prop;
    
    let isJabar = false;
    if (provName.toUpperCase().includes('JAWA BARAT') && (!kabFilter || kabFilter.length === 0) && (!wilayahFilter || wilayahFilter.length === 0)) {
      isJabar = true;
    }

    return { provName, isJabar, counts, matrix, grandTotal, totalKasus, totalIna, totalIdrg, totalActive: regHospitals.length };
  }, [hospitalsData, profilesData, selectedRs, simulasiKey, wilayahFilter, kabFilter]);

  if (!data) return null;

  const { provName, isJabar, counts, matrix, grandTotal, totalKasus, totalIna, totalIdrg, totalActive } = data;

  const renderCell = (cell, isPct = false, bgClass = '') => {
    const selisih = cell.idrg - cell.ina;
    const pct = cell.ina > 0 ? (selisih / cell.ina) * 100 : 0;
    
    return (
      <React.Fragment>
        <td style={{ padding: '8px 4px', borderRight: '1px solid #e2e8f0' }} className={bgClass}>{cell.kasus.toLocaleString('id-ID')}</td>
        <td style={{ padding: '8px 4px', borderRight: '1px solid #e2e8f0' }} className={bgClass}>{formatTableMiliar(cell.ina)}</td>
        <td style={{ padding: '8px 4px', borderRight: '1px solid #e2e8f0' }} className={bgClass}>{formatTableMiliar(cell.idrg)}</td>
        <td style={{ padding: '8px 4px', borderRight: '1px solid #e2e8f0', color: selisih >= 0 ? '#15803d' : '#b91c1c' }} className={bgClass}>{formatTableMiliar(selisih)}</td>
        <td style={{ padding: '8px 4px', borderRight: '1px solid #cbd5e1', color: pct >= 0 ? '#15803d' : '#b91c1c', fontWeight: 600 }} className={bgClass}>{formatPercent(pct)}</td>
      </React.Fragment>
    );
  };

  const lblMap = {
    'paripurna': 'Paripurna',
    'utama': 'Utama',
    'madya': 'Madya',
    'dasar': 'Dasar',
    'Belum ada komp. ICD': 'Lainnya*'
  };
  
  const levels = ['paripurna', 'utama', 'madya', 'dasar', 'Belum ada komp. ICD'];
  const classes = ['A', 'B', 'C', 'D', 'Total'];

  return (
    <div style={{ marginBottom: '32px', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f766e', color: 'white', padding: '16px 24px', borderBottom: '6px solid #d97706' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
          Profil & Kasus Regional Berdasarkan Kompetensi ICD: {provName}
        </h2>
        <div style={{ background: '#e11d48', padding: '4px 16px', borderRadius: '24px', fontSize: '0.85rem', fontWeight: 700 }}>
          Data Mirroring uji coba iDRG periode 15 Okt 2025 - 14 Mar 2026
        </div>
      </div>

      <div style={{ padding: '24px', background: '#f8fafc' }}>
        
        {/* Stats Summary Area */}
        <div style={{ display: 'flex', gap: '32px', marginBottom: '24px', alignItems: 'center' }}>
          <div style={{ border: '2px solid #334155', borderRadius: '8px', padding: '16px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <img src="/building.png" alt="Hospital Building" style={{ width: '80px', opacity: 0.8 }} onError={(e) => { e.target.style.display = 'none' }} />
          </div>
          <div>
            <div style={{ fontSize: '1.2rem', color: '#64748b', fontWeight: 600 }}>Sebaran RS AKTIF: <span style={{ color: '#ef4444', fontWeight: 800 }}>{data.totalActive}</span></div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#334155', letterSpacing: '1px' }}>
              <span style={{ color: '#10b981' }}>A: {data.counts.A}</span> | <span style={{ color: '#3b82f6' }}>B: {data.counts.B}</span> | <span style={{ color: '#8b5cf6' }}>C: {data.counts.C}</span> | <span style={{ color: '#f59e0b' }}>D: {data.counts.D}</span>
            </div>
          </div>
          <div style={{ flex: 1 }}></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px', fontSize: '1.1rem', fontWeight: 700, color: '#475569', background: '#e2e8f0', padding: '16px', borderRadius: '8px' }}>
            <div style={{ textTransform: 'uppercase' }}>TOTAL KASUS REGIONAL</div>
            <div>: {data.totalKasus.toLocaleString('id-ID')} Kasus</div>
            <div style={{ textTransform: 'uppercase' }}>PENDAPATAN INA-CBG REGIONAL</div>
            <div>: Rp {(data.totalIna / 1000000000000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T</div>
            <div style={{ textTransform: 'uppercase' }}>POTENSI iDRG REGIONAL</div>
            <div>: Rp {(data.totalIdrg / 1000000000000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T</div>
          </div>
        </div>

        {/* Huge Cross-Tab Matrix Table */}
        <div style={{ overflowX: 'auto', border: '1px solid #cbd5e1' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.75rem', background: 'white' }}>
            <thead style={{ color: 'white', fontWeight: 700 }}>
              <tr>
                <th rowSpan={2} colSpan={2} style={{ background: '#0f766e', borderRight: '1px solid white', borderBottom: '1px solid white' }}>Jenis<br/>Layanan</th>
                <th rowSpan={2} style={{ background: '#0f766e', borderRight: '2px solid white', borderBottom: '1px solid white' }}>Komp.<br/>ICD</th>
                <th colSpan={5} style={{ background: '#ef4444', borderRight: '2px solid white', padding: '8px' }}>RS A</th>
                <th colSpan={5} style={{ background: '#eab308', borderRight: '2px solid white', padding: '8px' }}>RS B</th>
                <th colSpan={5} style={{ background: '#0ea5e9', borderRight: '2px solid white', padding: '8px' }}>RS C</th>
                <th colSpan={5} style={{ background: '#a855f7', borderRight: '2px solid white', padding: '8px' }}>RS D</th>
                <th colSpan={5} style={{ background: '#d97706', padding: '8px' }}>Total</th>
              </tr>
              <tr>
                {classes.map(c => (
                  <React.Fragment key={c}>
                    <th style={{ background: '#0f766e', padding: '8px 4px', borderRight: '1px solid white' }}>Jumlah<br/>Kasus</th>
                    <th style={{ background: '#0f766e', padding: '8px 4px', borderRight: '1px solid white' }}>INA CBG<br/>(Rp,M)</th>
                    <th style={{ background: '#0f766e', padding: '8px 4px', borderRight: '1px solid white' }}>iDRG<br/>(Rp,M)</th>
                    <th style={{ background: '#0f766e', padding: '8px 4px', borderRight: '1px solid white' }}>Selisih<br/>(Rp,M)</th>
                    <th style={{ background: '#0f766e', padding: '8px 4px', borderRight: '2px solid white' }}>%<br/>Selisih</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Rawat Inap */}
              {levels.map((lvl, idx) => (
                <tr key={`ri-${lvl}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  {idx === 0 && <td rowSpan={6} colSpan={2} style={{ background: 'white', fontWeight: 700, borderRight: '1px solid #cbd5e1', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Rawat Inap</td>}
                  <td style={{ padding: '8px', borderRight: '2px solid #cbd5e1', textAlign: 'left' }}>{lblMap[lvl]}</td>
                  {classes.map(c => renderCell(data.matrix['ri'][lvl][c]))}
                </tr>
              ))}
              <tr style={{ background: '#f1f5f9', fontWeight: 700, borderBottom: '2px solid #cbd5e1' }}>
                <td style={{ padding: '8px', borderRight: '2px solid #cbd5e1', textAlign: 'left' }}>Total RI</td>
                {classes.map(c => renderCell(data.matrix['ri']['Total'][c], false, 'bg-gray-100'))}
              </tr>

              {/* Rawat Jalan */}
              {levels.map((lvl, idx) => (
                <tr key={`rj-${lvl}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  {idx === 0 && <td rowSpan={6} colSpan={2} style={{ background: 'white', fontWeight: 700, borderRight: '1px solid #cbd5e1', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Rawat Jalan</td>}
                  <td style={{ padding: '8px', borderRight: '2px solid #cbd5e1', textAlign: 'left' }}>{lblMap[lvl]}</td>
                  {classes.map(c => renderCell(data.matrix['rj'][lvl][c]))}
                </tr>
              ))}
              <tr style={{ background: '#f1f5f9', fontWeight: 700, borderBottom: '2px solid #cbd5e1' }}>
                <td style={{ padding: '8px', borderRight: '2px solid #cbd5e1', textAlign: 'left' }}>Total RJ</td>
                {classes.map(c => renderCell(data.matrix['rj']['Total'][c], false, 'bg-gray-100'))}
              </tr>
              
              {/* Grand Total */}
              <tr style={{ background: '#dcfce7', fontWeight: 800, borderBottom: '2px solid #86efac' }}>
                <td colSpan={3} style={{ padding: '12px 8px', borderRight: '2px solid #86efac', textAlign: 'left', fontSize: '0.85rem' }}>Grand Total</td>
                {classes.map(c => renderCell(data.grandTotal[c]))}
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* Footer Insights */}
        <div style={{ marginTop: '24px', background: '#f0fdf4', padding: '16px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '24px' }}>
           <div style={{ background: '#fef08a', padding: '8px', borderRadius: '50%' }}>
              <span style={{ fontSize: '2rem', display: 'flex' }}>💡</span>
           </div>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, fontSize: '1.3rem', color: '#64748b', fontWeight: 300 }}>
             <div>
                Kenaikan <span style={{ color: '#0f766e', fontWeight: 600 }}>Rawat Inap</span> sebesar <span style={{ fontWeight: 600 }}>{formatTableMiliar(data.matrix['ri']['Total']['Total'].idrg - data.matrix['ri']['Total']['Total'].ina)} M</span> dengan persentase <span style={{ color: '#0f766e', fontWeight: 700 }}>{formatPercent((data.matrix['ri']['Total']['Total'].idrg - data.matrix['ri']['Total']['Total'].ina) / data.matrix['ri']['Total']['Total'].ina * 100)}</span>
             </div>
             <div>
                Kenaikan <span style={{ color: '#0f766e', fontWeight: 600 }}>Rawat Jalan</span> sebesar <span style={{ fontWeight: 600 }}>{formatTableMiliar(data.matrix['rj']['Total']['Total'].idrg - data.matrix['rj']['Total']['Total'].ina)} M</span> dengan persentase <span style={{ color: '#0f766e', fontWeight: 700 }}>{formatPercent((data.matrix['rj']['Total']['Total'].idrg - data.matrix['rj']['Total']['Total'].ina) / data.matrix['rj']['Total']['Total'].ina * 100)}</span>
             </div>
             <div>
                Kenaikan <span style={{ color: '#0f766e', fontWeight: 600 }}>Total</span> sebesar <span style={{ fontWeight: 600 }}>{(Math.abs(data.grandTotal['Total'].idrg - data.grandTotal['Total'].ina) / 1000000000000).toLocaleString('id-ID', {minimumFractionDigits: 2})} T</span> dengan persentase <span style={{ color: '#0f766e', fontWeight: 700 }}>{formatPercent((data.grandTotal['Total'].idrg - data.grandTotal['Total'].ina) / data.grandTotal['Total'].ina * 100)}</span>
             </div>
           </div>
           <img src="/logo-kemenkes.png" alt="Kemenkes" style={{ height: '60px' }} />
        </div>

      </div>
      <div style={{ padding: '0 24px 16px 24px', fontSize: '0.85rem', fontStyle: 'italic', color: '#64748b', background: '#f8fafc' }}>
        *Lainnya Adalah Kasus yang belum terdapat Mapping Kompetensi ICD
      </div>
    </div>
  );
};

export default RegionalCompetencySection;
