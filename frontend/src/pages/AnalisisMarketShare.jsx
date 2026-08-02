import React, { useState, useEffect } from 'react';
import { Activity, PieChart, Map, BarChart2, TrendingUp } from 'lucide-react';
import DownloadExcelButton from '../components/DownloadExcelButton';
import { formatCompactCurrency, formatCurrency , formatTableMiliar} from '../utils/formatters';
import DownloadPptxButton from '../components/DownloadPptxButton';
import { filterHospital } from '../utils/filterUtils';
import { loadDatasetFile } from '../utils/dataLoader';
import HospitalProfileCard from '../components/HospitalProfileCard';
import Select from 'react-select';

const TRIAL_KABS = ['KOTA BANDUNG', 'KOTA MAKASSAR', 'KABUPATEN TULUNGAGUNG', 'KOTA TULUNGAGUNG', 'KABUPATEN MUARA ENIM', 'MUARA ENIM'];

const AnalisisMarketShare = ({ dataset, simulasi, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp, globalMonth, globalDrg, rsKompetensiOnline } ) => {
  const [hospitalsData, setHospitalsData] = useState(null);
  const [rsProfilesData, setRsProfilesData] = useState(null);
  const [selectedRsKode, setSelectedRsKode] = useState('');
  const [selectedRsObj, setSelectedRsObj] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadDatasetFile(dataset, 'hospitals', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'rs_profiles', globalMonth, globalDrg)
    ])
      .then(([hosp, profs]) => {
        setHospitalsData(hosp);
        setRsProfilesData(profs);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [dataset]);

  if (loading || !hospitalsData) {
    return (
      <div className="flex-center" style={{ height: '100%', color: 'var(--text-secondary)' }}>
        <Activity className="animate-spin" size={48} />
        <span style={{ marginLeft: '16px' }}>Memuat Analisis Market Share...</span>
      </div>
    );
  }

  const activeLayananFilters = groupFilter ? groupFilter.filter(f => f.startsWith('layanan_')).map(f => f.replace('layanan_', '')) : [];

  const filteredRS = Object.entries(hospitalsData).map(([kode, rs]) => {
    let copy = { kode, ...rs };
    
    // Dynamic recalculation based on layanan_ filters
    if (activeLayananFilters.length > 0 && rs.byKelompok) {
      let sumKasus = 0, sumIna = 0, sumSim = 0;
      activeLayananFilters.forEach(layanan => {
         const layData = rs.byKelompok[layanan];
         if (layData) {
            sumKasus += layData.kasus || 0;
            sumIna += layData.inacbg || 0;
            sumSim += layData[`tarif_${simulasi}`] || 0;
         }
      });
      copy.kasus = sumKasus;
      copy.inacbg = sumIna;
      copy[`tarif_${simulasi}`] = sumSim;
    }
    return copy;
  }).filter(rs => {
    if (!filterHospital(rs, rs.kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp)) return false;
    if (activeLayananFilters.length > 0 && rs.kasus === 0) return false;
    return true;
  });

  let totalNasional = { kasus: 0, inacbg: 0, sim: 0 };
  const byKelas = {};
  const byProvinsi = {};

  filteredRS.forEach(rs => {
    const k = (rs.kelas || rs.kelasFaskes || 'LAINNYA').toUpperCase();
    const prop = rs.prop || 'TIDAK DIKETAHUI';
    const kasus = rs.kasus || 0;
    const inacbg = rs.inacbg || 0;
    const sim = rs[`tarif_${simulasi}`] || 0;

    totalNasional.kasus += kasus;
    totalNasional.inacbg += inacbg;
    totalNasional.sim += sim;

    if (!byKelas[k]) byKelas[k] = { kasus: 0, inacbg: 0, sim: 0 };
    byKelas[k].kasus += kasus;
    byKelas[k].inacbg += inacbg;
    byKelas[k].sim += sim;

    if (!byProvinsi[prop]) byProvinsi[prop] = {};
    if (!byProvinsi[prop][k]) byProvinsi[prop][k] = { kasus: 0, inacbg: 0, sim: 0 };
    byProvinsi[prop][k].kasus += kasus;
    byProvinsi[prop][k].inacbg += inacbg;
    byProvinsi[prop][k].sim += sim;
  });

  const validClasses = ['A', 'B', 'C', 'D'];
  const allListClasses = Object.keys(byKelas).sort();
  // Ensure we sort alphabetically but put 'LAINNYA' at the end
  const sortedClasses = allListClasses.filter(c => validClasses.includes(c)).sort();
  const otherClasses = allListClasses.filter(c => !validClasses.includes(c)).sort();
  const displayClasses = [...sortedClasses, ...otherClasses];

  // Prepare Excel Data - Tabel Nasional
  const excelDataNasional = (() => {
    const data = displayClasses.map(k => {
      const v = byKelas[k];
      const shareInacbg = totalNasional.inacbg > 0 ? (v.inacbg / totalNasional.inacbg) * 100 : 0;
      const shareSim = totalNasional.sim > 0 ? (v.sim / totalNasional.sim) * 100 : 0;
      return [
        `Kelas ${k}`,
        v.kasus,
        v.inacbg,
        v.sim,
        v.sim - v.inacbg,
        shareInacbg.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%',
        shareSim.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%'
      ];
    });
    
    // add total row
    data.push([
      "Total Nasional",
      totalNasional.kasus,
      totalNasional.inacbg,
      totalNasional.sim,
      totalNasional.sim - totalNasional.inacbg,
      '100%',
      '100%'
    ]);
    
    return data;
  })();

  // Prepare Excel Data - Tabel Pivot
  const excelDataPivot = (() => {
    const data = [];
    const sortedProvs = Object.keys(byProvinsi).sort();
    sortedProvs.forEach(prop => {
      const row = [prop];
      let rowKasus = 0, rowInacbg = 0, rowSim = 0;
      displayClasses.forEach(k => {
        const v = byProvinsi[prop][k] || { kasus: 0, inacbg: 0, sim: 0 };
        row.push(v.kasus, v.inacbg, v.sim);
        rowKasus += v.kasus;
        rowInacbg += v.inacbg;
        rowSim += v.sim;
      });
      // push total for prov
      row.push(rowKasus, rowInacbg, rowSim, rowSim - rowInacbg);
      data.push(row);
    });
    return data;
  })();

  const pivotHeaders = ["Provinsi"];
  displayClasses.forEach(k => {
    pivotHeaders.push(`Kelas ${k} Kasus`, `Kelas ${k} INA-CBG`, `Kelas ${k} iDRG`);
  });
  pivotHeaders.push("Total Kasus", "Total INA-CBG", "Total iDRG", "Selisih Total");

  return (
    <div className="animate-fade-in-up">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <TrendingUp color="var(--accent-primary)" /> Analisis Market Share
        </h1>
        <p className="text-secondary">
          Perbandingan pangsa pasar pendapatan fasilitas kesehatan secara nasional dan provinsi antara sistem eksisting (INA-CBG) dengan iDRG.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
        <div className="flex-between" style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChart size={20} color="var(--accent-secondary)" /> Ringkasan Nasional per Kelas RS
          </h3>
          <DownloadExcelButton 
            data={excelDataNasional}
            headers={["Kelas RS", "Total Kasus", "Pendapatan INA-CBG", "Pendapatan iDRG Simulasi", "Selisih Pendapatan", "% Share INA-CBG", "% Share iDRG"]}
            filename="MarketShare_Nasional"
          />
        </div>
        
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kelas RS</th>
                <th style={{ textAlign: 'right' }}>Total Kasus</th>
                <th style={{ textAlign: 'right' }}>Pendapatan INA-CBG (Rp Miliar)</th>
                <th style={{ textAlign: 'right' }}>Pendapatan iDRG (Rp Miliar)</th>
                <th style={{ textAlign: 'right' }}>Selisih Pendapatan (Rp Miliar)</th>
                <th style={{ textAlign: 'center' }}>% Share INA-CBG</th>
                <th style={{ textAlign: 'center' }}>% Share iDRG</th>
              </tr>
            </thead>
            <tbody>
              {displayClasses.map((k, i) => {
                const v = byKelas[k];
                const selisih = v.sim - v.inacbg;
                const selisihColor = selisih > 0 ? 'var(--accent-success)' : (selisih < 0 ? 'var(--accent-danger)' : 'inherit');
                const shareInacbg = totalNasional.inacbg > 0 ? (v.inacbg / totalNasional.inacbg) * 100 : 0;
                const shareSim = totalNasional.sim > 0 ? (v.sim / totalNasional.sim) * 100 : 0;
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>Kelas {k}</td>
                    <td style={{ textAlign: 'right' }}>{v.kasus.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatTableMiliar(v.inacbg)}</td>
                    <td style={{ textAlign: 'right' }}>{formatTableMiliar(v.sim)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: selisihColor }}>{selisih > 0 ? '+' : ''}{formatTableMiliar(selisih)}</td>
                    <td style={{ textAlign: 'center' }}>{shareInacbg.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--text-primary)' }}>{shareSim.toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-tertiary)', fontWeight: 'bold' }}>
                <td>Total Nasional</td>
                <td style={{ textAlign: 'right' }}>{totalNasional.kasus.toLocaleString()}</td>
                <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatTableMiliar(totalNasional.inacbg)}</td>
                <td style={{ textAlign: 'right' }}>{formatTableMiliar(totalNasional.sim)}</td>
                <td style={{ textAlign: 'right', color: (totalNasional.sim - totalNasional.inacbg) > 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                  {(totalNasional.sim - totalNasional.inacbg) > 0 ? '+' : ''}{formatTableMiliar(totalNasional.sim - totalNasional.inacbg)}
                </td>
                <td style={{ textAlign: 'center' }}>100%</td>
                <td style={{ textAlign: 'center' }}>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <div className="flex-between" style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Map size={20} color="var(--accent-success)" /> Pivot Market Share Wilayah vs Kelas RS
          </h3>
          <DownloadExcelButton 
            data={excelDataPivot}
            headers={pivotHeaders}
            filename="MarketShare_Pivot_Wilayah"
            groupHeaders={[
              { label: 'Provinsi', colSpan: 1, rowSpan: 2, fill: '#2c3e50' },
              ...displayClasses.map(k => ({
                label: `Kelas ${k}`,
                colSpan: 3,
                fill: k === 'A' ? '#e74c3c' : k === 'B' ? '#f39c12' : k === 'C' ? '#3498db' : '#9b59b6'
              })),
              { label: 'Total Keseluruhan', colSpan: 4, fill: '#1a6e9a' }
            ]}
          />
        </div>
        
        <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto', overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: '1500px' }}>
            <thead>
              <tr>
                <th rowSpan="2" style={{ position: 'sticky', top: 0, left: 0, zIndex: 20, background: 'var(--bg-tertiary)', minWidth: '200px' }}>Provinsi</th>
                {displayClasses.map(k => (
                  <th colSpan="3" key={'hdr_' + k} style={{ position: 'sticky', top: 0, zIndex: 10, textAlign: 'center', borderLeft: '2px solid var(--glass-border)' }}>Kelas {k}</th>
                ))}
                <th colSpan="4" style={{ position: 'sticky', top: 0, zIndex: 10, textAlign: 'center', borderLeft: '2px solid var(--glass-border)', background: 'rgba(52, 152, 219, 0.1)' }}>Total Keseluruhan</th>
              </tr>
              <tr>
                {displayClasses.map(k => (
                  <React.Fragment key={'subhdr_' + k}>
                    <th style={{ position: 'sticky', top: '40px', zIndex: 10, textAlign: 'right', borderLeft: '2px solid var(--glass-border)', fontSize: '0.75rem' }}>Kasus</th>
                    <th style={{ position: 'sticky', top: '40px', zIndex: 10, textAlign: 'right', fontSize: '0.75rem' }}>INA-CBG (Rp Miliar)</th>
                    <th style={{ position: 'sticky', top: '40px', zIndex: 10, textAlign: 'right', fontSize: '0.75rem' }}>iDRG (Rp Miliar)</th>
                  </React.Fragment>
                ))}
                <th style={{ position: 'sticky', top: '40px', zIndex: 10, textAlign: 'right', borderLeft: '2px solid var(--glass-border)', fontSize: '0.75rem', background: 'rgba(52, 152, 219, 0.1)' }}>Total Kasus</th>
                <th style={{ position: 'sticky', top: '40px', zIndex: 10, textAlign: 'right', fontSize: '0.75rem', background: 'rgba(52, 152, 219, 0.1)' }}>Total INA-CBG (Rp Miliar)</th>
                <th style={{ position: 'sticky', top: '40px', zIndex: 10, textAlign: 'right', fontSize: '0.75rem', background: 'rgba(52, 152, 219, 0.1)' }}>Total iDRG (Rp Miliar)</th>
                <th style={{ position: 'sticky', top: '40px', zIndex: 10, textAlign: 'right', fontSize: '0.75rem', background: 'rgba(52, 152, 219, 0.1)' }}>Selisih (Rp Miliar)</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(byProvinsi).sort().map(prop => {
                let rowKasus = 0, rowInacbg = 0, rowSim = 0;
                return (
                  <tr key={prop}>
                    <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-primary)', fontWeight: 600 }}>{prop}</td>
                    {displayClasses.map(k => {
                      const v = byProvinsi[prop][k] || { kasus: 0, inacbg: 0, sim: 0 };
                      rowKasus += v.kasus;
                      rowInacbg += v.inacbg;
                      rowSim += v.sim;
                      return (
                        <React.Fragment key={prop + '_' + k}>
                          <td style={{ textAlign: 'right', borderLeft: '2px solid var(--glass-border)' }}>{v.kasus.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatTableMiliar(v.inacbg)}</td>
                          <td style={{ textAlign: 'right' }}>{formatTableMiliar(v.sim)}</td>
                        </React.Fragment>
                      );
                    })}
                    <td style={{ textAlign: 'right', borderLeft: '2px solid var(--glass-border)', background: 'rgba(52, 152, 219, 0.02)' }}>{rowKasus.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)', background: 'rgba(52, 152, 219, 0.02)' }}>{formatTableMiliar(rowInacbg)}</td>
                    <td style={{ textAlign: 'right', background: 'rgba(52, 152, 219, 0.02)' }}>{formatTableMiliar(rowSim)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: (rowSim - rowInacbg) > 0 ? 'var(--accent-success)' : 'var(--accent-danger)', background: 'rgba(52, 152, 219, 0.02)' }}>
                      {(rowSim - rowInacbg) > 0 ? '+' : ''}{formatTableMiliar(rowSim - rowInacbg)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hospital Selection & Profile Section */}
      <div className="glass-panel" style={{ padding: '24px', marginTop: '32px' }}>
        <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} color="var(--accent-primary)" /> Detail Profil & 24 Kompetensi Layanan RS
        </h3>
        <div style={{ marginBottom: '20px', maxWidth: '400px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Pilih Rumah Sakit:</label>
          <Select
            isClearable
            placeholder="Cari & Pilih RS..."
            options={filteredRS.map(rs => ({ value: rs.kode, label: `${rs.nama} (${rs.kode})` }))}
            value={selectedRsKode ? { value: selectedRsKode, label: `${selectedRsObj?.nama} (${selectedRsKode})` } : null}
            onChange={(selected) => {
              const val = selected ? selected.value : '';
              setSelectedRsKode(val);
              setSelectedRsObj(val ? { kode: val, ...hospitalsData[val] } : null);
            }}
            styles={{
              control: (base) => ({
                ...base,
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: 'rgba(255,255,255,0.8)',
                fontSize: '0.85rem'
              }),
              menu: (base) => ({
                ...base,
                fontSize: '0.85rem'
              })
            }}
          />
        </div>

        {selectedRsObj && (
          <HospitalProfileCard 
            rs={selectedRsObj}
            profile={rsProfilesData ? rsProfilesData[selectedRsObj.kode] : null}
            simulasi={simulasi}
            excludeNonKomp={excludeNonKomp}
            rsKompetensiOnline={rsKompetensiOnline}
            onClose={() => {
              setSelectedRsKode('');
              setSelectedRsObj(null);
            }}
          />
        )}
      </div>

    </div>
  );
};

export default AnalisisMarketShare;
