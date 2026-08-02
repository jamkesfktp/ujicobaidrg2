import React, { useMemo, useState } from 'react';
import { X, Building2, Award, AlertTriangle, CheckCircle2, LayoutGrid, Table2 } from 'lucide-react';
import { formatCompactCurrency } from '../utils/formatters';

const HospitalProfileCard = ({ rs, profile, simulasi, onClose, isExportMode = false, excludeNonKomp = true, rsKompetensiOnline }) => {
  if (!rs) return null;

  const simulasiKey = `tarif_${simulasi}`;
  const scorecard = profile?.scorecard;
  const svc = profile?.svc;
  const [viewMode, setViewMode] = useState('card');

  // Resolve rs.sim — in dataset4 it's an object {tarif_1: ..., tarif_2: ...}
  const rsSimValue = typeof rs?.sim === 'object' && rs?.sim !== null
    ? (rs.sim[simulasiKey] || rs.sim['tarif_2'] || Object.values(rs.sim)[0] || 0)
    : (rs?.sim || 0);


  // Global Competence mapping
  const levelOrder = ['tidak kompeten', 'belum ada komp. icd', 'dasar', 'madya', 'utama', 'paripurna'];
  const getLevelIndex = (lvl) => levelOrder.indexOf(lvl?.toLowerCase()) > -1 ? levelOrder.indexOf(lvl?.toLowerCase()) : 0;
  
  // (Removed global competence fallback logic)

  const { totalScorecard, levelStats } = useMemo(() => {
    let totalKasus = 0;
    const stats = { dasar: 0, madya: 0, utama: 0, paripurna: 0, unclassified: 0 };
    
    if (scorecard?.byKompetensi) {
      Object.entries(scorecard.byKompetensi || {}).forEach(([komp, data]) => {
        const cases = (data.sesuai?.kasus || 0) + (data.loss?.kasus || 0);
        totalKasus += cases;
        const k = komp.toLowerCase();
        if (stats[k] !== undefined) stats[k] += cases;
        else stats.unclassified += cases;
      });
    }
    return { totalScorecard: totalKasus, levelStats: stats };
  }, [scorecard]);

  const { totalCasesGlobal, totalIdrgGlobal } = useMemo(() => {
    let tKasus = 0; let tIdrg = 0;
    if (svc) {
       Object.values(svc).forEach(svcData => {
         ['ri', 'rj'].forEach(type => {
            if (svcData[type]) {
               Object.values(svcData[type]).forEach(arr => {
                  tKasus += arr[0] || 0;
                  tIdrg += arr[simulasi + 1] || 0;
               });
            }
         });
       });
    }
    return { totalCasesGlobal: tKasus, totalIdrgGlobal: tIdrg };
  }, [svc, simulasi]);

  const allServices = useMemo(() => {
    const services = [];
    
    if (svc && Object.keys(svc || {}).length > 0) {
      Object.entries(svc || {}).forEach(([svcName, svcData]) => {
        let totalCases = 0;
        let totalIdrg = 0;
        const compBreakdown = {};
        
        ['ri', 'rj'].forEach(type => {
          if (svcData[type]) {
            Object.entries(svcData[type] || {}).forEach(([compLvl, arr]) => {
              const cases = arr[0] || 0;
              const idrg = arr[simulasi + 1] || 0;
              totalCases += cases;
              totalIdrg += idrg;
              if (!compBreakdown[compLvl]) compBreakdown[compLvl] = { cases: 0, idrg: 0 };
              compBreakdown[compLvl].cases += cases;
              compBreakdown[compLvl].idrg += idrg;
            });
          }
        });
        if (totalCases > 0 && (svcName !== 'Unknown' || !excludeNonKomp)) {
          const kelompokData = scorecard?.byKelompok?.[svcName] || {};
          let competency = 'Tidak Ditemukan';
          const rsCode = rs.kode || rs.value || rs.id;
          
          if (rsKompetensiOnline && rsCode && rsKompetensiOnline[rsCode]) {
             const rsData = rsKompetensiOnline[rsCode];
             const svcLowerClean = svcName.toLowerCase().replace(/\s+/g, '');
             const matchedKey = Object.keys(rsData).find(k => k.replace(/\s+/g, '') === svcLowerClean);
             if (matchedKey && rsData[matchedKey]) {
                 competency = rsData[matchedKey];
             }
          }
          
          const pctKasus = totalCasesGlobal > 0 ? (totalCases / totalCasesGlobal * 100) : 0;
          const pctIdrg = totalIdrgGlobal > 0 ? (totalIdrg / totalIdrgGlobal * 100) : 0;
          
          services.push({ 
            name: svcName === 'Unknown' ? 'Layanan Lainnya' : svcName, 
            cases: totalCases, 
            idrg: totalIdrg, 
            breakdown: compBreakdown, 
            competency,
            pctKasus,
            pctIdrg
          });
        }
      });
    } else if (scorecard && scorecard.byKelompok) {
      // Fallback for dataset4 which doesn't have svc field in rs_profiles
      Object.entries(scorecard.byKelompok || {}).forEach(([svcName, kelompokData]) => {
        const kasusSesuai = kelompokData.sesuai?.kasus || 0;
        const kasusLoss = kelompokData.loss?.kasus || 0;
        const totalCases = kasusSesuai + kasusLoss;
        
        const simSesuai = typeof kelompokData.sesuai?.sim === 'object' && kelompokData.sesuai?.sim !== null 
          ? (kelompokData.sesuai.sim[`tarif_${simulasi}`] || 0) : (kelompokData.sesuai?.sim || 0);
        const simLoss = typeof kelompokData.loss?.sim === 'object' && kelompokData.loss?.sim !== null
          ? (kelompokData.loss.sim[`tarif_${simulasi}`] || 0) : (kelompokData.loss?.sim || 0);
          
        const totalIdrg = simSesuai + simLoss;

        if (totalCases > 0 && (svcName !== 'Unknown' || !excludeNonKomp)) {
          let competency = 'Tidak Ditemukan';
          const rsCode = rs.kode || rs.value || rs.id;
          
          if (rsKompetensiOnline && rsCode && rsKompetensiOnline[rsCode]) {
             const rsData = rsKompetensiOnline[rsCode];
             const svcLowerClean = svcName.toLowerCase().replace(/\s+/g, '');
             const matchedKey = Object.keys(rsData).find(k => k.toLowerCase().replace(/\s+/g, '') === svcLowerClean);
             if (matchedKey && rsData[matchedKey]) {
                 competency = rsData[matchedKey];
             }
          } else if (profile && profile.faskes_komp) {
             const svcLowerClean = svcName.toLowerCase().replace(/\s+/g, '');
             const matchedKey = Object.keys(profile.faskes_komp).find(k => k.toLowerCase().replace(/\s+/g, '') === svcLowerClean);
             if (matchedKey && profile.faskes_komp[matchedKey]) {
                 competency = profile.faskes_komp[matchedKey];
             }
          } else if (rs.faskesKomp) {
             const svcLowerClean = svcName.toLowerCase().replace(/\s+/g, '');
             const matchedKey = Object.keys(rs.faskesKomp).find(k => k.toLowerCase().replace(/\s+/g, '') === svcLowerClean);
             if (matchedKey && rs.faskesKomp[matchedKey]) {
                 competency = rs.faskesKomp[matchedKey];
             }
          }
          
          const pctKasus = totalCasesGlobal > 0 ? (totalCases / totalCasesGlobal * 100) : 0;
          const pctIdrg = totalIdrgGlobal > 0 ? (totalIdrg / totalIdrgGlobal * 100) : 0;
          
          services.push({ 
            name: svcName === 'Unknown' ? 'Layanan Lainnya' : svcName, 
            cases: totalCases, 
            idrg: totalIdrg, 
            breakdown: {}, // Breakdown unavailable in fallback
            competency,
            pctKasus,
            pctIdrg
          });
        }
      });
    }

    
    const compOrder = {
      'paripurna': 5,
      'utama': 4,
      'madya': 3,
      'dasar': 2,
      'tidak kompeten': 1,
      'belum ada': 0,
      'belum ada komp. icd': 0,
      'unknown': -1,
    };
    
    return services.sort((a, b) => {
      const getScore = (c) => {
        if (!c) return -1;
        const cl = c.toLowerCase();
        for (const [key, score] of Object.entries(compOrder)) {
          if (cl.includes(key)) return score;
        }
        return -1;
      };
      const valA = getScore(a.competency);
      const valB = getScore(b.competency);
      if (valA !== valB) return valB - valA;
      return b.cases - a.cases;
    });
  }, [svc, simulasi, scorecard, totalCasesGlobal, totalIdrgGlobal, excludeNonKomp, rsKompetensiOnline, rs]);
  
  const topService = allServices.length > 0 ? allServices[0] : null;

  return (
    <div 
      id={isExportMode ? undefined : "export-data-container"} 
      className={isExportMode ? "card" : "card animate-fade-in-up"} 
      style={isExportMode ? { padding: '20px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' } : { marginTop: '24px', borderTop: '4px solid #3b82f6', position: 'relative' }}
    >
      {!isExportMode && onClose && (
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'var(--bg-secondary)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
        >
          <X size={18} />
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '32px', flexWrap: 'wrap' }}>
        
        {/* LEFT COLUMN: Hospital Profile & Scorecard */}
        <div style={{ flex: '1 1 350px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '12px' }}>
              <Building2 size={32} color="#3b82f6" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)' }}>{rs.nama}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>Kelas {rs.kelas || rs.kelasFaskes || 'N/A'}</span>
                {topService && (
                  <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 600, textTransform: 'capitalize' }}>
                    Unggulan: {topService.name} ({topService.competency})
                  </span>
                )}
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{rs.prop}</span>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: 'var(--bg-app)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Kasus</p>
              <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{rs.kasus?.toLocaleString() || 0}</h4>
            </div>
            <div style={{ background: 'var(--bg-app)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>INA-CBG</p>
              <h4 style={{ margin: 0, fontSize: '1.2rem', color: '#e67e22' }}>{formatCompactCurrency(rs.inacbg || 0)}</h4>
            </div>
            <div style={{ background: 'var(--bg-app)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>iDRG</p>
              <h4 style={{ margin: 0, fontSize: '1.2rem', color: '#27ae60' }}>{formatCompactCurrency(rsSimValue)}</h4>
            </div>
          </div>

          {/* Scorecard Breakdown */}
          <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>Sebaran Kasus Berdasarkan Kompetensi Klinis</h4>
            {['dasar', 'madya', 'utama', 'paripurna'].map(lvl => {
              const count = levelStats[lvl] || 0;
              const pct = totalScorecard > 0 ? ((count / totalScorecard) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : 0;
              
              return (
                <div key={lvl} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {lvl}
                    </span>
                    <span style={{ fontWeight: 600 }}>{count.toLocaleString()} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct}%)</span></span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#3b82f6', borderRadius: '4px' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Service Breakdown */}
        <div style={{ flex: '1 1 450px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <Award size={18} color="var(--primary-color)" />
              Rincian Kelompok Layanan & Kesesuaian Kompetensi
            </h4>
            {!isExportMode && (
              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-app)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <button 
                  onClick={() => setViewMode('card')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: viewMode === 'card' ? 'var(--primary-color)' : 'transparent', color: viewMode === 'card' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}
                >
                  <LayoutGrid size={14} /> Kartu
                </button>
                <button 
                  onClick={() => setViewMode('table')}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: viewMode === 'table' ? 'var(--primary-color)' : 'transparent', color: viewMode === 'table' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s' }}
                >
                  <Table2 size={14} /> Tabel
                </button>
              </div>
            )}
          </div>
          
          <div style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '450px', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {allServices.length > 0 ? (
              viewMode === 'card' ? (
                allServices.map((svc, idx) => (
                  <div key={idx} style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '12px' }}>
                      <div>
                        <h5 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{svc.name}</h5>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Total: <strong style={{color: 'var(--text-primary)'}}>{svc.cases.toLocaleString()} Kasus</strong> ({svc.pctKasus.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>|</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Kompetensi RS: <strong style={{color: '#f59e0b', textTransform: 'capitalize'}}>{svc.competency}</strong>
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Pendapatan iDRG</div>
                        <div style={{ fontWeight: 800, color: '#27ae60', fontSize: '1.1rem' }}>{formatCompactCurrency(svc.idrg)}</div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                      {Object.entries(svc.breakdown || {}).map(([lvl, data]) => {
                        if (data.cases === 0) return null;
                        const lvlIndex = getLevelIndex(lvl);
                        const rsKompIndex = getLevelIndex(svc.competency);
                        const isOverreach = lvlIndex > rsKompIndex;
                        
                        return (
                          <div key={lvl} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 10px', background: isOverreach ? '#fef2f2' : '#f8fafc', border: `1px solid ${isOverreach ? '#fecaca' : '#e2e8f0'}`, borderRadius: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isOverreach ? <AlertTriangle size={12} color="#ef4444" /> : <CheckCircle2 size={12} color="#10b981" />}
                                <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: isOverreach ? '#dc2626' : 'var(--text-secondary)', fontWeight: 600 }}>
                                  {lvl === 'belum ada komp. icd' ? 'N/A' : lvl}
                                </span>
                              </div>
                              <strong style={{ fontSize: '0.85rem', color: isOverreach ? '#ef4444' : 'var(--text-primary)' }}>{data.cases.toLocaleString()} Kasus</strong>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: isOverreach ? '#ef4444' : '#27ae60', fontWeight: 700, textAlign: 'right' }}>
                              {formatCompactCurrency(data.idrg)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ overflowX: 'auto', background: 'var(--bg-app)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)' }}>Layanan</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>Kasus</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>% Kasus</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)' }}>Kompetensi RS</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>Pendapatan iDRG</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>% Pendapatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allServices.map((svc, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{svc.name}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{svc.cases.toLocaleString()}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>{svc.pctKasus.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#d97706', textTransform: 'capitalize' }}>{svc.competency}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#27ae60' }}>{formatCompactCurrency(svc.idrg)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>{svc.pctIdrg.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-app)', borderRadius: '8px' }}>
                 Data layanan spesifik tidak tersedia
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HospitalProfileCard;
