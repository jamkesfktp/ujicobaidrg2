import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { scaleQuantile } from 'd3-scale';
import { formatCompactCurrency } from '../utils/formatters';

// Fix Leaflet marker icons in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28]
});
L.Marker.prototype.options.icon = DefaultIcon;

const geoUrl = '/data/indonesia-prov.geojson';
const coordsUrl = '/data/hospital_coords.json';

const mapToDataKeys = {
  "Aceh": ["DI. ACEH", "ACEH", "NAD"],
  "Bali": ["BALI"],
  "Bangka Belitung": ["KEPULAUAN BANGKA BELITUNG", "BANGKA BELITUNG"],
  "Bengkulu": ["BENGKULU"],
  "Banten": ["BANTEN"],
  "Gorontalo": ["GORONTALO"],
  "Jambi": ["JAMBI"],
  "Jawa Barat": ["JAWA BARAT"],
  "Jawa Timur": ["JAWA TIMUR"],
  "Jakarta Raya": ["DKI JAKARTA", "JAKARTA RAYA", "JAKARTA"],
  "Jawa Tengah": ["JAWA TENGAH"],
  "Kalimantan Barat": ["KALIMANTAN BARAT"],
  "Kalimantan Timur": ["KALIMANTAN TIMUR"],
  "Kepulauan Riau": ["KEPULAUAN RIAU"],
  "Kalimantan Selatan": ["KALIMANTAN SELATAN"],
  "Kalimantan Tengah": ["KALIMANTAN TENGAH"],
  "Kalimantan Utara": ["KALIMANTAN UTARA"],
  "Lampung": ["LAMPUNG"],
  "Maluku": ["MALUKU"],
  "Maluku Utara": ["MALUKU UTARA"],
  "Nusa Tenggara Barat": ["NUSA TENGGARA BARAT", "NTB", "NUSATENGGARA BARAT"],
  "Nusa Tenggara Timur": ["NUSA TENGGARA TIMUR", "NTT"],
  "Papua": ["PAPUA", "PAPUA TENGAH", "PAPUA PEGUNUNGAN", "PAPUA SELATAN", "PAPUA BARAT DAYA"],
  "Papua Barat": ["PAPUA BARAT"],
  "Riau": ["RIAU"],
  "Sulawesi Utara": ["SULAWESI UTARA"],
  "Sumatera Barat": ["SUMATERA BARAT"],
  "Sulawesi Tenggara": ["SULAWESI TENGGARA"],
  "Sulawesi Selatan": ["SULAWESI SELATAN"],
  "Sulawesi Barat": ["SULAWESI BARAT"],
  "Sumatera Selatan": ["SUMATERA SELATAN"],
  "Sulawesi Tengah": ["SULAWESI TENGAH"],
  "Sumatera Utara": ["SUMATERA UTARA"],
  "Yogyakarta": ["DAERAH ISTIMEWA YOGYAKARTA", "DI YOGYAKARTA", "DIY", "YOGYAKARTA"]
};

const geoToState = {
  "Daerah Istimewa Yogyakarta": "Yogyakarta",
  "Dki Jakarta": "Jakarta Raya",
  "Nusa Tenggara Barat": "Nusa Tenggara Barat",
  "Nusa Tenggara Timur": "Nusa Tenggara Timur",
  "Bangka Belitung": "Bangka Belitung"
};

const BoundsController = ({ selectedGeoJsonArray }) => {
  const map = useMap();
  useEffect(() => {
    if (selectedGeoJsonArray && selectedGeoJsonArray.length > 0) {
      const bounds = L.latLngBounds();
      selectedGeoJsonArray.forEach(f => {
        const layer = L.geoJSON(f);
        bounds.extend(layer.getBounds());
      });
      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [20, 20], duration: 1.2 });
      }
    } else {
      map.flyTo([-2.5, 118], 5, { duration: 1.2 });
    }
  }, [selectedGeoJsonArray, map]);
  return null;
};

const combineData = (regionsData) => {
  if (!regionsData) return {};
  return JSON.parse(JSON.stringify(regionsData));
};

const getMetricValue = (regionData, metric, simulasi) => {
  if (!regionData) return 0;
  if (metric === 'kasus') return regionData.kasus;
  if (metric === 'inacbg') return regionData.inacbg;
  if (metric === 'idrg') return regionData.sim || 0;
  if (metric === 'selisih') return regionData.selisih !== undefined ? regionData.selisih : ((regionData.sim || 0) - (regionData.inacbg || 0));
  return 0;
};




function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(map.getContainer());
    return () => resizeObserver.disconnect();
  }, [map]);
  return null;
}

const MapIndonesia = ({ regionsData, metric = 'kasus', simulasi = 11, rsFilter = '', onRegionClick, onMarkerClick, onExport, isExporting, selectedProvinces = [] }) => {
  const [geoData, setGeoData] = useState(null);
  const [hospitalCoords, setHospitalCoords] = useState({});
  const [selectedGeoJsonArray, setSelectedGeoJsonArray] = useState([]);
  const [isVectorMode, setIsVectorMode] = useState(true);
  const geoJsonRef = useRef();

  useEffect(() => {
    fetch(geoUrl)
      .then(res => res.json())
      .then(data => {
        setGeoData(data);
      })
      .catch(err => console.error("Error loading geojson", err));
      
    fetch(coordsUrl)
      .then(res => res.json())
      .then(data => {
        setHospitalCoords(data);
      })
      .catch(err => console.error("Error loading hospital coords", err));
  }, []);

  const processedData = useMemo(() => combineData(regionsData), [regionsData]);

  const { values, regionMetricMap, originalDataMap, fullRegionDataMap } = useMemo(() => {
    const vals = [];
    const rMap = {};
    const oMap = {};
    const fMap = {};
    
    Object.keys(mapToDataKeys).forEach(mapState => {
      const possibleKeys = mapToDataKeys[mapState];
      let foundData = null;
      let primaryDataKey = null;
      
      for (let k of possibleKeys) {
        if (processedData[k]) {
          if (!foundData) {
            foundData = { ...processedData[k] };
            primaryDataKey = k;
          } else {
             foundData.kasus += processedData[k].kasus || 0;
             foundData.inacbg += processedData[k].inacbg || 0;
             foundData.sim = (foundData.sim || 0) + (processedData[k].sim || 0);
             if (foundData.selisih !== undefined && processedData[k].selisih !== undefined) {
               foundData.selisih += processedData[k].selisih;
             }
             if (Array.isArray(foundData.rsList) && Array.isArray(processedData[k].rsList)) {
                 foundData.rsList = [...foundData.rsList, ...processedData[k].rsList];
             }
          }
        }
      }

      if (foundData) {
        const val = getMetricValue(foundData, metric, simulasi);
        vals.push(val);
        rMap[mapState] = val;
        oMap[mapState] = primaryDataKey;
        fMap[mapState] = foundData;
      }
    });
    
    return { values: vals.filter(v => v !== undefined && v !== null), regionMetricMap: rMap, originalDataMap: oMap, fullRegionDataMap: fMap };
  }, [processedData, metric, simulasi]);

  const colorScale = useMemo(() => {
    if (values.length === 0) return () => '#e2e8f0';

    if (metric === 'selisih') {
      return (val) => {
        if (val === undefined || val === null) return '#e2e8f0';
        if (val < 0) return '#fca5a5';
        if (val === 0) return '#e2e8f0';
        if (val > 0 && val < 1000000000) return '#bbf7d0';
        if (val >= 1000000000 && val < 10000000000) return '#4ade80';
        if (val >= 10000000000 && val < 50000000000) return '#22c55e';
        return '#16a34a';
      }
    } else {
      const range = ["#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af"];
      return scaleQuantile().domain(values).range(range);
    }
  }, [values, metric]);

  const getGeoStateName = (geoPropinsi) => {
    let name = geoPropinsi;
    
    // Check direct override first (case-insensitive)
    const overrideKey = Object.keys(geoToState).find(k => k.toLowerCase() === name.toLowerCase());
    if (overrideKey) {
        name = geoToState[overrideKey];
    }
    
    // If not found in regionMetricMap directly
    if (!regionMetricMap[name]) {
        let found = false;
        // Pass 1: Exact match on aliases
        for (let mapKey of Object.keys(mapToDataKeys)) {
            const aliases = mapToDataKeys[mapKey];
            if (aliases.some(alias => alias.toLowerCase() === name.toLowerCase())) {
                name = mapKey;
                found = true;
                break;
            }
        }
        
        // Pass 2: Fuzzy match only if exact match failed
        if (!found) {
            for (let mapKey of Object.keys(mapToDataKeys)) {
                if (name.toLowerCase().includes(mapKey.toLowerCase()) || mapKey.toLowerCase().includes(name.toLowerCase())) {
                    name = mapKey;
                    break;
                }
            }
        }
    }
    return name;
  };
  
  useEffect(() => {
      if (selectedProvinces && selectedProvinces.length > 0 && geoData && geoData.features) {
          const features = geoData.features.filter(f => {
              const propName = f.properties.Propinsi || f.properties.NAME_1 || f.properties.state;
              const stateName = getGeoStateName(propName);
              const actualKey = originalDataMap[stateName] || stateName;
              return selectedProvinces.some(sp => sp.toUpperCase() === actualKey.toUpperCase());
          });
          setSelectedGeoJsonArray(features);
      } else {
          setSelectedGeoJsonArray([]);
      }
  }, [selectedProvinces, geoData, originalDataMap]);

  const getFeatureStyle = (feature) => {
    const propName = feature.properties.Propinsi || feature.properties.NAME_1 || feature.properties.state;
    const stateName = getGeoStateName(propName);
    const val = regionMetricMap[stateName];
    const color = val !== undefined ? colorScale(val) : '#e2e8f0';

    const actualKey = originalDataMap[stateName] || stateName;
    const isSelected = selectedProvinces.some(sp => sp.toUpperCase() === actualKey.toUpperCase());
    const isOtherSelected = selectedProvinces.length > 0 && !isSelected;

    if (isOtherSelected) {
      return {
        fillColor: '#cbd5e1',
        fillOpacity: 0.1,
        weight: 1,
        color: isVectorMode ? '#f1f5f9' : '#e2e8f0',
        dashArray: '4'
      };
    }

    if (isSelected) {
      return {
        fillColor: color,
        fillOpacity: 0.95,
        weight: 3,
        color: '#1e40af',
        dashArray: '0'
      };
    }

    return {
      fillColor: color,
      fillOpacity: isVectorMode ? 0.9 : 0.8,
      weight: isVectorMode ? 1.5 : 1,
      color: isVectorMode ? '#94a3b8' : '#ffffff',
      dashArray: isVectorMode ? '0' : '3'
    };
  };

  const onEachFeature = (feature, layer) => {
    const propName = feature.properties.Propinsi || feature.properties.NAME_1 || feature.properties.state;
    const stateName = getGeoStateName(propName);
    const actualKey = originalDataMap[stateName] || stateName;

    const rData = fullRegionDataMap[stateName];
    const eksistingName = (rsFilter && Array.isArray(rsFilter) && rsFilter.length > 0)
      ? `Pendapatan Eksisting ${rsFilter.length === 1 ? rsFilter[0].label : 'RS Terpilih'}`
      : 'Pendapatan Eksisting Regional';
      
    let tooltipHtml = `<div><strong>${stateName}</strong><br/>Data Tidak Tersedia</div>`;
    if (rData) {
        tooltipHtml = `
          <div style="text-align: left; line-height: 1.5; font-family: 'Century Gothic', CenturyGothic, AppleGothic, sans-serif;">
            <strong style="display: block; border-bottom: 1px solid rgba(0,0,0,0.1); padding-bottom: 4px; margin-bottom: 4px;">${stateName}</strong>
            Total Kasus: ${rData.kasus.toLocaleString()}<br/>
            ${eksistingName}: Rp ${formatCompactCurrency(rData.inacbg)}<br/>
            Potensi iDRG: Rp ${formatCompactCurrency(rData.sim)}<br/>
            Selisih: Rp ${formatCompactCurrency(rData.selisih)}
          </div>
        `;
    }
    layer.bindTooltip(tooltipHtml, { sticky: true, opacity: 0.95 });

    layer.on({
      mouseover: (e) => {
        const layer = e.target;
        layer.setStyle({
          weight: 3,
          color: '#f59e0b',
          dashArray: '',
          fillOpacity: 1
        });
        layer.bringToFront();
      },
      mouseout: (e) => {
        geoJsonRef.current.resetStyle(e.target);
      },
      click: (e) => {
        if (onRegionClick) {
          onRegionClick(actualKey.toUpperCase());
        }
      }
    });
  };

  const handleZoomOut = () => {
    if (onRegionClick) onRegionClick(null);
  };
  
  const activeMarkers = useMemo(() => {
      if (!selectedProvinces || selectedProvinces.length === 0) return [];
      
      let allMarkers = [];
      selectedProvinces.forEach(sp => {
        const rData = processedData[sp];
        if (rData && Array.isArray(rData.rsList)) {
            const markers = rData.rsList.map(rs => {
                const coords = hospitalCoords[rs.kode];
                if (coords) {
                    return { ...rs, lat: coords.lat, lng: coords.lng };
                }
                return null;
            }).filter(Boolean);
            allMarkers = [...allMarkers, ...markers];
        }
      });
      return allMarkers;
  }, [selectedProvinces, processedData, hospitalCoords]);

  return (
    <div id="export-map-container" className="map-container" style={{ position: 'relative', width: '100%', height: '500px', background: isVectorMode ? '#ffffff' : '#f8fafc', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', zIndex: 0 }}>
      <div data-html2canvas-ignore="true" style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 1000, display: 'flex', gap: '10px' }}>
        <button 
          onClick={() => setIsVectorMode(!isVectorMode)}
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {isVectorMode ? 'Mode Satelit' : 'Mode Vektor'}
        </button>
        {onExport && (
          <button 
            onClick={onExport} 
            disabled={isExporting}
            style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: isExporting ? 'wait' : 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', opacity: isExporting ? 0.7 : 1 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {isExporting ? 'Mengekspor...' : 'Export PPT'}
          </button>
        )}
        {selectedProvinces && selectedProvinces.length > 0 && (
          <button onClick={handleZoomOut} style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', fontWeight: 600, color: '#334155' }}>
            &larr; Kembali ke Peta Nasional
          </button>
        )}
      </div>
      
      <MapContainer preferCanvas={true} 
        center={[-2.5, 118]} 
        zoom={5} 
        style={{ height: '100%', width: '100%', background: 'transparent' }} 
        zoomControl={false}
        attributionControl={false}
      >
        <MapResizer />
        {!isVectorMode && (
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            opacity={0.8}
          />
        )}
        
        {geoData && (
          <GeoJSON 
            data={geoData} 
            style={getFeatureStyle}
            onEachFeature={onEachFeature} 
            ref={geoJsonRef}
          />
        )}

        {activeMarkers.map(rs => (
            <Marker 
              key={rs.kode} 
              position={[rs.lat, rs.lng]}
              eventHandlers={{ click: () => onMarkerClick && onMarkerClick(rs) }}
            >
                <Popup>
                    <div style={{ fontFamily: 'Quattrocento Sans, sans-serif' }}>
                        <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', fontSize: '14px' }}>{rs.nama}</h4>
                        <div style={{ fontSize: '12px', color: '#475569' }}>
                            <div><strong>Kelas:</strong> {rs.kelas || 'N/A'}</div>
                            <div><strong>Kasus:</strong> {rs.kasus.toLocaleString('en-US')}</div>
                            <div><strong>INA-CBG:</strong> {formatCompactCurrency(rs.inacbg)}</div>
                            <div><strong>iDRG:</strong> {formatCompactCurrency(rs.sim)}</div>
                        </div>
                    </div>
                </Popup>
            </Marker>
        ))}

        <BoundsController selectedGeoJsonArray={selectedGeoJsonArray} />
      </MapContainer>
      
      <div style={{ padding: '16px', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.9rem', color: '#334155' }}>Legenda ({metric === 'selisih' ? 'Selisih' : 'Skala'}):</strong>
        {metric === 'selisih' ? (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', background: '#fca5a5', borderRadius: '3px' }}></div> Negatif (Loss)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', background: '#e2e8f0', borderRadius: '3px' }}></div> Tidak Ada Data</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', background: '#bbf7d0', borderRadius: '3px' }}></div> Gain Kecil</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', background: '#4ade80', borderRadius: '3px' }}></div> Gain Sedang</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '14px', height: '14px', background: '#16a34a', borderRadius: '3px' }}></div> Gain Besar</div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
            <span style={{ marginRight: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Rendah</span>
            {["#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af"].map(c => (
              <div key={c} style={{ width: '14px', height: '14px', background: c, borderRadius: '2px' }}></div>
            ))}
            <span style={{ marginLeft: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tinggi</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapIndonesia;
