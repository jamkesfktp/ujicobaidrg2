import React, { useState, useEffect, useMemo } from 'react';
import { Activity, MapPin, Stethoscope, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import MapIndonesia from '../components/MapIndonesia';
import HospitalProfileCard from '../components/HospitalProfileCard';
import { exportMapRegionToPPTX } from '../utils/exportPptx';
import Select from 'react-select';

import { formatCompactCurrency, formatCurrency , formatTableMiliar} from '../utils/formatters';

import { matchesGroup } from '../utils/rsGroups';

import DownloadExcelButton from '../components/DownloadExcelButton';
import SkenarioShiftingTable from '../components/SkenarioShiftingTable';
import { filterHospital } from '../utils/filterUtils';
import { loadDatasetFile } from '../utils/dataLoader';


const TRIAL_KABS = ['KOTA BANDUNG', 'KOTA MAKASSAR', 'KABUPATEN TULUNGAGUNG', 'KOTA TULUNGAGUNG', 'KABUPATEN MUARA ENIM', 'MUARA ENIM'];

const AnalisisShifting = ({ dataset, simulasi, groupFilter, rsFilter = '', wilayahFilter = [], isExcludeMode, kabFilter, excludeNonKomp, globalMonth, globalDrg, rsKompetensiOnline } ) => {

  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);



  const [selectedPropinsi, setSelectedPropinsi] = useState([{ value: 'ALL', label: 'Semua Provinsi' }]);
  const [selectedKabupaten, setSelectedKabupaten] = useState([{ value: 'ALL', label: 'Semua Kabupaten/Kota' }]);
  const [selectedKelompok, setSelectedKelompok] = useState([{ value: 'ALL', label: 'Semua Layanan' }]);

  const [selectedRsForModal, setSelectedRsForModal] = useState(null);

  const [expandedRows, setExpandedRows] = useState({});

  const [expandedLayanan, setExpandedLayanan] = useState(null);

  const [hospitalDetails, setHospitalDetails] = useState(null);

  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedMapProvinces, setSelectedMapProvinces] = useState([]);
  const [selectedMapHospital, setSelectedMapHospital] = useState(null);
  const [isExportingPPT, setIsExportingPPT] = useState(false);
  const [rsProfilesData, setRsProfilesData] = useState(null);

  const handleMapRegionClick = (p) => {
    if (p === null) {
      setSelectedMapProvinces([]);
    } else {
      setSelectedMapProvinces(prev => {
        if (prev.includes(p)) return prev.filter(x => x !== p);
        if (prev.length >= 5) return prev;
        return [...prev, p];
      });
    }
    setSelectedMapHospital(null);
  };

  const handleMapMarkerClick = (rs) => {
    setSelectedMapHospital(rs);
  };

  const handleExportPPT = async () => {
    setIsExportingPPT(true);
    try {
      let title = selectedMapProvinces.length > 0 ? selectedMapProvinces.join(', ') : 'Global';
      if (selectedMapHospital) {
        title = selectedMapHospital.nama;
      }
      
      const regionDataRaw = combinedRegionData;
      const topHospitals = regionDataRaw ? [...regionDataRaw.rsList].sort((a,b) => b.kasus - a.kasus).slice(0, 10) : [];
      await exportMapRegionToPPTX(title, { 
        type: 'native', 
        selectedProvinces: selectedMapProvinces, 
        regionalData: regionDataRaw, 
        topHospitals: topHospitals,
        rsProfilesData: rsProfilesData,
        simulasi: simulasi
      });
    } catch (e) {
      console.error(e);
      alert('Gagal mengekspor PPT. Coba lagi.');
    } finally {
      setIsExportingPPT(false);
    }
  };

  const [sortConfig, setSortConfig] = useState({ key: 'kasusTotal', direction: 'descending' });

  const requestSort = (key) => {

    setSortConfig(prev => ({

      key,

      direction: prev.key === key && prev.direction === 'descending' ? 'ascending' : 'descending'

    }));

  };

  const getSortIndicator = (key) => {

    if (sortConfig.key !== key) return ' ↕';

    return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';

  };



  const toggleRow = (rsId) => {

    setExpandedRows(prev => ({ ...prev, [rsId]: !prev[rsId] }));

  };



  const handleLayananClick = (lyn, kodeRs) => {

    if (expandedLayanan === lyn) {

      setExpandedLayanan(null);

      return;

    }

    setExpandedLayanan(lyn);

    if (!hospitalDetails || hospitalDetails._kode !== kodeRs) {

      setLoadingDetails(true);

      const realDataset = dataset.includes('_') ? dataset.split('_')[0] : dataset;
      fetch(`/data/hospitals/${realDataset}_${kodeRs}.json`)

        .then(res => res.json())

        .then(data => {

          setHospitalDetails({ _kode: kodeRs, ...data });

          setLoadingDetails(false);

        })

        .catch(err => {

          console.error(err);

          setLoadingDetails(false);

        });

    }

  };



  useEffect(() => {

    setLoading(true);

    loadDatasetFile(dataset, 'shifting', globalMonth, globalDrg)
      .then(json => {
        setData(json);
        
        // Coba load profile data juga (jangan block loading jika gagal)
        loadDatasetFile(dataset, 'rs_profiles', globalMonth, globalDrg)
          .then(prof => setRsProfilesData(prof))
          .catch(() => setRsProfilesData({}));

        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });

  }, [dataset]);



  if (loading || !data) {

    return (

      <div className="flex-center" style={{ height: '100%', color: 'var(--text-secondary)' }}>

        <Activity className="animate-spin" size={48} />

        <span style={{ marginLeft: '16px' }}>Memuat Analisis Shifting...</span>

      </div>

    );

  }



  // Hierarchical Data Extraction

  const listPropinsi = Object.keys(data).filter(p => p !== 'UJI_COBA').sort();

  const propinsiOpts = [{ value: 'ALL', label: 'Semua Provinsi' }, ...listPropinsi.map(p => ({ value: p, label: p }))];



  let activeProvinces = selectedPropinsi.some(p => p.value === 'ALL') ? listPropinsi : selectedPropinsi.map(p => p.value);

  if (wilayahFilter && wilayahFilter.length > 0) {
    activeProvinces = activeProvinces.filter(p => {
      let isMatch = false;
      if (wilayahFilter.includes(p)) isMatch = true;
      if (wilayahFilter.includes('UJI_COBA') && ['JAWA BARAT', 'SULAWESI SELATAN', 'JAWA TIMUR', 'SUMATERA SELATAN'].includes(p)) isMatch = true;
      
      return isExcludeMode ? !isMatch : isMatch;
    });
  }



  let availableKabupaten = [];

  activeProvinces.forEach(p => {

    if (data[p]) {

      Object.keys(data[p]).forEach(k => {

        if (wilayahFilter && wilayahFilter.includes('UJI_COBA') && !wilayahFilter.includes(p)) {

          const TRIAL_KABS = ['KOTA BANDUNG', 'KOTA MAKASSAR', 'KABUPATEN TULUNGAGUNG', 'KOTA TULUNGAGUNG', 'KABUPATEN MUARA ENIM', 'MUARA ENIM'];

          if (!TRIAL_KABS.some(trial => k.toUpperCase().includes(trial))) return;

        }

        if (!availableKabupaten.includes(k)) availableKabupaten.push(k);

      });

    }

  });

  availableKabupaten.sort();

  const kabupatenOpts = [{ value: 'ALL', label: 'Semua Kabupaten/Kota' }, ...availableKabupaten.map(k => ({ value: k, label: k }))];



  const activeKabupaten = selectedKabupaten.some(k => k.value === 'ALL') ? availableKabupaten : selectedKabupaten.map(k => k.value);

  let availableKelompok = [];

  activeProvinces.forEach(p => {

    if (data[p]) {

      activeKabupaten.forEach(k => {

        if (data[p][k]) {

          Object.keys(data[p][k]).forEach(kl => {

            if (!availableKelompok.includes(kl)) availableKelompok.push(kl);

          });

        }

      });

    }

  });

  availableKelompok = availableKelompok.filter(kl => kl !== 'Unknown');
  availableKelompok.sort();

  const kelompokOpts = [{ value: 'ALL', label: 'Semua Layanan' }, ...availableKelompok.map(kl => ({ value: kl, label: kl }))];



  const handlePropinsiChange = (selected) => {

    const hasAll = selected?.some(opt => opt.value === 'ALL');

    const hadAll = selectedPropinsi.some(opt => opt.value === 'ALL');

    if (hasAll && !hadAll) {

      setSelectedPropinsi([{ value: 'ALL', label: 'Semua Provinsi' }]);

      setSelectedKabupaten([{ value: 'ALL', label: 'Semua Kabupaten/Kota' }]);

      setSelectedKelompok([{ value: 'ALL', label: 'Semua Layanan' }]);

    } else if (hasAll && selected.length > 1) {

      setSelectedPropinsi(selected.filter(opt => opt.value !== 'ALL'));

      setSelectedKabupaten([]);

      setSelectedKelompok([]);

    } else {

      setSelectedPropinsi(selected || []);

      setSelectedKabupaten([]);

      setSelectedKelompok([]);

    }

  };



  const handleKabupatenChange = (selected) => {

    const hasAll = selected?.some(opt => opt.value === 'ALL');

    const hadAll = selectedKabupaten.some(opt => opt.value === 'ALL');

    if (hasAll && !hadAll) {

      setSelectedKabupaten([{ value: 'ALL', label: 'Semua Kabupaten/Kota' }]);

      setSelectedKelompok([{ value: 'ALL', label: 'Semua Layanan' }]);

    } else if (hasAll && selected.length > 1) {

      setSelectedKabupaten(selected.filter(opt => opt.value !== 'ALL'));

      setSelectedKelompok([]);

    } else {

      setSelectedKabupaten(selected || []);

      setSelectedKelompok([]);

    }

  };



  const handleKelompokChange = (selected) => {

    const hasAll = selected?.some(opt => opt.value === 'ALL');

    const hadAll = selectedKelompok.some(opt => opt.value === 'ALL');

    if (hasAll && !hadAll) {

      setSelectedKelompok([{ value: 'ALL', label: 'Semua Layanan' }]);

    } else if (hasAll && selected.length > 1) {

      setSelectedKelompok(selected.filter(opt => opt.value !== 'ALL'));

    } else {

      setSelectedKelompok(selected || []);

    }

  };



  let shiftingNode = null;

  if (selectedPropinsi.length > 0 && selectedKabupaten.length > 0 && selectedKelompok.length > 0) {

    shiftingNode = {

      demand: { dasar: {kasus:0, inacbg:0, sim:0}, madya: {kasus:0, inacbg:0, sim:0}, utama: {kasus:0, inacbg:0, sim:0}, paripurna: {kasus:0, inacbg:0, sim:0}, 'Belum ada komp. ICD': {kasus:0, inacbg:0, sim:0} },

      demandByRs: {},

      supply: { dasar: [], madya: [], utama: [], paripurna: [] },

      summaryLayanan: {}

    };

    

    const activeKelompok = selectedKelompok.some(kl => kl.value === 'ALL') ? availableKelompok : selectedKelompok.map(kl => kl.value);

    

    activeProvinces.forEach(p => {

      if (data[p]) {

        activeKabupaten.forEach(k => {

          if (data[p][k]) {

            activeKelompok.forEach(kl => {

              if (data[p][k][kl]) {

                 const kData = data[p][k][kl];

                 ['dasar', 'madya', 'utama', 'paripurna'].forEach(lvl => {

                   if (kData.supply[lvl]) {

                     // Filter supply by all filters so receiving RS matches
                     const filteredSupply = kData.supply[lvl].filter(rs => {
                       const rsObj = { ...rs, prop: p, kab: k };
                       return filterHospital(rsObj, rs.kode, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp);
                     });
                     const supplyWithLayanan = filteredSupply.map(rs => ({ ...rs, layanan: kl }));

                     shiftingNode.supply[lvl] = [...shiftingNode.supply[lvl], ...supplyWithLayanan];

                   }

                 });

                 if (kData.demandByRs) {

                    Object.entries(kData.demandByRs).forEach(([rsId, rsData]) => {

                      // Filter demand by all filters
                      const rsObj = { ...rsData, prop: p, kab: k };
                      if (!filterHospital(rsObj, rsId, groupFilter, wilayahFilter, rsFilter, isExcludeMode, kabFilter, excludeNonKomp)) return;



                      if (!shiftingNode.demandByRs[rsId]) {

                        shiftingNode.demandByRs[rsId] = {

                          kode: rsId,

                          nama: rsData.nama,

                          faskesKomp: 'Multi-Layanan',

                          kasusByKlaim: { dasar: {kasus:0, inacbg:0, sim:0}, madya: {kasus:0, inacbg:0, sim:0}, utama: {kasus:0, inacbg:0, sim:0}, paripurna: {kasus:0, inacbg:0, sim:0}, 'Belum ada komp. ICD': {kasus:0, inacbg:0, sim:0} },

                          layananDetails: []

                        };

                      }

                      

                      let hasCases = false;

                      ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].forEach(lvl => {

                        if (rsData.kasusByKlaim[lvl] && rsData.kasusByKlaim[lvl].kasus > 0) hasCases = true;

                      });

                      

                      if (hasCases) {

                        shiftingNode.demandByRs[rsId].layananDetails.push({

                          layanan: kl,

                          faskesKomp: rsData.faskesKomp,

                          kasusByKlaim: {

                            dasar: JSON.parse(JSON.stringify(rsData.kasusByKlaim.dasar || {kasus:0, inacbg:0, sim:0})),

                            madya: JSON.parse(JSON.stringify(rsData.kasusByKlaim.madya || {kasus:0, inacbg:0, sim:0})),

                            utama: JSON.parse(JSON.stringify(rsData.kasusByKlaim.utama || {kasus:0, inacbg:0, sim:0})),

                            paripurna: JSON.parse(JSON.stringify(rsData.kasusByKlaim.paripurna || {kasus:0, inacbg:0, sim:0})),

                            'Belum ada komp. ICD': JSON.parse(JSON.stringify(rsData.kasusByKlaim['Belum ada komp. ICD'] || {kasus:0, inacbg:0, sim:0}))

                          }

                        });

                      }



                      ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].forEach(lvl => {
                        if (excludeNonKomp && lvl === 'Belum ada komp. ICD') return;


                        if (rsData.kasusByKlaim[lvl]) {

                          const simVal = rsData.kasusByKlaim[lvl].sim[`tarif_${simulasi}`] || 0;

                          shiftingNode.demandByRs[rsId].kasusByKlaim[lvl].kasus += rsData.kasusByKlaim[lvl].kasus;

                          shiftingNode.demandByRs[rsId].kasusByKlaim[lvl].inacbg += rsData.kasusByKlaim[lvl].inacbg;

                          shiftingNode.demandByRs[rsId].kasusByKlaim[lvl].sim += simVal;

                          

                          // Add to top level demand

                          shiftingNode.demand[lvl].kasus += rsData.kasusByKlaim[lvl].kasus;

                          shiftingNode.demand[lvl].inacbg += rsData.kasusByKlaim[lvl].inacbg;

                          shiftingNode.demand[lvl].sim += simVal;



                          // Add to summaryLayanan

                          if (!shiftingNode.summaryLayanan[kl]) {

                            shiftingNode.summaryLayanan[kl] = { kasus: 0, inacbg: 0, sim: 0 };

                          }

                          shiftingNode.summaryLayanan[kl].kasus += rsData.kasusByKlaim[lvl].kasus;

                          shiftingNode.summaryLayanan[kl].inacbg += rsData.kasusByKlaim[lvl].inacbg;

                          shiftingNode.summaryLayanan[kl].sim += simVal;

                        }

                      });

                    });

                 }

              }

            });

          }

        });

      }

    });



    ['dasar', 'madya', 'utama', 'paripurna'].forEach(lvl => {

      const uniqueRsMap = {};

      shiftingNode.supply[lvl].forEach(rs => {

        if (!uniqueRsMap[rs.kode]) {

          uniqueRsMap[rs.kode] = { ...rs, layananList: [rs.layanan] };

        } else {

          if (!uniqueRsMap[rs.kode].layananList.includes(rs.layanan)) {

            uniqueRsMap[rs.kode].layananList.push(rs.layanan);

          }

        }

      });

      shiftingNode.supply[lvl] = Object.values(uniqueRsMap);

    });

  }



  const renderBlock = (level, title, colorClass) => {

    if (!shiftingNode) return null;

    const demand = shiftingNode.demand[level];

    const supply = shiftingNode.supply[level] || [];

    

    const hasDemand = demand.kasus > 0;

    const hasSupply = supply.length > 0;



    return (

      <div className="glass-card" style={{ padding: '24px', borderTop: `4px solid var(--accent-${colorClass})` }}>

        <h3 className="text-primary" style={{ margin: '0 0 16px 0', fontSize: '1.25rem', textTransform: 'capitalize' }}>

          Kompetensi {title}

        </h3>



        <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>

          <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '4px', fontWeight: 600 }}>Total Potensi Layanan (Demand)</p>

          <div className="flex-between">

            <span className="text-primary" style={{ fontSize: '1.5rem', fontWeight: 700 }}>

              {demand.kasus.toLocaleString()} <span style={{ fontSize: '0.875rem', fontWeight: 400 }}>kasus</span>

            </span>

          </div>

          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.875rem' }}>

            <div className="flex-between">

              <span className="text-secondary">Pagu INA-CBG:</span>

              <span className="text-primary font-medium">{formatCompactCurrency(demand.inacbg)}</span>

            </div>

            <div className="flex-between">

              <span className="text-secondary">Pagu Simulasi:</span>

              <span className="text-primary font-medium">{formatCompactCurrency(demand.sim)}</span>

            </div>

          </div>

        </div>



        <div>

          <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '12px', fontWeight: 600 }}>Rumah Sakit Penerima (Supply)</p>

          

          {hasDemand && !hasSupply ? (

            <div style={{ padding: '12px', background: 'rgba(220,53,69,0.1)', color: 'var(--accent-danger)', borderRadius: '8px', fontSize: '0.875rem', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>

              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />

              <span>Terdapat {demand.kasus.toLocaleString()} kasus namun tidak ada RS dengan kompetensi {title} di wilayah ini. Layanan ini berpotensi dirujuk ke wilayah lain!</span>

            </div>

          ) : !hasSupply ? (

            <p className="text-muted" style={{ fontSize: '0.875rem', fontStyle: 'italic' }}>Tidak ada RS dengan kompetensi {title} di wilayah ini.</p>

          ) : (

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>

              {supply.map((rs, idx) => {

                let specificData = null;

                if (!rs.layananList && shiftingNode.demandByRs && shiftingNode.demandByRs[rs.kode]) {

                   const rsDemand = shiftingNode.demandByRs[rs.kode];

                   if (rsDemand.kasusByKlaim && rsDemand.kasusByKlaim[level] && rsDemand.kasusByKlaim[level].kasus > 0) {

                      specificData = rsDemand.kasusByKlaim[level];

                   }

                }

                

                return (

                  <li 

                    key={idx} 

                    style={{ 

                      padding: '12px', 

                      border: '1px solid var(--glass-border)', 

                      borderRadius: '8px', 

                      fontSize: '0.875rem', 

                      background: 'var(--bg-secondary)',

                      cursor: rs.layananList ? 'pointer' : 'default',

                      transition: 'all 0.2s'

                    }}

                    onMouseEnter={(e) => { if(rs.layananList) e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}

                    onMouseLeave={(e) => { if(rs.layananList) e.currentTarget.style.borderColor = 'var(--glass-border)'; }}

                    onClick={() => rs.layananList && setSelectedRsForModal({ ...rs, level: title })}

                  >

                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rs.nama}</div>

                    <div className="flex-between">

                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>Kode RS: {rs.kode}</span>

                      {rs.layananList ? (

                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>Lihat Layanan ({rs.layananList.length})</span>

                      ) : specificData ? (

                        <div style={{ textAlign: 'right', fontSize: '0.75rem' }}>

                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{specificData.kasus.toLocaleString()} Kasus</div>

                          <div style={{ color: 'var(--text-muted)' }}>INA: {formatCompactCurrency(specificData.inacbg)} | iDRG: <span style={{ color: 'var(--text-primary)' }}>{formatCompactCurrency(specificData.sim)}</span></div>

                        </div>

                      ) : (

                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Belum ada kasus</span>

                      )}

                    </div>

                  </li>

                );

              })}

            </ul>

          )}

        </div>

      </div>

    );

  };




  // Compute regions data for MapIndonesia
  const isMapVisible = selectedPropinsi.length > 0 && selectedKabupaten.length > 0 && selectedKelompok.length > 0;
  const regionsMapData = {};
  if (isMapVisible && !loading) {
    const extractSim = (val) => (typeof val === 'object' && val !== null) ? (val[`tarif_${simulasi}`] || 0) : (val || 0);
    activeProvinces.forEach(p => {
      let rKasus = 0, rInacbg = 0, rSim = 0;
      const rsListMap = {};
      if (data && data[p]) {
        Object.keys(data[p]).forEach(k => {
          Object.keys(data[p][k]).forEach(kl => {
            if (kl.toLowerCase() === 'unknown' || kl === '') return;
            if (groupFilter && data[p][k][kl].kelompok !== groupFilter) return;
            const kData = data[p][k][kl];
            if (kData && kData.demandByRs) {
              Object.entries(kData.demandByRs).forEach(([rsId, rsData]) => {
                if (!matchesGroup(groupFilter, rsData.nama, rsId, rsData)) return;
                if (rsFilter && !rsData.nama.toLowerCase().includes(rsFilter.toLowerCase())) return;
                
                let rsTotalKasus = 0;
                let rsTotalInacbg = 0;
                let rsTotalSim = 0;

                ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].forEach(lvl => {
                  if (rsData.kasusByKlaim && rsData.kasusByKlaim[lvl]) {
                    const lKasus = rsData.kasusByKlaim[lvl].kasus || 0;
                    const lInacbg = rsData.kasusByKlaim[lvl].inacbg || 0;
                    const lSim = extractSim(rsData.kasusByKlaim[lvl].sim);
                    
                    rKasus += lKasus;
                    rInacbg += lInacbg;
                    rSim += lSim;
                    
                    rsTotalKasus += lKasus;
                    rsTotalInacbg += lInacbg;
                    rsTotalSim += lSim;
                  }
                });
                
                if (rsTotalKasus > 0) {
                  if (!rsListMap[rsId]) {
                     rsListMap[rsId] = { kode: rsId, nama: rsData.nama, kelas: rsData.kelas || kl, faskesKomp: rsData.faskesKomp, kasus: 0, inacbg: 0, sim: 0, byKelompok: rsData.byKelompok };
                  }
                  rsListMap[rsId].kasus += rsTotalKasus;
                  rsListMap[rsId].inacbg += rsTotalInacbg;
                  rsListMap[rsId].sim += rsTotalSim;
                }
              });
            }
          });
        });
      }
      if (rKasus > 0) {
        regionsMapData[p] = { 
           kasus: rKasus, 
           inacbg: rInacbg, 
           sim: rSim, 
           selisih: rSim - rInacbg,
           rsList: Object.values(rsListMap)
        };
      }
    });
  }

  let combinedRegionData = null;
  if (selectedMapProvinces.length > 0) {
    const rData = { kasus: 0, inacbg: 0, sim: 0, selisih: 0, rsList: [] };
    selectedMapProvinces.forEach(p => {
       const pd = regionsMapData[p];
       if (pd) {
         rData.kasus += pd.kasus || 0;
         rData.inacbg += pd.inacbg || 0;
         rData.sim += pd.sim || 0;
         rData.selisih += pd.selisih || 0;
         rData.rsList.push(...(pd.rsList || []));
       }
    });
    combinedRegionData = rData;
  }

  return (
    <React.Fragment>

    <div className="animate-fade-in-up">

      <div style={{ marginBottom: '32px' }}>

        <h1 style={{ fontSize: '2rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>

          <ArrowRightLeft color="var(--accent-primary)" /> Analisis Potensi Shifting

        </h1>

        <p className="text-secondary">

          Pemetaan realokasi kasus berdasarkan syarat kompetensi layanan dan ketersediaan faskes kompeten di tingkat Kabupaten/Kota.


        </p>
      </div>

      {isMapVisible && Object.keys(regionsMapData).length > 0 && (
        <>
        <div id="export-map-container" className="card glass-panel" style={{ marginBottom: '32px' }}>
          <MapIndonesia 
            regionsData={regionsMapData} 
            metric="selisih" 
            simulasi={simulasi} 
            rsFilter={rsFilter} 
            onRegionClick={handleMapRegionClick} 
            onMarkerClick={handleMapMarkerClick}
            onExport={handleExportPPT}
            isExporting={isExportingPPT}
            selectedProvinces={selectedMapProvinces} 
          />
        </div>
        
        <HospitalProfileCard 
          rs={selectedMapHospital} 
          profile={selectedMapHospital && rsProfilesData ? rsProfilesData[selectedMapHospital.kode] : null}
          simulasi={simulasi}
          excludeNonKomp={excludeNonKomp}
          rsKompetensiOnline={rsKompetensiOnline}
          onClose={() => setSelectedMapHospital(null)}
        />

        {selectedMapProvinces.length > 0 && !selectedMapHospital && data && (() => {
          let totalKasus = 0;
          let totalInacbg = 0;
          const classCounts = { A: 0, B: 0, C: 0, D: 0, Lainya: 0 };
          const levelStats = {
            dasar: { kasus: 0, inacbg: 0 },
            madya: { kasus: 0, inacbg: 0 },
            utama: { kasus: 0, inacbg: 0 },
            paripurna: { kasus: 0, inacbg: 0 }
          };
          const rsAgg = {};

          selectedMapProvinces.forEach(p => {
            if (!data[p]) return;
            Object.keys(data[p]).forEach(k => {
              Object.keys(data[p][k]).forEach(kl => {
                if (kl.toLowerCase() === 'unknown' || kl === '') return;
                if (groupFilter && data[p][k][kl].kelompok !== groupFilter) return;
                const kData = data[p][k][kl];
                if (kData && kData.demandByRs) {
                  Object.entries(kData.demandByRs).forEach(([rsId, rsData]) => {
                    if (!matchesGroup(groupFilter, rsData.nama, rsId, rsData)) return;
                    if (rsFilter && !rsData.nama.toLowerCase().includes(rsFilter.toLowerCase())) return;

                    if (!rsAgg[rsId]) {
                      rsAgg[rsId] = { nama: rsData.nama, kelas: rsData.kelas || 'Lainya', kasus: 0, inacbg: 0 };
                    }

                    ['dasar', 'madya', 'utama', 'paripurna'].forEach(lvl => {
                      if (rsData.kasusByKlaim && rsData.kasusByKlaim[lvl]) {
                        const k = rsData.kasusByKlaim[lvl].kasus || 0;
                        const inc = rsData.kasusByKlaim[lvl].inacbg || 0;
                        
                        levelStats[lvl].kasus += k;
                        levelStats[lvl].inacbg += inc;
                        
                        rsAgg[rsId].kasus += k;
                        rsAgg[rsId].inacbg += inc;
                        
                        totalKasus += k;
                        totalInacbg += inc;
                      }
                    });
                  });
                }
              });
            });
          });

          const rsList = Object.values(rsAgg).filter(rs => rs.kasus > 0);
          rsList.forEach(rs => {
            const kl = rs.kelas.toUpperCase();
            if (['A','B','C','D'].includes(kl)) {
              classCounts[kl]++;
            } else {
              classCounts['Lainya']++;
            }
          });

          const topRs = [...rsList].sort((a,b) => b.kasus - a.kasus).slice(0, 5);
          const titleName = selectedMapProvinces.join(', ');

          return (
            <div id="export-region-profile" className="card glass-panel animate-fade-in-up" style={{ marginTop: '24px', borderTop: '4px solid #3b82f6' }}>
              <div data-html2canvas-ignore="true" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Detail Regional: {titleName}</h3>
                <button 
                  onClick={() => setSelectedMapProvinces([])} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}
                >&times;</button>
              </div>
              
              <div className="grid-3" style={{ gap: '20px' }}>
                {/* Kolom 1: Sebaran Kelas RS */}
                <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Sebaran Kelas RS Aktif</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {['A', 'B', 'C', 'D'].map(kls => classCounts[kls] > 0 && (
                      <div key={kls} style={{ background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', padding: '8px 12px', borderRadius: '6px', textAlign: 'center', flex: '1 1 40%' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kelas {kls}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>{classCounts[kls]} <span style={{ fontSize: '0.75rem', fontWeight: 'normal'}}>RS</span></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Kolom 2: Rincian Level Kompetensi */}
                <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Rincian Tingkat Kompetensi</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                    {Object.entries(levelStats).map(([lvl, stats]) => stats.kasus > 0 && (
                      <div key={lvl} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '4px' }}>
                        <span style={{ textTransform: 'capitalize' }}>{lvl}</span>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 600 }}>{stats.kasus.toLocaleString('en-US')} Kasus</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{formatCompactCurrency(stats.inacbg)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Kolom 3: Top 5 RS */}
                <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Top 5 Rumah Sakit</h4>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {topRs.map((rs, idx) => (
                      <li key={idx} style={{ background: 'var(--bg-primary)', padding: '8px', borderRadius: '6px', fontSize: '0.8rem', borderLeft: `3px solid ${idx===0 ? '#f59e0b' : idx===1 ? '#94a3b8' : idx===2 ? '#cd7f32' : '#cbd5e1'}` }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={rs.nama}>{rs.nama}</div>
                          {rs.kelas && <span style={{ background: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>KLS {rs.kelas.toUpperCase()}</span>}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', color: 'var(--text-secondary)' }}>
                          <span>{rs.kasus.toLocaleString('en-US')} Kasus</span>
                          <span>{formatCompactCurrency(rs.inacbg)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })()}


        <div style={{ marginTop: '12px', marginBottom: '24px', padding: '12px', background: 'rgba(255, 193, 7, 0.1)', borderLeft: '4px solid #ffc107', borderRadius: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <strong>Catatan:</strong> Angka Total Agregat di menu Shifting dapat mengandung penghitungan ganda <em>(double-counting)</em> akibat klaim pasien yang beririsan ke lebih dari satu kompetensi layanan. Hal ini harus di-filter pada proses <em>backend data pipeline</em> sebelum masuk ke Dashboard.
        </div>

        </>

      )}




      <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>

        <div className="grid-3">

          <div>

            <label className="text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 600 }}>

              <MapPin size={16} /> 1. Pilih Provinsi

            </label>

            <Select 

              isMulti

              options={propinsiOpts}

              value={selectedPropinsi}

              onChange={handlePropinsiChange}

              placeholder="-- Pilih Provinsi --"

              styles={{ control: (base) => ({ ...base, minHeight: '42px', borderRadius: '6px', borderColor: '#ced4da', fontSize: '0.9rem' }) }}

            />

          </div>

          <div>

            <label className="text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 600 }}>

              <MapPin size={16} /> 2. Pilih Kabupaten/Kota

            </label>

            <Select 

              isMulti

              options={kabupatenOpts}

              value={selectedKabupaten}

              onChange={handleKabupatenChange}

              isDisabled={selectedPropinsi.length === 0}

              placeholder="-- Pilih Kabupaten/Kota --"

              styles={{ control: (base) => ({ ...base, minHeight: '42px', borderRadius: '6px', borderColor: '#ced4da', fontSize: '0.9rem' }) }}

            />

          </div>

          <div>

            <label className="text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 600 }}>

              <Stethoscope size={16} /> 3. Pilih Kelompok Layanan

            </label>

            <Select 

              isMulti

              options={kelompokOpts}

              value={selectedKelompok}

              onChange={handleKelompokChange}

              isDisabled={selectedKabupaten.length === 0}

              placeholder="-- Pilih Layanan --"

              styles={{ control: (base) => ({ ...base, minHeight: '42px', borderRadius: '6px', borderColor: '#ced4da', fontSize: '0.9rem' }) }}

            />

          </div>

        </div>

      </div>



      {!shiftingNode && (

        <div className="flex-center" style={{ padding: '60px 0', border: '2px dashed var(--glass-border)', borderRadius: '12px', color: 'var(--text-muted)' }}>

          <p>Silakan pilih Provinsi, Kabupaten, dan Kelompok Layanan untuk melihat potensi shifting.</p>

        </div>

      )}



      {shiftingNode && (

        <div className="animate-fade-in-up">

          {(() => {

            const totalDemandCases = ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].reduce((sum, lvl) => sum + shiftingNode.demand[lvl].kasus, 0);

            return (

              <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)', borderLeft: '4px solid var(--accent-primary)' }}>

                <h3 className="text-primary" style={{ margin: '0 0 16px 0', fontSize: '1.25rem' }}>Total Kasus Shifting Regional</h3>

                <div className="flex-between">

                  <div>

                    <span className="text-secondary" style={{ fontSize: '0.875rem', display: 'block', marginBottom: '4px' }}>Total Kasus Keseluruhan</span>

                    <span className="text-primary" style={{ fontSize: '2rem', fontWeight: 800 }}>{totalDemandCases.toLocaleString()}</span>

                  </div>

                  <div style={{ display: 'flex', gap: '24px', textAlign: 'right' }}>

                    <div>

                      <span className="text-secondary" style={{ fontSize: '0.75rem', display: 'block' }}>Dasar</span>

                      <span style={{ fontWeight: 600, color: 'var(--accent-success)' }}>{shiftingNode.demand.dasar.kasus.toLocaleString()}</span>

                    </div>

                    <div>

                      <span className="text-secondary" style={{ fontSize: '0.75rem', display: 'block' }}>Madya</span>

                      <span style={{ fontWeight: 600, color: 'var(--accent-warning)' }}>{shiftingNode.demand.madya.kasus.toLocaleString()}</span>

                    </div>

                    <div>

                      <span className="text-secondary" style={{ fontSize: '0.75rem', display: 'block' }}>Utama</span>

                      <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{shiftingNode.demand.utama.kasus.toLocaleString()}</span>

                    </div>

                    <div>

                      <span className="text-secondary" style={{ fontSize: '0.75rem', display: 'block' }}>Paripurna</span>

                      <span style={{ fontWeight: 600, color: 'var(--accent-danger)' }}>{shiftingNode.demand.paripurna.kasus.toLocaleString()}</span>

                    </div>

                  </div>

                </div>

              </div>

            );

          })()}

          <div className="grid-4" style={{ marginBottom: '32px' }}>

            {renderBlock('dasar', 'Dasar', 'success')}

            {renderBlock('madya', 'Madya', 'warning')}

            {renderBlock('utama', 'Utama', 'primary')}

            {renderBlock('paripurna', 'Paripurna', 'danger')}

          </div>

          

          {shiftingNode.demandByRs && Object.keys(shiftingNode.demandByRs).length > 0 && (() => {

            // Apply group filter to demandByRs

            const filteredDemandByRs = Object.fromEntries(

              Object.entries(shiftingNode.demandByRs).filter(([rsId, rsData]) =>

                matchesGroup(groupFilter, rsData.nama, rsId, rsData)

              )

            );

            const hasFiltered = Object.keys(filteredDemandByRs).length > 0;

            

            let sumReal = 0;

            let sumLoss = 0;

            let sumInacbg = 0;
            let lossLvl = { dasar: 0, madya: 0, utama: 0, paripurna: 0 };
            let sumKasusLoss = 0;
            let sumInacbgLoss = 0;
            let sumKasusTotal = 0;

            

            if (hasFiltered) {

              const extractSim = (val) => (typeof val === 'object' && val !== null) ? (val[`tarif_${simulasi}`] || 0) : (val || 0);

              const kompLevelMap = { 'dasar': 1, 'madya': 2, 'utama': 3, 'paripurna': 4, 'Belum ada komp. ICD': 999 };

              Object.values(filteredDemandByRs).forEach(rs => {

                const hasDetails = rs.layananDetails && rs.layananDetails.length > 0;

                const fKompStrMain = hasDetails ? '' : (rs.faskesKomp || '').toLowerCase();

                

                ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].forEach(lvl => {

                  sumInacbg += rs.kasusByKlaim[lvl].inacbg || 0;
                  sumKasusTotal += rs.kasusByKlaim[lvl].kasus || 0;

                });



                if (hasDetails) {

                  rs.layananDetails.forEach(detail => {

                    const rsLevel = kompLevelMap[(detail.faskesKomp || '').toLowerCase()] || 0;

                    ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].forEach(lvl => {

                      const simVal = extractSim(detail.kasusByKlaim[lvl].sim);
                      const kasusVal = detail.kasusByKlaim[lvl].kasus || 0;
                      const inacbgVal = detail.kasusByKlaim[lvl].inacbg || 0;
                      const claimLevel = kompLevelMap[lvl];
                      if (claimLevel > rsLevel) {
                        sumLoss += simVal;
                        lossLvl[lvl] += simVal;
                        sumKasusLoss += kasusVal;
                        sumInacbgLoss += inacbgVal;
                      } else {
                        sumReal += simVal;
                      }

                    });

                  });

                } else {

                  const rsLevel = kompLevelMap[fKompStrMain] || 0;

                  ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].forEach(lvl => {

                    const simVal = extractSim(rs.kasusByKlaim[lvl].sim);
                    const kasusVal = rs.kasusByKlaim[lvl].kasus || 0;
                    const inacbgVal = rs.kasusByKlaim[lvl].inacbg || 0;
                    const claimLevel = kompLevelMap[lvl];
                    if (claimLevel > rsLevel) {
                      sumLoss += simVal;
                      lossLvl[lvl] += simVal;
                      sumKasusLoss += kasusVal;
                      sumInacbgLoss += inacbgVal;
                    } else {
                      sumReal += simVal;
                    }

                  });

                }

              });

            }



            return (

            <React.Fragment>

              {hasFiltered && (

                <div style={{ marginBottom: '32px' }}>

                  <h3 className="text-secondary" style={{ marginBottom: '16px', fontSize: '1.25rem', fontWeight: 600 }}>

                    Scorecard Rujukan Berbasis Kompetensi

                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>

                      <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid #e67e22' }}>

                        <div className="text-secondary" style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px' }}>Total Pendapatan INA-CBG (Rp Miliar)</div>

                        <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#e67e22' }}>{formatCompactCurrency(sumInacbg)}</div>

                        <div style={{ marginTop: '8px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Baseline Eksisting</div>

                      </div>

                      <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid #0284c7' }}>

                        <div className="text-secondary" style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px' }}>Total Pendapatan iDRG (Rp Miliar)</div>

                        <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0284c7' }}>{formatCompactCurrency(sumReal + sumLoss)}</div>

                        <div style={{ marginTop: '8px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Sesuai Kompetensi + Loss</div>

                      </div>

                      <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid var(--accent-success)' }}>

                      <div className="text-secondary" style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px' }}>Pendapatan Sesuai Kompetensi Layanan</div>

                      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCompactCurrency(sumReal)}</div>

                      <div style={{ marginTop: '8px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Pendapatan yang berhak diterima RS</div>

                    </div>

                    <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid var(--accent-danger)' }}>

                      <div className="text-secondary" style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px' }}>Potensi Loss (Melayani Di Atas Kompetensi)</div>

                      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent-danger)' }}>{formatCompactCurrency(sumLoss)}</div>

                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.875rem' }}>

                        <div className="flex-between"><span>Dasar:</span> <strong>{formatCompactCurrency(lossLvl.dasar)}</strong></div>

                        <div className="flex-between"><span>Madya:</span> <strong>{formatCompactCurrency(lossLvl.madya)}</strong></div>

                        <div className="flex-between"><span>Utama:</span> <strong>{formatCompactCurrency(lossLvl.utama)}</strong></div>

                        <div className="flex-between"><span>Paripurna:</span> <strong>{formatCompactCurrency(lossLvl.paripurna)}</strong></div>

                      </div>

                    </div>

                    <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid var(--accent-primary)' }}>

                      <div className="text-secondary" style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px' }}>Selisih Pendapatan Sesuai Kompetensi - INACBG</div>

                      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: sumReal - sumInacbg >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>

                        {(sumReal - sumInacbg) > 0 ? '+' : ''}{formatCompactCurrency(sumReal - sumInacbg)}

                      </div>

                      <div style={{ marginTop: '8px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Dibandingkan total Pagu INA-CBG ({formatCompactCurrency(sumInacbg)})</div>

                    </div>

                  </div>
                  <SkenarioShiftingTable 
                    potensiKasusShifting={sumKasusLoss} 
                    potensiPendapatanShifting={sumLoss} 
                    penguranganKasus={sumKasusLoss}
                    penguranganPendapatanInacbg={sumInacbgLoss} 
                    pendapatanEksisting={sumInacbg} 
                    totalKasusEksisting={sumKasusTotal || 1} 
                    targetRsName="Wilayah"
                  />
                </div>
              )}

            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>

              <div style={{ background: 'var(--bg-secondary)', padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>

                <div>

                  <h3 style={{ margin: 0, color: 'var(--accent-primary)', fontSize: '1.25rem' }}>Detail Kasus & Potensi per Rumah Sakit (Provider)</h3>

                  <p className="text-secondary" style={{ fontSize: '0.875rem', marginTop: '4px' }}>Daftar RS yang melakukan klaim layanan di wilayah ini beserta rincian kompetensi layanannya.</p>

                </div>

                <div style={{ marginTop: '4px' }}>

                  <DownloadExcelButton

                    headers={[

                      'Nama RS Provider', 'Komp. Asli RS',

                      'Kasus Dasar', 'Kasus Madya', 'Kasus Utama', 'Kasus Paripurna',

                      'Total Pagu INA-CBG', 'Total Pagu iDRG',

                      'Selisih (iDRG-INA CBGs)', '% Kenaikan',

                      'Pendapatan Sesuai Kompetensi Layanan',

                      'Selisih Pendapatan Layanan - INACBG',

                      'Potensi Loss (Melayani Di Atas Kompetensi)'

                    ]}

                    data={(() => {

                      const extractSim = (val) => (typeof val === 'object' && val !== null) ? (val[`tarif_${simulasi}`] || 0) : (val || 0);

                      const kompLevelMap = { 'dasar': 1, 'madya': 2, 'utama': 3, 'paripurna': 4, 'Belum ada komp. ICD': 999 };

                      return Object.values(filteredDemandByRs).map(rs => {

                        const hasDetails = rs.layananDetails && rs.layananDetails.length > 0;

                        const fKompStr = hasDetails ? 'Multi-Layanan' : (rs.faskesKomp || 'Belum Ada');

                        const fKompStrLow = hasDetails ? '' : (rs.faskesKomp || '').toLowerCase();

                        const totalInacbg = ['dasar','madya','utama','paripurna','Belum ada komp. ICD'].reduce((s,k) => s + rs.kasusByKlaim[k].inacbg, 0);

                        const totalSim = ['dasar','madya','utama','paripurna','Belum ada komp. ICD'].reduce((s,k) => s + extractSim(rs.kasusByKlaim[k].sim), 0);

                        const diff = totalSim - totalInacbg;

                        let totalReal = 0, totalLoss = 0;

                        if (hasDetails) {

                          rs.layananDetails.forEach(d => {

                            const rsLevel = kompLevelMap[(d.faskesKomp||'').toLowerCase()] || 0;

                            ['dasar','madya','utama','paripurna','Belum ada komp. ICD'].forEach(lvl => {

                              const sv = extractSim(d.kasusByKlaim[lvl].sim);

                              if (kompLevelMap[lvl] > rsLevel) totalLoss += sv; else totalReal += sv;

                            });

                          });

                        } else {

                          const rsLevel = kompLevelMap[fKompStrLow] || 0;

                          ['dasar','madya','utama','paripurna','Belum ada komp. ICD'].forEach(lvl => {

                            const sv = extractSim(rs.kasusByKlaim[lvl].sim);

                            if (kompLevelMap[lvl] > rsLevel) totalLoss += sv; else totalReal += sv;

                          });

                        }

                        return [

                          rs.nama,

                          fKompStr,

                          rs.kasusByKlaim.dasar.kasus,

                          rs.kasusByKlaim.madya.kasus,

                          rs.kasusByKlaim.utama.kasus,

                          rs.kasusByKlaim.paripurna.kasus,

                          totalInacbg,

                          totalSim,

                          diff,

                          totalInacbg > 0 ? ((diff / totalInacbg) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%',

                          totalReal,

                          totalReal - totalInacbg,

                          totalLoss

                        ];

                      });

                    })()}

                    filename="Potensi_Shifting_RS.xlsx"

                  />

                </div>

              </div>

              <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh' }}>

                <table className="kemenkes-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'right' }}>

                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>

                    <tr>

                      <th onClick={() => requestSort('nama')} style={{ textAlign: 'left', background: '#ffffff', padding: '12px 16px', position: 'sticky', left: 0, top: 0, zIndex: 12, borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', userSelect: 'none' }}>Nama RS Provider {getSortIndicator('nama')}</th>

                      <th onClick={() => requestSort('komp')} style={{ textAlign: 'center', background: '#ffffff', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', userSelect: 'none' }}>Komp. Asli RS {getSortIndicator('komp')}</th>

                      <th onClick={() => requestSort('kasusDasar')} style={{ background: '#e6f4ea', color: '#137333', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', userSelect: 'none' }}>Kasus Dasar {getSortIndicator('kasusDasar')}</th>

                      <th onClick={() => requestSort('kasusMadya')} style={{ background: '#fef7e0', color: '#b06000', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', userSelect: 'none' }}>Kasus Madya {getSortIndicator('kasusMadya')}</th>

                      <th onClick={() => requestSort('kasusUtama')} style={{ background: '#e8f0fe', color: '#1967d2', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', userSelect: 'none' }}>Kasus Utama {getSortIndicator('kasusUtama')}</th>

                      <th onClick={() => requestSort('kasusParipurna')} style={{ background: '#fce8e6', color: '#c5221f', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', userSelect: 'none' }}>Kasus Paripurna {getSortIndicator('kasusParipurna')}</th>

                      <th onClick={() =>requestSort('ina')} style={{ background: '#ffffff', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', userSelect: 'none' }}>Total Pagu INA-CBG (Rp Miliar) {getSortIndicator('ina')}</th>

                      <th onClick={() =>requestSort('sim')} style={{ background: '#ffffff', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', userSelect: 'none' }}>Total Pagu iDRG (Rp Miliar) {getSortIndicator('sim')}</th>

                      <th onClick={() =>requestSort('selisih')} style={{ background: '#ffffff', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', userSelect: 'none' }}>Selisih (iDRG-INA CBGs) (Rp Miliar) {getSortIndicator('selisih')}</th>

                      <th onClick={() => requestSort('kenaikan')} style={{ background: '#ffffff', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', userSelect: 'none' }}>% Kenaikan {getSortIndicator('kenaikan')}</th>

                      <th onClick={() =>requestSort('real')} style={{ background: '#e6f4ea', color: '#137333', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', userSelect: 'none' }}>Pendapatan Sesuai Kompetensi Layanan (Rp Miliar) {getSortIndicator('real')}</th>

                      <th onClick={() =>requestSort('realDiff')} style={{ background: '#e6f4ea', color: '#137333', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', userSelect: 'none' }}>Selisih Pendapatan Layanan - INACBG (Rp Miliar) {getSortIndicator('realDiff')}</th>

                      <th onClick={() =>requestSort('loss')} style={{ background: '#fce8e6', color: '#c5221f', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', userSelect: 'none' }}>Potensi loss (melayani diatasnya) (Rp Miliar) {getSortIndicator('loss')}</th>

                    </tr>

                  </thead>

                  <tbody>

                    {hasFiltered ? (

                      Object.values(filteredDemandByRs).sort((a,b) => {

                         const extractSim = (val) => (typeof val === 'object' && val !== null) ? (val[`tarif_${simulasi}`] || 0) : (val || 0);

                         const getVals = (rsObj) => {

                            const tot = ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].reduce((sum, k) => sum + (rsObj.kasusByKlaim[k]?.kasus || 0), 0);

                            const sim = ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].reduce((sum, k) => sum + extractSim(rsObj.kasusByKlaim[k].sim), 0);

                            const ina = ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].reduce((sum, k) => sum + rsObj.kasusByKlaim[k].inacbg, 0);

                            

                            const hasDetails = rsObj.layananDetails && rsObj.layananDetails.length > 0;

                            const fKompStrMain = hasDetails ? '' : (rsObj.faskesKomp || '').toLowerCase();

                            const kompLevelMap = { 'dasar': 1, 'madya': 2, 'utama': 3, 'paripurna': 4, 'Belum ada komp. ICD': 999 };

                            

                            let totalReal = 0;

                            let totalLoss = 0;

                            

                            if (hasDetails) {

                              rsObj.layananDetails.forEach(detail => {

                                const rsLevel = kompLevelMap[(detail.faskesKomp || '').toLowerCase()] || 0;

                                ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].forEach(lvl => {

                                  const simVal = extractSim(detail.kasusByKlaim[lvl].sim);

                                  const claimLevel = kompLevelMap[lvl];

                                  if (claimLevel > rsLevel) totalLoss += simVal; else totalReal += simVal;

                                });

                              });

                            } else {

                              const rsLevel = kompLevelMap[fKompStrMain] || 0;

                              ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].forEach(lvl => {

                                const simVal = extractSim(rsObj.kasusByKlaim[lvl].sim);

                                const claimLevel = kompLevelMap[lvl];

                                if (claimLevel > rsLevel) totalLoss += simVal; else totalReal += simVal;

                              });

                            }

                            

                            return {

                               nama: rsObj.nama,

                               komp: hasDetails ? 'multi-layanan' : rsObj.faskesKomp || '',

                               kasusDasar: rsObj.kasusByKlaim.dasar.kasus,

                               kasusMadya: rsObj.kasusByKlaim.madya.kasus,

                               kasusUtama: rsObj.kasusByKlaim.utama.kasus,

                               kasusParipurna: rsObj.kasusByKlaim.paripurna.kasus,

                               ina, sim, selisih: sim - ina,

                               kenaikan: ina > 0 ? (sim - ina)/ina : 0,

                               real: totalReal, realDiff: totalReal - ina, loss: totalLoss,

                               kasusTotal: tot

                            };

                         };

                         

                         const vA = getVals(a);

                         const vB = getVals(b);

                         

                         let valA = vA[sortConfig.key];

                         let valB = vB[sortConfig.key];

                         

                         if (typeof valA === 'string') {

                            const res = valA.localeCompare(valB);

                            return sortConfig.direction === 'ascending' ? res : -res;

                         }

                         

                         const res = valA < valB ? -1 : (valA > valB ? 1 : 0);

                         return sortConfig.direction === 'ascending' ? res : -res;

                      }).map(rs => {

                        const extractSim = (val) => (typeof val === 'object' && val !== null) ? (val[`tarif_${simulasi}`] || 0) : (val || 0);

                        const getSim = () => ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].reduce((sum, k) => sum + extractSim(rs.kasusByKlaim[k].sim), 0);

                        const getInacbg = () => ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].reduce((sum, k) => sum + rs.kasusByKlaim[k].inacbg, 0);

                        const totalSim = getSim();

                        const totalInacbg = getInacbg();

                        const diff = totalSim - totalInacbg;

                        const diffColor = diff > 0 ? 'var(--accent-success)' : (diff < 0 ? 'var(--accent-danger)' : 'inherit');

                        

                        const isExpanded = expandedRows[rs.kode];

                        const hasDetails = rs.layananDetails && rs.layananDetails.length > 0;

                        

                        const fKompStrMain = hasDetails ? '' : (rs.faskesKomp || '').toLowerCase();

                        const kompLevelMap = { 'dasar': 1, 'madya': 2, 'utama': 3, 'paripurna': 4, 'Belum ada komp. ICD': 999 };

                        

                        // Calculate Potensi

                        let totalReal = 0;

                        let totalLoss = 0;

                        

                        if (hasDetails) {

                          rs.layananDetails.forEach(detail => {

                            const rsLevel = kompLevelMap[(detail.faskesKomp || '').toLowerCase()] || 0;

                            ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].forEach(lvl => {

                              const simVal = extractSim(detail.kasusByKlaim[lvl].sim);

                              const claimLevel = kompLevelMap[lvl];

                              if (claimLevel > rsLevel) {

                                totalLoss += simVal;

                              } else {

                                totalReal += simVal;

                              }

                            });

                          });

                        } else {

                          const rsLevel = kompLevelMap[fKompStrMain] || 0;

                          ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].forEach(lvl => {

                            const simVal = extractSim(rs.kasusByKlaim[lvl].sim);

                            const claimLevel = kompLevelMap[lvl];

                            if (claimLevel > rsLevel) {

                              totalLoss += simVal;

                            } else {

                              totalReal += simVal;

                            }

                          });

                        }

                        

                        const renderKasusNodeWithColor = (kompStr, kasusObj, lvlKey, isDetail = false) => {

                          const cases = kasusObj[lvlKey].kasus;

                          if (cases === 0) return '-';

                          

                          const totalCases = ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].reduce((sum, k) => sum + kasusObj[k].kasus, 0);

                          const percentage = totalCases > 0 ? ((cases / totalCases) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%' : '0%';

                          

                          const rsLevel = kompLevelMap[kompStr] || 0;

                          const claimLevel = kompLevelMap[lvlKey];

                          let color = isDetail ? 'var(--text-secondary)' : 'inherit';

                          let bg = 'transparent';

                          

                          if (claimLevel > rsLevel) {

                            color = 'var(--accent-danger)';

                            bg = 'rgba(220, 53, 69, 0.05)';

                          } else {

                            color = 'var(--accent-success)';

                            bg = 'rgba(40, 167, 69, 0.05)';

                          }

                          

                          return (

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: bg, padding: '4px', borderRadius: '4px' }}>

                              <span style={{ color: color, fontWeight: rsLevel > 0 ? '600' : (isDetail ? 'normal' : '500') }}>{cases.toLocaleString()}</span>

                              <span style={{ fontSize: '0.65rem', color: rsLevel > 0 ? color : '#95a5a6' }}>({percentage})</span>

                            </div>

                          );

                        };

                        

                        const realDiffMain = totalReal - totalInacbg;

                        const realDiffMainColor = realDiffMain > 0 ? 'var(--accent-success)' : (realDiffMain < 0 ? 'var(--accent-danger)' : 'inherit');

                        

                        return (

                          <React.Fragment key={rs.kode}>

                            <tr 

                              style={{ cursor: hasDetails ? 'pointer' : 'default', background: isExpanded ? 'var(--bg-secondary)' : 'transparent', borderBottom: '1px solid var(--glass-border)' }}

                                  onClick={() => hasDetails && toggleRow(rs.kode)}

                            >

                              <td style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)', position: 'sticky', left: 0, background: isExpanded ? 'var(--bg-secondary)' : 'var(--bg-primary)', zIndex: 1, borderRight: '1px solid var(--glass-border)' }}>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

                                  {hasDetails ? (

                                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', width: '16px' }}>{isExpanded ? '▼' : '▶'}</span>

                                  ) : (

                                    <span style={{ width: '16px' }}></span>

                                  )}

                                  {rs.nama}

                                </div>

                              </td>

                              <td style={{ textAlign: 'center', padding: '12px 16px', textTransform: 'capitalize' }}>

                                <span style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', fontSize: '0.75rem' }}>{hasDetails ? 'Multi-Layanan' : (rs.faskesKomp || 'Belum Ada')}</span>

                              </td>

                              <td style={{ padding: '4px 8px' }}>{renderKasusNodeWithColor('', rs.kasusByKlaim, 'dasar', false)}</td>

                              <td style={{ padding: '4px 8px' }}>{renderKasusNodeWithColor('', rs.kasusByKlaim, 'madya', false)}</td>

                              <td style={{ padding: '4px 8px' }}>{renderKasusNodeWithColor('', rs.kasusByKlaim, 'utama', false)}</td>

                              <td style={{ padding: '4px 8px' }}>{renderKasusNodeWithColor('', rs.kasusByKlaim, 'paripurna', false)}</td>

                              <td style={{ padding: '12px 16px', color: '#7f8c8d' }}>{formatTableMiliar(totalInacbg)}</td>

                              <td style={{ padding: '12px 16px' }}>{formatTableMiliar(totalSim)}</td>

                              <td style={{ padding: '12px 16px', fontWeight: 'bold', color: diffColor }}>{diff > 0 ? '+' : ''}{formatTableMiliar(diff)}</td>

                              <td style={{ padding: '12px 16px', fontWeight: 'bold', color: diffColor }}>{totalInacbg > 0 ? (diff > 0 ? '+' : '') + ((diff / totalInacbg) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%'}</td>

                              <td style={{ padding: '12px 16px', color: 'var(--accent-success)', fontWeight: '600' }}>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>

                                  <span>{formatTableMiliar(totalReal)}</span>

                                  <span style={{ fontSize: '0.7rem', color: '#137333' }}>({totalSim > 0 ? ((totalReal / totalSim) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%' : '0%'})</span>

                                </div>

                              </td>

                              <td style={{ padding: '12px 16px', fontWeight: 'bold', color: realDiffMainColor }}>{realDiffMain > 0 ? '+' : ''}{formatTableMiliar(realDiffMain)}</td>

                              <td style={{ padding: '12px 16px', color: 'var(--accent-danger)', fontWeight: '600' }}>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>

                                  <span>{formatTableMiliar(totalLoss)}</span>

                                  <span style={{ fontSize: '0.7rem', color: '#c5221f' }}>({totalSim > 0 ? ((totalLoss / totalSim) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%' : '0%'})</span>

                                </div>

                              </td>

                            </tr>

                            

                            {isExpanded && hasDetails && rs.layananDetails.map((detail, idx) => {

                              const extractSim = (val) => (typeof val === 'object' && val !== null) ? (val[`tarif_${simulasi}`] || 0) : (val || 0);

                              const dGetSim = () => ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].reduce((sum, k) => sum + extractSim(detail.kasusByKlaim[k].sim), 0);

                              const dGetInacbg = () => ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].reduce((sum, k) => sum + detail.kasusByKlaim[k].inacbg, 0);

                              const dSim = dGetSim();

                              const dInacbg = dGetInacbg();

                              const dDiff = dSim - dInacbg;

                              const dDiffColor = dDiff > 0 ? 'var(--accent-success)' : (dDiff < 0 ? 'var(--accent-danger)' : 'inherit');

                              

                              const fKompStr = (detail.faskesKomp || '').toLowerCase();

                              

                              let dReal = 0;

                              let dLoss = 0;

                              const rsLevel = kompLevelMap[fKompStr] || 0;

                              ['dasar', 'madya', 'utama', 'paripurna', 'Belum ada komp. ICD'].forEach(lvl => {

                                const simVal = extractSim(detail.kasusByKlaim[lvl].sim);

                                const claimLevel = kompLevelMap[lvl];

                                if (rsLevel > 0 && claimLevel > rsLevel) {

                                  dLoss += simVal;

                                } else {

                                  dReal += simVal;

                                }

                              });

                              

                              const dRealDiff = dReal - dInacbg;

                              const dRealDiffColor = dRealDiff > 0 ? 'var(--accent-success)' : (dRealDiff < 0 ? 'var(--accent-danger)' : 'inherit');

                              

                              return (

                                <tr key={`${rs.nama}-${idx}`} style={{ background: 'rgba(0,0,0,0.02)', fontSize: '0.8rem', borderBottom: '1px solid var(--glass-border)' }}>

                                  <td style={{ textAlign: 'left', padding: '8px 16px 8px 48px', color: 'var(--text-secondary)', position: 'sticky', left: 0, background: 'var(--bg-primary)', zIndex: 1, borderRight: '1px solid var(--glass-border)' }}>

                                    ↳ {detail.layanan}

                                  </td>

                                  <td style={{ textAlign: 'center', padding: '8px 16px', textTransform: 'capitalize' }}>

                                    <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', fontSize: '0.7rem' }}>{detail.faskesKomp || 'Belum Ada'}</span>

                                  </td>

                                  <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{renderKasusNodeWithColor('', detail.kasusByKlaim, 'dasar', true)}</td>

                                  <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{renderKasusNodeWithColor('', detail.kasusByKlaim, 'madya', true)}</td>

                                  <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{renderKasusNodeWithColor('', detail.kasusByKlaim, 'utama', true)}</td>

                                  <td style={{ padding: '4px 8px', color: 'var(--text-secondary)' }}>{renderKasusNodeWithColor('', detail.kasusByKlaim, 'paripurna', true)}</td>

                                  <td style={{ padding: '8px 16px', color: '#95a5a6' }}>{formatTableMiliar(dInacbg)}</td>

                                  <td style={{ padding: '8px 16px', color: 'var(--text-secondary)' }}>{formatTableMiliar(dSim)}</td>

                                  <td style={{ padding: '8px 16px', fontWeight: 'bold', color: dDiffColor }}>{dDiff > 0 ? '+' : ''}{formatTableMiliar(dDiff)}</td>

                                  <td style={{ padding: '8px 16px', fontWeight: 'bold', color: dDiffColor }}>{dInacbg > 0 ? (dDiff > 0 ? '+' : '') + ((dDiff / dInacbg) * 100).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '%' : '0%'}</td>

                                  <td style={{ padding: '8px 16px', color: 'var(--accent-success)', fontWeight: '600' }}>

                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>

                                      <span>{formatTableMiliar(dReal)}</span>

                                      <span style={{ fontSize: '0.65rem', color: '#137333' }}>({dSim > 0 ? ((dReal / dSim) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%' : '0%'})</span>

                                    </div>

                                  </td>

                                  <td style={{ padding: '8px 16px', fontWeight: 'bold', color: dRealDiffColor }}>{dRealDiff > 0 ? '+' : ''}{formatTableMiliar(dRealDiff)}</td>

                                  <td style={{ padding: '8px 16px', color: 'var(--accent-danger)', fontWeight: '600' }}>

                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>

                                      <span>{formatTableMiliar(dLoss)}</span>

                                      <span style={{ fontSize: '0.65rem', color: '#c5221f' }}>({dSim > 0 ? ((dLoss / dSim) * 100).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%' : '0%'})</span>

                                    </div>

                                  </td>

                                </tr>

                              );

                            })}

                          </React.Fragment>

                        );

                      })

                    ) : (

                      <tr>

                        <td colSpan="13" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>

                          Tidak ada data rumah sakit yang sesuai filter saat ini.

                        </td>

                      </tr>

                    )}

                  </tbody>

                </table>

              </div>

            </div>

            </React.Fragment>

            );

          })()}

        </div>

      )}

      </div>



      {selectedRsForModal && (

        <div style={{

          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,

          background: 'rgba(0,0,0,0.5)', zIndex: 9999,

          display: 'flex', alignItems: 'center', justifyContent: 'center'

        }}>

          <div className="glass-card animate-fade-in-up" style={{ padding: '24px', width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>

            <div className="flex-between" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '16px' }}>

              <h3 style={{ margin: 0, color: 'var(--accent-primary)' }}>{selectedRsForModal.nama}</h3>

              <button 

                onClick={() => setSelectedRsForModal(null)}

                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}

              >&times;</button>

            </div>

            <p className="text-secondary" style={{ fontSize: '0.875rem', marginBottom: '16px' }}>

              Daftar kelompok layanan (Kompetensi {selectedRsForModal.level}) yang dimiliki RS ini:

            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>

              {selectedRsForModal.layananList.map((lyn, i) => {

                const rsData = shiftingNode?.demandByRs?.[selectedRsForModal.kode];

                let dCases = 0;

                let dInacbg = 0;

                let dSim = 0;

                if (rsData && rsData.layananDetails) {

                  const dDetail = rsData.layananDetails.find(d => d.layanan === lyn);

                  if (dDetail) {

                    const lvl = selectedRsForModal.level.toLowerCase();

                    if (dDetail.kasusByKlaim[lvl]) {

                      dCases = dDetail.kasusByKlaim[lvl].kasus || 0;

                      dInacbg = dDetail.kasusByKlaim[lvl].inacbg || 0;

                      dSim = dDetail.kasusByKlaim[lvl].sim[`tarif_${simulasi}`] || 0;

                    }

                  }

                }



                return (

                  <li key={i} style={{ padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => handleLayananClick(lyn, selectedRsForModal.kode)}>

                    <div className="flex-between">

                      <div style={{ display: 'flex', alignItems: 'center' }}>

                        <Stethoscope size={14} style={{ marginRight: '8px', color: 'var(--accent-secondary)' }} />

                        {lyn}

                      </div>

                      {dCases > 0 ? (

                        <div style={{ textAlign: 'right', fontSize: '0.75rem' }}>

                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{dCases.toLocaleString()} Kasus</div>

                          <div style={{ color: 'var(--text-muted)' }}>INA-CBG: <span style={{ color: '#7f8c8d' }}>{formatCompactCurrency(dInacbg)}</span> | iDRG: <span style={{ color: 'var(--text-primary)' }}>{formatCompactCurrency(dSim)}</span></div>

                        </div>

                      ) : (

                        <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Belum ada kasus</div>

                      )}

                    </div>

                    {expandedLayanan === lyn && (() => {

                      const lvl = selectedRsForModal.level.toLowerCase();

                      const detailData = hospitalDetails && hospitalDetails[lvl] ? hospitalDetails[lvl][lyn] : null;

                      return (

                        <div className="animate-fade-in" style={{ marginTop: '16px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px', cursor: 'default' }} onClick={(e) => e.stopPropagation()}>

                          {loadingDetails ? (

                            <div style={{ textAlign: 'center', padding: '10px', color: 'var(--text-secondary)' }}><Activity className="animate-spin" size={20} style={{ display: 'inline-block', verticalAlign: 'middle' }} /> <span style={{ verticalAlign: 'middle', marginLeft: '8px' }}>Memuat rincian INA-CBG...</span></div>

                          ) : detailData ? (

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                              {Object.entries(detailData).sort((a,b) => b[1].kasus - a[1].kasus).map(([inacbgCode, inacbgData]) => (

                                <div key={inacbgCode} style={{ background: 'var(--bg-app)', border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden' }}>

                                <div style={{ padding: '12px', background: 'rgba(52, 152, 219, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>

                                  <div>

                                    <div style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.9rem' }}>{inacbgCode}</div>

                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{inacbgData.desc}</div>

                                  </div>

                                  <div style={{ textAlign: 'right' }}>

                                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{inacbgData.kasus.toLocaleString()} Kasus</div>

                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '2px' }}>{formatCurrency(inacbgData.inacbg || 0)}</div>

                                  </div>

                                </div>

                                <div style={{ padding: '0 12px 12px 12px' }}>

                                  <table className="data-table" style={{ marginTop: '8px', fontSize: '0.75rem', width: '100%', background: 'transparent' }}>

                                    <thead><tr> <th style={{ background: 'var(--bg-primary)', padding: '6px 8px' }}>iDRG (Rp Miliar)</th>

                                        <th style={{ background: 'var(--bg-primary)', padding: '6px 8px' }}>Deskripsi</th>

                                        <th style={{ background: 'var(--bg-primary)', padding: '6px 8px', textAlign: 'right' }}>Kasus</th>

                                        <th style={{ background: 'var(--bg-primary)', padding: '6px 8px', textAlign: 'right' }}>Tarif iDRG (Rp Miliar)</th>

                                      </tr>

                                    </thead>

                                    <tbody>

                                      {Object.entries(inacbgData.idrgs).sort((a,b) => b[1].kasus - a[1].kasus).map(([drgCode, drgData]) => (

                                        <tr key={drgCode} style={{ borderBottom: '1px solid var(--glass-border)' }}>

                                          <td style={{ fontWeight: 700, padding: '6px 8px', color: 'var(--text-primary)' }}>{drgCode}</td>

                                          <td style={{ color: 'var(--text-secondary)', padding: '6px 8px' }}>{drgData.desc}</td>

                                          <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>{drgData.kasus.toLocaleString()}</td>

                                          <td style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 700, color: 'var(--accent-secondary)' }}>

                                            {formatTableMiliar(drgData.sim[`tarif_${simulasi}`] || 0)}

                                          </td>

                                        </tr>

                                      ))}

                                    </tbody>

                                  </table>

                                </div>

                              </div>

                            ))}

                          </div>

                        ) : (

                          <div style={{ textAlign: 'center', padding: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Tidak ada rincian data (Kasus = 0).</div>

                        )}

                      </div>

                      );

                    })()}

                  </li>

                );

              })}

            </ul>

          </div>

        </div>

      )}

      {/* HIDDEN CONTAINER FOR PPT EXPORT OF TOP 10 RS PROFILES */}
      <div id="export-hidden-profiles" style={{ position: 'absolute', left: '-9999px', top: 0, width: '900px' }}>
        {combinedRegionData && 
          [...combinedRegionData.rsList]
            .sort((a,b) => b.kasus - a.kasus)
            .slice(0, 10)
            .map(rs => (
              <div key={`export-${rs.kode}`} data-rs-name={rs.nama} style={{ marginBottom: '20px' }}>
                <HospitalProfileCard 
                  rs={rs} 
                  profile={rsProfilesData ? rsProfilesData[rs.kode] : null} 
                  simulasi={simulasi} 
                  isExportMode={true} 
                  excludeNonKomp={excludeNonKomp}
                  rsKompetensiOnline={rsKompetensiOnline}
                />
              </div>
          ))}
      </div>
    </React.Fragment>
  );

};



export default AnalisisShifting;

