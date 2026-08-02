import React, { useMemo } from 'react';
import { Map, MapPin } from 'lucide-react';
import { filterHospital } from '../utils/filterUtils';

const formatTableMiliar = (val) => {
  if (!val || isNaN(val)) return '0';
  return (val / 1000000000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const RegionalProfileSection = ({ selectedRs, hospitalsData, profilesData, simulasiKey, wilayahFilter = [], kabFilter = [] }) => {
  const data = useMemo(() => {
    if (!hospitalsData || !profilesData) return null;

    let effectiveWilayahFilter = wilayahFilter || [];
    if (effectiveWilayahFilter.length === 0 && (!kabFilter || kabFilter.length === 0)) {
      if (selectedRs && hospitalsData[selectedRs.value]) {
        effectiveWilayahFilter = [hospitalsData[selectedRs.value].prop];
      }
    }

    // Collect regional hospitals
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

    const compCases = {
      dasar: 0,
      madya: 0,
      utama: 0,
      paripurna: 0,
      lainnya: 0
    };

    regHospitals.forEach(h => {
      if (counts[h.kelasFaskes] !== undefined) {
        counts[h.kelasFaskes]++;
      }

      let computedKasus = 0;
      let computedIna = 0;
      let computedIdrgForHosp = 0;

      // Extract competence breakdown from profile if available
      const prof = profilesData[h.id];
      if (prof && prof.crosstab && prof.crosstab.byKompetensi) {
        Object.values(prof.crosstab.byKompetensi).forEach(k => {
          ['ri', 'rj'].forEach(t => {
            if (k[t]) {
              compCases.dasar += k[t].dasar?.kasus || 0;
              compCases.madya += k[t].madya?.kasus || 0;
              compCases.utama += k[t].utama?.kasus || 0;
              compCases.paripurna += k[t].paripurna?.kasus || 0;
              compCases.lainnya += k[t]['Belum ada komp. ICD']?.kasus || 0;
              
              Object.values(k[t]).forEach(d => {
                computedKasus += d.kasus || 0;
                computedIna += d.inacbg || 0;
                if (d.sim && d.sim[simulasiKey]) {
                  computedIdrgForHosp += d.sim[simulasiKey];
                }
              });
            }
          });
        });
      }

      // If missing top level data (e.g. Dataset 3), use the computed ones
      if (!h.kasus) h.kasus = computedKasus;
      if (!h.inacbg) h.inacbg = computedIna;

      totalKasus += h.kasus || 0;
      totalIna += h.inacbg || 0;

      // Get the correct sim from hospitalsData or fallback
      let sim = 0;
      if (h[simulasiKey]) sim = h[simulasiKey];
      else if (h.rj && h.rj[simulasiKey]) sim = (h.rj[simulasiKey] || 0) + (h.ri && h.ri[simulasiKey] ? h.ri[simulasiKey] : 0);
      else if (h.tarif_1) sim = h[simulasiKey] || h.tarif_1;
      else if (computedIdrgForHosp > 0) sim = computedIdrgForHosp;
      
      totalIdrg += sim;
    });

    const topHospitals = [...regHospitals].sort((a, b) => (b.kasus || 0) - (a.kasus || 0)).slice(0, 5);

    let provName = 'INDONESIA';
    if (kabFilter && kabFilter.length > 0) provName = kabFilter.join(', ');
    else if (wilayahFilter && wilayahFilter.length > 0) provName = wilayahFilter.join(', ');
    else if (selectedRs && hospitalsData[selectedRs.value]) provName = hospitalsData[selectedRs.value].prop;
    
    let isJabar = false;
    if (provName.toUpperCase().includes('JAWA BARAT') && (!kabFilter || kabFilter.length === 0) && (!wilayahFilter || wilayahFilter.length === 0)) {
      isJabar = true;
    }

    return { provName, isJabar, counts, totalKasus, totalIna, totalIdrg, topHospitals, compCases, totalActive: regHospitals.length };
  }, [selectedRs, hospitalsData, profilesData, simulasiKey, wilayahFilter, kabFilter]);

  if (!data) return null;

  const lblMap = {
    'dasar': 'Dasar',
    'madya': 'Madya',
    'utama': 'Utama',
    'paripurna': 'Paripurna',
    'lainnya': 'Lainnya*'
  };

  const compData = [
    { key: 'dasar', cases: data.compCases.dasar },
    { key: 'madya', cases: data.compCases.madya },
    { key: 'utama', cases: data.compCases.utama },
    { key: 'paripurna', cases: data.compCases.paripurna },
    { key: 'lainnya', cases: data.compCases.lainnya }
  ];

  return (
    <div style={{ marginBottom: '32px', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f766e', color: 'white', padding: '16px 24px', borderBottom: '6px solid #d97706' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
          Profil & Kasus Regional - {selectedRs?.label?.split(' (')[0] || ''}
        </h2>
        <div style={{ background: '#e11d48', padding: '4px 16px', borderRadius: '24px', fontSize: '0.85rem', fontWeight: 700 }}>
          Data Mirroring uji coba iDRG periode 15 Okt 2025 - 14 Mar 2026
        </div>
      </div>

      <div style={{ padding: '24px', background: '#f8fafc', display: 'flex', gap: '24px' }}>
        {/* Left Side: Map representation */}
        <div style={{ flex: '0 0 320px', background: '#e0f2fe', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #bae6fd', position: 'relative' }}>
          <div style={{ background: '#38bdf8', borderRadius: '50%', padding: '24px', marginBottom: '16px' }}>
             <Map size={80} color="white" />
          </div>
          <div style={{ background: '#0ea5e9', color: 'white', padding: '6px 16px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, position: 'absolute', top: '50%', transform: 'translateY(-50%)' }}>
            <MapPin size={16} /> {data.provName}
          </div>
          <div style={{ position: 'absolute', bottom: '24px', left: '24px', right: '24px' }}>
            <div style={{ color: '#c2410c', fontWeight: 800, fontSize: '1.1rem' }}>PROVINSI {data.provName}:</div>
            <div style={{ color: '#d97706', fontWeight: 600, fontSize: '0.9rem' }}>
              {data.isJabar ? 'Kecuali Wilayah Bekasi, Bogor & Depok' : 'Seluruh Faskes Aktif'}
            </div>
          </div>
        </div>

        {/* Right Side: Data */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Stats Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '1.2rem', color: '#64748b', fontWeight: 600 }}>Sebaran RS AKTIF: <span style={{ color: '#ef4444', fontWeight: 800 }}>{data.totalActive}</span></div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#334155', letterSpacing: '1px' }}>
                <span style={{ color: '#10b981' }}>A: {data.counts.A}</span> | <span style={{ color: '#3b82f6' }}>B: {data.counts.B}</span> | <span style={{ color: '#8b5cf6' }}>C: {data.counts.C}</span> | <span style={{ color: '#f59e0b' }}>D: {data.counts.D}</span>
              </div>
              <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px', fontSize: '0.95rem', fontWeight: 700, color: '#475569' }}>
                <div style={{ textTransform: 'uppercase' }}>Total Kasus Regional</div>
                <div>: {data.totalKasus.toLocaleString('id-ID')} Kasus</div>
                <div style={{ textTransform: 'uppercase' }}>Pendapatan INA-CBG Regional</div>
                <div>: Rp {(data.totalIna / 1000000000000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T</div>
                <div style={{ textTransform: 'uppercase' }}>Potensi iDRG Regional</div>
                <div>: Rp {(data.totalIdrg / 1000000000000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T</div>
              </div>
            </div>
            
            <div style={{ border: '2px solid #334155', borderRadius: '8px', padding: '16px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <img src="/building.png" alt="Hospital Building" style={{ width: '80px', opacity: 0.8 }} onError={(e) => { e.target.style.display = 'none' }} />
               <div style={{ fontSize: '3rem', margin: '-10px 0 0 -40px', display: 'none' }}>🏥</div>
            </div>
          </div>

          {/* Tables Row */}
          <div style={{ display: 'flex', gap: '24px' }}>
            
            {/* Left Table (Comp) */}
            <div style={{ flex: '0 0 320px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.9rem' }}>
                <thead style={{ background: '#0f766e', color: 'white' }}>
                  <tr>
                    <th style={{ padding: '8px', border: '1px solid white' }}>TINGKAT</th>
                    <th style={{ padding: '8px', border: '1px solid white' }}>KASUS</th>
                    <th style={{ padding: '8px', border: '1px solid white' }}>%</th>
                  </tr>
                </thead>
                <tbody style={{ background: 'white' }}>
                  {compData.map(row => (
                    <tr key={row.key} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px', borderRight: '1px solid #e2e8f0', textAlign: 'left', fontWeight: row.key === 'dasar' ? 700 : 500, color: row.key === 'dasar' ? '#15803d' : 'inherit' }}>
                        {lblMap[row.key]}
                      </td>
                      <td style={{ padding: '8px', borderRight: '1px solid #e2e8f0' }}>{row.cases.toLocaleString('id-ID')}</td>
                      <td style={{ padding: '8px', borderRight: '1px solid #e2e8f0' }}>
                        {data.totalKasus > 0 ? ((row.cases / data.totalKasus) * 100).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0'}%
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#fef3c7', fontWeight: 800 }}>
                    <td style={{ padding: '8px', borderRight: '1px solid #fde68a' }}>TOTAL<br/>REGIONAL</td>
                    <td style={{ padding: '8px', borderRight: '1px solid #fde68a' }}>{data.totalKasus.toLocaleString('id-ID')}</td>
                    <td style={{ padding: '8px', borderRight: '1px solid #fde68a' }}>100,0%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right Table (Top 5) */}
            <div style={{ flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.85rem' }}>
                <thead style={{ background: '#d97706', color: 'white' }}>
                  <tr>
                    <th style={{ padding: '8px', border: '1px solid white', width: '40px' }}>NO</th>
                    <th style={{ padding: '8px', border: '1px solid white', textAlign: 'left' }}>RUMAH SAKIT</th>
                    <th style={{ padding: '8px', border: '1px solid white', width: '60px' }}>KELAS</th>
                    <th style={{ padding: '8px', border: '1px solid white' }}>KASUS</th>
                  </tr>
                </thead>
                <tbody style={{ background: 'white' }}>
                  {data.topHospitals.map((h, i) => (
                    <tr key={h.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 8px', borderRight: '1px solid #e2e8f0' }}>{i + 1}</td>
                      <td style={{ padding: '10px 8px', borderRight: '1px solid #e2e8f0', textAlign: 'left', fontWeight: 600 }}>{h.nama}</td>
                      <td style={{ padding: '10px 8px', borderRight: '1px solid #e2e8f0' }}>{h.kelasFaskes}</td>
                      <td style={{ padding: '10px 8px', borderRight: '1px solid #e2e8f0' }}>{(h.kasus || 0).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

          {/* Footer Notes */}
          <div style={{ background: '#e0f2fe', padding: '12px 16px', borderRadius: '8px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ background: '#fef08a', padding: '8px', borderRadius: '50%' }}>
              <span style={{ fontSize: '1.2rem', display: 'flex' }}>💡</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '16px', color: '#475569', fontSize: '0.9rem', flex: 1 }}>
              <li>Terdapat <strong>{data.totalKasus.toLocaleString('id-ID')}</strong> total kasus pada layanan regional yang dianalisis.</li>
              <li>Penyebaran kasus terbanyak berada pada kompetensi Dasar {((compData[0].cases / data.totalKasus) * 100).toLocaleString('id-ID', {minimumFractionDigits: 0, maximumFractionDigits: 0})}% ({compData[0].cases.toLocaleString('id-ID')} kasus).</li>
            </ul>
            <img src="/logo-kemenkes.png" alt="Kemenkes" style={{ height: '32px' }} />
          </div>

        </div>
      </div>
      <div style={{ padding: '0 24px 16px 24px', fontSize: '0.85rem', fontStyle: 'italic', color: '#64748b', background: '#f8fafc' }}>
        *Lainnya Adalah Kasus yang belum terdapat Mapping Kompetensi ICD
      </div>
    </div>
  );
};

export default RegionalProfileSection;
