import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, DollarSign, Database } from 'lucide-react';
import StatCard from '../components/StatCard';
import SpendingShiftChart from '../components/SpendingShiftChart';
import GenericScatterPlot from '../components/GenericScatterPlot';
import { matchesGroup, RS_GROUPS } from '../utils/rsGroups';
import { filterHospital } from '../utils/filterUtils';
import { loadDatasetFile } from '../utils/dataLoader';


const TRIAL_KABS = ['KOTA BANDUNG', 'KOTA MAKASSAR', 'KABUPATEN TULUNGAGUNG', 'KOTA TULUNGAGUNG', 'KABUPATEN MUARA ENIM', 'MUARA ENIM'];

const Overview = ({ dataset, simulasi, groupFilter, wilayahFilter, rsFilter = '', isExcludeMode, kabFilter, excludeNonKomp, globalMonth, globalDrg } ) => {
  const [servicesData, setServicesData] = useState(null);
  const [hospitalsData, setHospitalsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadDatasetFile(dataset, 'services', globalMonth, globalDrg),
      loadDatasetFile(dataset, 'hospitals', globalMonth, globalDrg),
    ]).then(([svc, hosp]) => {
      setServicesData(svc);
      setHospitalsData(hosp);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [dataset]);

  if (loading || !servicesData || !hospitalsData) {
    return (
      <div className="flex-center" style={{ height: '100%', color: 'var(--text-secondary)' }}>
        <Activity className="animate-spin" size={48} />
        <span style={{ marginLeft: '16px' }}>Memuat Data...</span>
      </div>
    );
  }

  const simulasiKey = `tarif_${simulasi}`;
  const activeGroup = null /* removed single active group logic */ || null;

  let totalInaCbg = 0;
  let totalSimulasi = 0;
  let totalKasus = 0;
  let chartData = [];

  const getDisplayName = (name) => {
    if (!name || name.toLowerCase().includes('unknown') || name.toLowerCase() === 'n/a') return 'Lainnya';
    return name;
  };

  if ((groupFilter && groupFilter.length > 0) || (wilayahFilter && wilayahFilter.length > 0) || rsFilter || excludeNonKomp || (kabFilter && kabFilter.length > 0)) {
    // Filter mode: aggregate from hospitals data by kelompok
    const kelompokMap = {};
    Object.entries(hospitalsData).forEach(([kode, rs]) => {
      if (!filterHospital(rs, kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp)) return;
      if (!rs.byKelompok) {
        // Fallback: use global totals, assign to 'Lainnya'
        if (!kelompokMap['Lainnya']) kelompokMap['Lainnya'] = { kasus: 0, inacbg: 0, sim: 0 };
        kelompokMap['Lainnya'].kasus += rs.kasus || 0;
        kelompokMap['Lainnya'].inacbg += rs.inacbg || 0;
        // Try to get sim from rs.sim object if available
        const simVal = rs.sim ? (rs.sim[simulasiKey] || rs.sim[String(simulasi)] || 0) : 0;
        kelompokMap['Lainnya'].sim += simVal;
        return;
      }
      // byKelompok can be:
      // - Old flat: { [layanan]: { kasus, inacbg, tarif_X } }
      // - New nested: { [layanan]: { [kompetensi]: { kasus, inacbg, sim: { tarif_X } } } }
      Object.entries(rs.byKelompok).forEach(([kelompok, kd]) => {
        const displayName = getDisplayName(kelompok);
        if (!kelompokMap[displayName]) kelompokMap[displayName] = { kasus: 0, inacbg: 0, sim: 0 };
        
        if (kd && typeof kd === 'object') {
          // Check if it's the new nested structure (keys are competency levels)
          const firstVal = Object.values(kd)[0];
          if (firstVal && typeof firstVal === 'object' && 'kasus' in firstVal) {
            // New nested: byKelompok[layanan][kompetensi] = { kasus, inacbg, sim: { tarif_X } }
            Object.values(kd).forEach(compData => {
              kelompokMap[displayName].kasus += compData.kasus || 0;
              kelompokMap[displayName].inacbg += compData.inacbg || 0;
              const simVal = compData.sim ? (compData.sim[simulasiKey] || 0) : 0;
              kelompokMap[displayName].sim += simVal;
            });
          } else {
            // Old flat: byKelompok[layanan] = { kasus, inacbg, tarif_X }
            kelompokMap[displayName].kasus += kd.kasus || 0;
            kelompokMap[displayName].inacbg += kd.inacbg || 0;
            kelompokMap[displayName].sim += kd[simulasiKey] || 0;
          }
        }
      });
    });

    chartData = Object.entries(kelompokMap)
      .map(([name, d]) => {
        totalInaCbg += d.inacbg;
        totalSimulasi += d.sim;
        totalKasus += d.kasus;
        return { name, inacbg: d.inacbg, simulasi: d.sim, delta: d.sim - d.inacbg, kasus: d.kasus };
      })
      .sort((a, b) => b.inacbg - a.inacbg);
  } else {
    // No filter: check if services data has sim keys. If not (dataset4), fall back to hospitals.
    const firstSvcKey = Object.keys(servicesData || {})[0];
    const firstSvc = firstSvcKey ? servicesData[firstSvcKey] : null;
    const hasTarifInServices = firstSvc && firstSvc[simulasiKey] !== undefined;

    const kelompokMap = {};

    if (hasTarifInServices) {
      // Old dataset (dataset1/2/3): services has pre-aggregated tarif keys
      Object.keys(servicesData).forEach(kelompok => {
        const displayName = getDisplayName(kelompok);
        if (!kelompokMap[displayName]) kelompokMap[displayName] = { kasus: 0, inacbg: 0, sim: 0 };
        kelompokMap[displayName].inacbg += servicesData[kelompok].inacbg || 0;
        kelompokMap[displayName].sim += servicesData[kelompok][simulasiKey] || 0;
        kelompokMap[displayName].kasus += servicesData[kelompok].kasus || 0;
      });
    } else {
      // Dataset4: aggregate from hospitals byKelompok
      Object.entries(hospitalsData).forEach(([kode, rs]) => {
        if (!rs.byKelompok) return;
        Object.entries(rs.byKelompok).forEach(([kelompok, kd]) => {
          const displayName = getDisplayName(kelompok);
          if (!kelompokMap[displayName]) kelompokMap[displayName] = { kasus: 0, inacbg: 0, sim: 0 };
          if (kd && typeof kd === 'object') {
            const firstVal = Object.values(kd)[0];
            if (firstVal && typeof firstVal === 'object' && 'kasus' in firstVal) {
              // Nested: byKelompok[layanan][kompetensi] = { kasus, inacbg, sim: { tarif_X } }
              Object.values(kd).forEach(compData => {
                kelompokMap[displayName].kasus += compData.kasus || 0;
                kelompokMap[displayName].inacbg += compData.inacbg || 0;
                kelompokMap[displayName].sim += compData.sim ? (compData.sim[simulasiKey] || 0) : 0;
              });
            } else {
              kelompokMap[displayName].kasus += kd.kasus || 0;
              kelompokMap[displayName].inacbg += kd.inacbg || 0;
              kelompokMap[displayName].sim += kd[simulasiKey] || 0;
            }
          }
        });
      });
    }

    chartData = Object.entries(kelompokMap)
      .map(([name, d]) => {
        totalInaCbg += d.inacbg;
        totalSimulasi += d.sim;
        totalKasus += d.kasus;
        return { name, inacbg: d.inacbg, simulasi: d.sim, delta: d.sim - d.inacbg, kasus: d.kasus };
      })
      .sort((a, b) => b.inacbg - a.inacbg);
  }


  const totalDelta = totalSimulasi - totalInaCbg;

  return (
    <div className="animate-fade-in-up">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>Ringkasan Nasional</h1>
        <p className="text-secondary">
          Analisis Shifting Spending 24 Kompetensi Layanan — Tarif iDRG
          {activeGroup ? ` | Grup: ${activeGroup.label}` : ''}
          {wilayahFilter?.length > 0 ? ` | Wilayah: ${wilayahFilter.join(", ")}` : ""}
        </p>
        {(activeGroup || wilayahFilter || rsFilter) && (
          <div style={{
            marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 14px', borderRadius: '20px',
            background: activeGroup ? `${activeGroup.color}22` : 'rgba(56, 189, 248, 0.1)', 
            border: activeGroup ? `1px solid ${activeGroup.color}88` : '1px solid rgba(56, 189, 248, 0.4)',
            fontSize: '0.82rem', color: activeGroup ? activeGroup.color : '#0284c7', fontWeight: 600
          }}>
            <span>🎯</span>
            <span>{isExcludeMode ? 'Mengecualikan' : 'Menampilkan'} data khusus {activeGroup ? `grup ${activeGroup.label}` : ''} {activeGroup && wilayahFilter ? 'di' : ''} {wilayahFilter?.length > 0 ? `wilayah ${wilayahFilter.join(", ")}` : ""} {rsFilter ? `pencarian "${rsFilter}"` : ''} — {totalKasus.toLocaleString()} kasus</span>
          </div>
        )}
      </div>

      <div className="grid-2" style={{ marginBottom: '24px' }}>
        <div style={{ minHeight: '550px', display: 'flex', flexDirection: 'column' }}>
          <SpendingShiftChart data={chartData.slice(0, 15)} title="Top 15 Potensi Shifting" />
        </div>
        <div style={{ minHeight: '550px', display: 'flex', flexDirection: 'column' }}>
          <GenericScatterPlot 
            title={`Sebaran Shifting per Kompetensi Layanan${activeGroup ? ` (${activeGroup.label})` : ''}`}
            data={chartData.map(d => ({
              label: d.name,
              inacbg: d.inacbg,
              simulasiVal: d.simulasi,
              delta: d.delta,
              kasus: d.kasus
            }))}
          />
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: '32px' }}>
        <StatCard 
          title="Total Tarif INA-CBG" 
          value={totalInaCbg} 
          icon={Database} 
        />
        <StatCard 
          title={`Total Tarif iDRG`} 
          value={totalSimulasi} 
          icon={DollarSign} 
          delta={totalDelta}
          deltaType={totalDelta > 0 ? 'positive' : 'negative'}
        />
        <StatCard 
          title="Total Kasus" 
          value={totalKasus} 
          type="number"
          icon={Activity} 
        />
      </div>

      <div style={{ marginBottom: '32px' }}>
        <SpendingShiftChart 
          title={`Grafik perbandingan tarif INACBg vs Tarif iDRG Berdasarkan 24 kompetensi layanan${activeGroup ? ` (${activeGroup.label})` : ''}`}
          data={chartData} 
        />
      </div>

      <div style={{ height: '600px', width: '100%', marginBottom: '32px' }}>
        <GenericScatterPlot 
          title={`Sebaran Shifting per Kompetensi Layanan${activeGroup ? ` (${activeGroup.label})` : ''}`}
          data={chartData.map(d => ({
            label: d.name,
            inacbg: d.inacbg,
            simulasiVal: d.simulasi,
            delta: d.delta,
            kasus: d.kasus
          }))}
        />
      </div>
    </div>
  );
};

export default Overview;
