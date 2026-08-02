import React, { useMemo } from 'react';
import { X } from 'lucide-react';

const SERVICE_ORDER = [
  { id: 'mata', label: 'Mata' },
  { id: 'endokrin, nutrisi dan metabolik', label: 'Endokrin, Nutrisi dan Metabolik' },
  { id: 'jiwa', label: 'Jiwa' },
  { id: 'alergi imunologi dan rheumatologi', label: 'Alergi Imunologi dan Rheumatologi' },
  { id: 'keracunan', label: 'Keracunan' },
  { id: 'forensik', label: 'Forensik' },
  { id: 'rehabilitasi', label: 'Rehabilitasi' },
  { id: 'neonatus', label: 'Neonatus' },
  { id: 'saraf/ neuroscience', label: 'Saraf/Neuroscience' },
  { id: 'musculoskeletal dan jaringan lunak', label: 'Musculoskeletal' },
  { id: 'jantung dan pembuluh darah', label: 'Jantung dan Pembuluh Darah' },
  { id: 'infeksi dan parasit', label: 'Infeksi dan Parasit' },
  { id: 'gigi dan mulut', label: 'Gigi' },
  { id: 'tht', label: 'THT' },
  { id: 'rekonstruksi dan estetika', label: 'Rekonstruksi dan Estetika' },
  { id: 'neoplasma', label: 'Neoplasma' },
  { id: 'trauma', label: 'Trauma' },
  { id: 'hematologi', label: 'Hematologi' },
  { id: 'pencernaan dan hepatobilier', label: 'Pencernaan dan Hepatobiliar' },
  { id: 'kulit & penyakit kelamin', label: 'Kulit dan Penyakit Kelamin' },
  { id: 'uro nefro', label: 'Uro Nefro' },
  { id: 'paru dan pernafasan', label: 'Paru dan Pernafasan' },
  { id: 'ibu dan ginekologi', label: 'Ibu dan Ginekologi' },
  { id: 'luka bakar', label: 'Bum' }
];

const RsProfileModal = ({ rs, profile, onClose, simulasiKey, rsKompetensiOnline }) => {
  const { tableData, totalCases } = useMemo(() => {
    if (!rs || !profile) return { tableData: [], totalCases: 0 };
    
    let tKasus = 0;
    const byLayanan = profile?.crosstab?.byLayanan || {};
    const byKompetensi = profile?.crosstab?.byKompetensi || {};
    
    // Hitung total dari byKompetensi (lebih akurat krn mencakup Lainnya)
    Object.values(byKompetensi).forEach(ptdMap => {
      ['rj', 'ri'].forEach(t => {
        if (ptdMap[t]) {
          Object.values(ptdMap[t]).forEach(d => {
            tKasus += (d.kasus || 0);
          });
        }
      });
    });

    let totalLayananCases = 0;
    let totalLayananIdrg = 0;

    const dataMap = SERVICE_ORDER.map(svcDef => {
      const svcData = byLayanan[svcDef.id] || null;
      let cases = 0;
      let idrg = 0;
      let comp = 'Tidak Kompeten';

      if (svcData && svcData.byKompetensi) {
        Object.values(svcData.byKompetensi).forEach(ptdMap => {
          ['rj', 'ri'].forEach(t => {
            if (ptdMap[t]) {
              Object.values(ptdMap[t]).forEach(d => {
                cases += (d.kasus || 0);
                let simVal = 0;
                if (d.sim && simulasiKey) {
                  simVal = d.sim[simulasiKey] || d.sim[simulasiKey.replace('tarif', 'sim')] || 0;
                }
                idrg += simVal;
              });
            }
          });
        });
        totalLayananCases += cases;
        totalLayananIdrg += idrg;

        // Lookup competency from rsKompetensiOnline if available
        const kodeRs = rs?.kode || rs?.value;
        const normKel = svcDef.id.toLowerCase().trim();
        
        if (rsKompetensiOnline && kodeRs && rsKompetensiOnline[kodeRs] && rsKompetensiOnline[kodeRs][normKel]) {
          const compLower = rsKompetensiOnline[kodeRs][normKel].toLowerCase();
          if (compLower === 'tidak kompeten' || compLower === 'belum ada komp. icd') {
            comp = 'Tidak Kompeten';
          } else if (compLower !== 'unknown') {
            comp = compLower.charAt(0).toUpperCase() + compLower.slice(1);
          } else {
            // fallback
            const counts = { dasar: 0, madya: 0, utama: 0, paripurna: 0 };
            Object.values(svcData.byKompetensi).forEach(ptdMap => {
              ['rj', 'ri'].forEach(t => {
                if (ptdMap[t]) {
                  Object.entries(ptdMap[t]).forEach(([lvl, d]) => {
                    const norm = lvl.toLowerCase().trim();
                    if (counts[norm] !== undefined) counts[norm] += (d.kasus || 0);
                  });
                }
              });
            });
            if (counts.paripurna > 0) comp = 'Paripurna';
            else if (counts.utama > 0) comp = 'Utama';
            else if (counts.madya > 0) comp = 'Madya';
            else if (counts.dasar > 0) comp = 'Dasar';
            else comp = 'Tidak Kompeten';
          }
        } else {
          // fallback
          const counts = { dasar: 0, madya: 0, utama: 0, paripurna: 0 };
          Object.values(svcData.byKompetensi).forEach(ptdMap => {
            ['rj', 'ri'].forEach(t => {
              if (ptdMap[t]) {
                Object.entries(ptdMap[t]).forEach(([lvl, d]) => {
                  const norm = lvl.toLowerCase().trim();
                  if (counts[norm] !== undefined) counts[norm] += (d.kasus || 0);
                });
              }
            });
          });
          if (counts.paripurna > 0) comp = 'Paripurna';
          else if (counts.utama > 0) comp = 'Utama';
          else if (counts.madya > 0) comp = 'Madya';
          else if (counts.dasar > 0) comp = 'Dasar';
          else comp = 'Tidak Kompeten';
        }
      } else {
        comp = 'Tidak Kompeten';
      }

      return {
        ...svcDef,
        cases,
        idrg,
        comp
      };
    });

    // Menghitung Lainnya
    let lainnyaCases = 0;
    let lainnyaIdrg = 0;
    Object.values(byKompetensi).forEach(ptdMap => {
      ['rj', 'ri'].forEach(t => {
        if (ptdMap[t]) {
          Object.values(ptdMap[t]).forEach(d => {
            let simVal = 0;
            if (d.sim && simulasiKey) {
              simVal = d.sim[simulasiKey] || d.sim[simulasiKey.replace('tarif', 'sim')] || 0;
            }
            lainnyaIdrg += simVal;
          });
        }
      });
    });
    
    lainnyaCases = tKasus - totalLayananCases;
    lainnyaIdrg = lainnyaIdrg - totalLayananIdrg;
    
    dataMap.push({
      id: 'lainnya',
      label: 'Lainnya*',
      cases: Math.max(0, lainnyaCases),
      idrg: Math.max(0, lainnyaIdrg),
      comp: '-'
    });

    return { tableData: dataMap, totalCases: tKasus };
  }, [rs, profile, simulasiKey, rsKompetensiOnline]);

  if (!rs) return null;

  const leftCol = tableData.slice(0, 12);
  const rightCol = tableData.slice(12);

  const getCompBg = (comp) => {
    switch(comp.toLowerCase()) {
      case 'paripurna': return '#0f766e';
      case 'utama': return '#22c55e';
      case 'madya': return '#a3e635';
      case 'dasar': return '#fef08a';
      default: return '#ffffff';
    }
  };

  const getCompColor = (comp) => {
    switch(comp.toLowerCase()) {
      case 'paripurna': 
      case 'utama':
        return '#ffffff';
      default: return '#1e293b';
    }
  };

  const rsName = rs.label.split(' (')[0];
  const dominantService = [...tableData].sort((a,b)=>b.cases-a.cases)[0];

  const TableHeader = () => (
    <thead style={{ background: '#14b8a6', color: 'white' }}>
      <tr>
        <th style={{ padding: '8px', border: '1px solid white', width: '30px', textAlign: 'center' }}>No</th>
        <th style={{ padding: '8px', border: '1px solid white', textAlign: 'center' }}>Kelompok<br/>Layanan RS</th>
        <th style={{ padding: '8px', border: '1px solid white', textAlign: 'center' }}>Kompetensi RS<br/>Saat Ini</th>
        <th style={{ padding: '8px', border: '1px solid white', textAlign: 'center' }}>Kasus</th>
        <th style={{ padding: '8px', border: '1px solid white', textAlign: 'center' }}>% Kasus</th>
        <th style={{ padding: '8px', border: '1px solid white', textAlign: 'center' }}>Pendapatan<br/>iDRG</th>
      </tr>
    </thead>
  );

  const renderRows = (data, startIndex) => {
    return data.map((row, idx) => (
      <tr key={row.id}>
        <td style={{ padding: '6px 8px', border: '1px solid #d1d5db', textAlign: 'center' }}>{startIndex + idx}</td>
        <td style={{ padding: '6px 8px', border: '1px solid #d1d5db' }}>{row.label}</td>
        <td style={{ padding: '6px 8px', border: '1px solid #d1d5db', background: getCompBg(row.comp), color: getCompColor(row.comp) }}>{row.comp}</td>
        <td style={{ padding: '6px 8px', border: '1px solid #d1d5db', textAlign: 'right' }}>{row.cases.toLocaleString()}</td>
        <td style={{ padding: '6px 8px', border: '1px solid #d1d5db', textAlign: 'right' }}>
          {totalCases > 0 ? ((row.cases / totalCases) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0}%
        </td>
        <td style={{ padding: '6px 8px', border: '1px solid #d1d5db', textAlign: 'right' }}>
          {row.cases > 0 ? (row.idrg >= 1000000000 ? `Rp ${(row.idrg/1000000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})} M` : `Rp ${(row.idrg/1000000).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})} Jt`) : 'Rp 0 Jt'}
        </td>
      </tr>
    ));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(0,0,0,0.6)' }}>
      <div style={{ background: 'white', width: '100%', maxWidth: '1200px', maxHeight: '95vh', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        
        {/* HEADER */}
        <div style={{ background: '#14b8a6', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '6px solid #d97706' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>Kelompok Layanan Penyakit - {rsName}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: '#e11d48', padding: '6px 20px', borderRadius: '24px', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
              Data Mirroring uji coba iDRG<br/>periode 15 Okt 2025 - 14 Mar 2026
            </div>
            
            <button 
              onClick={() => {
                if (window.handleExportKertasKerjaExcel) {
                  window.handleExportKertasKerjaExcel();
                } else {
                  alert('Fungsi export belum tersedia di konteks ini.');
                }
              }}
              style={{ background: '#2563eb', border: '1px solid #1d4ed8', color: 'white', cursor: 'pointer', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              Export Excel
            </button>

            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}>
              <X size={28} />
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#ffffff' }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            
            <div style={{ flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                {TableHeader()}
                <tbody>
                  {renderRows(leftCol, 1)}
                </tbody>
              </table>
            </div>
            
            <div style={{ flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                {TableHeader()}
                <tbody>
                  {renderRows(rightCol, 13)}
                </tbody>
              </table>
            </div>

            {/* LEGEND */}
            <div style={{ width: '220px', background: '#f8fafc', padding: '16px', border: 'none', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '1rem', fontWeight: 600 }}>Keterangan:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                {[
                  { label: 'Paripurna', color: '#0f766e' },
                  { label: 'Utama', color: '#22c55e' },
                  { label: 'Madya', color: '#a3e635' },
                  { label: 'Dasar', color: '#fef08a' },
                  { label: 'Tidak Kompeten', color: '#ffffff' }
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '18px', background: l.color, border: '1px solid #1e293b' }}></div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>{l.label}</span>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', color: '#1e293b', fontSize: '0.95rem', lineHeight: 1.4, marginTop: '24px' }}>
                {rsName} melayani<br/>kasus mayoritas<br/>
                <strong style={{ fontSize: '1rem', display: 'block', marginTop: '4px' }}>Kompetensi Layanan RS<br/>{dominantService?.label || 'Mata'}</strong>
              </div>
            </div>

          </div>
          
          <div style={{ marginTop: '32px', fontSize: '0.85rem', color: '#64748b', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span>* Data Kompetensi RS RS Online Update per 3 Juni 2026</span>
            <span>* Lainnya adalah Kasus yang belum memiliki Mapping ICD</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default RsProfileModal;
