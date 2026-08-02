import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatCompactCurrency } from '../utils/formatters';

// Map aliases (same as MapIndonesia)
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

const getGeoStateName = (name) => {
  for (let mapKey of Object.keys(mapToDataKeys)) {
    const aliases = mapToDataKeys[mapKey];
    if (aliases.some(alias => alias.toLowerCase() === name.toLowerCase())) {
        return mapKey;
    }
  }
  for (let mapKey of Object.keys(mapToDataKeys)) {
    if (name.toLowerCase().includes(mapKey.toLowerCase()) || mapKey.toLowerCase().includes(name.toLowerCase())) {
        return mapKey;
    }
  }
  return name;
};

// Calculate Bounding Box Center of GeoJSON Feature
const getFeatureCenter = (feature) => {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  
  const processCoords = (coords) => {
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    } else {
      coords.forEach(processCoords);
    }
  };
  
  if (feature.geometry && feature.geometry.coordinates) {
    processCoords(feature.geometry.coordinates);
  }
  
  if (minLat === 90) return null; // fallback
  return [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
};

const getBezierCurve = (lat1, lng1, lat2, lng2) => {
  const points = [];
  const numPoints = 50;
  // Control point
  const latC = (lat1 + lat2) / 2 + (lng2 - lng1) * 0.15;
  const lngC = (lng1 + lng2) / 2 - (lat2 - lat1) * 0.15;
  
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lat = Math.pow(1 - t, 2) * lat1 + 2 * (1 - t) * t * latC + Math.pow(t, 2) * lat2;
    const lng = Math.pow(1 - t, 2) * lng1 + 2 * (1 - t) * t * lngC + Math.pow(t, 2) * lng2;
    points.push([lat, lng]);
  }
  return points;
};

// Custom arrow icon creator
const createArrowIcon = (lat1, lng1, lat2, lng2, color = '#f97316') => {
  const angle = Math.atan2(lng2 - lng1, lat2 - lat1) * 180 / Math.PI;
  // Leaflet uses x,y where x is lng, y is lat. SVG rotation needs to be adjusted.
  return L.divIcon({
    className: 'custom-arrow-icon',
    html: `<div style="transform: rotate(${angle}deg); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 12px solid ${color};"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
};

const createHospitalIcon = (color = '#e11d48') => {
  return L.divIcon({
    className: 'hospital-marker-icon',
    html: `
      <div style="background: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white;">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
          <path d="M9 22v-4h6v4"></path>
          <path d="M8 6h.01"></path>
          <path d="M16 6h.01"></path>
          <path d="M12 6h.01"></path>
          <path d="M12 10h.01"></path>
          <path d="M12 14h.01"></path>
          <path d="M16 10h.01"></path>
          <path d="M16 14h.01"></path>
          <path d="M8 10h.01"></path>
          <path d="M8 14h.01"></path>
        </svg>
      </div>
      <div style="width: 2px; height: 12px; background: ${color}; margin: 0 auto;"></div>
    `,
    iconSize: [30, 42],
    iconAnchor: [15, 42]
  });
};

const BoundsController = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5 });
    }
  }, [bounds, map]);
  return null;
};

const MapRujukan = ({ 
  selectedProvinces = [], 
  selectedHospital = null,
  shiftingData = null
}) => {
  const [geoData, setGeoData] = useState(null);
  const [hospitalCoords, setHospitalCoords] = useState(null);
  const geoJsonRef = useRef();

  useEffect(() => {
    fetch('/data/indonesia-prov.geojson')
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error("Error loading geojson", err));
      
    fetch('/data/hospital_coords.json')
      .then(res => res.json())
      .then(data => setHospitalCoords(data))
      .catch(err => console.error("Error loading hospital coords", err));
  }, []);

  const { targetRsCoords, regionsData, bounds } = useMemo(() => {
    if (!geoData || !hospitalCoords || !selectedHospital) return { regionsData: [] };

    const targetCode = selectedHospital.value;
    const rData = [];
    
    let hLat = -2.5;
    let hLng = 118;
    let hasCoords = false;

    // Get hospital coords
    const hCoordsObj = hospitalCoords[targetCode];
    if (hCoordsObj) {
      hLat = hCoordsObj.lat;
      hLng = hCoordsObj.lng;
      hasCoords = true;
    } else if (geoData && selectedHospital.prop) {
      // Fallback: Use province center if coords are missing
      const hospProv = getGeoStateName(selectedHospital.prop);
      const provFeature = geoData.features.find(f => {
        const propName = f.properties.Propinsi || f.properties.NAME_1 || f.properties.state;
        return getGeoStateName(propName) === hospProv;
      });
      if (provFeature) {
        const center = getFeatureCenter(provFeature);
        if (center) {
          hLat = center[0];
          hLng = center[1];
          hasCoords = true;
        }
      }
    }
    
    let bnds = L.latLngBounds([hLat, hLng], [hLat, hLng]);

    geoData.features.forEach(f => {
      const propName = f.properties.Propinsi || f.properties.NAME_1 || f.properties.state;
      const stateName = getGeoStateName(propName);
      
      let aliases = [stateName.toUpperCase()];
      if (mapToDataKeys[stateName]) {
          aliases = mapToDataKeys[stateName];
      }

      // Check if ANY alias is selected
      const isExplicitlySelected = selectedProvinces.some(sp => aliases.includes(sp.value) || sp.value === stateName.toUpperCase());
      const isSelected = selectedProvinces.length === 0 || isExplicitlySelected;
      
      if (isSelected) {
        let totalKasus = 0;
        let totalIna = 0;
        
        if (shiftingData) {
            // Find which alias exists in shiftingData
            let originProvKey = null;
            for (const alias of aliases) {
                if (shiftingData[alias]) {
                    originProvKey = alias;
                    break;
                }
            }
            if (!originProvKey && shiftingData[stateName.toUpperCase()]) {
                originProvKey = stateName.toUpperCase();
            }

            if (originProvKey && shiftingData[originProvKey]) {
                for (const kab in shiftingData[originProvKey]) {
                  for (const kel in shiftingData[originProvKey][kab]) {
                    const shiftNode = shiftingData[originProvKey][kab][kel];
                    if (shiftNode.demandByRs && shiftNode.demandByRs[targetCode]) {
                      const byKlaim = shiftNode.demandByRs[targetCode].kasusByKlaim;
                      if (byKlaim) {
                        for (const komp in byKlaim) {
                          totalKasus += byKlaim[komp].kasus || 0;
                          totalIna += byKlaim[komp].inacbg || 0;
                        }
                      }
                    }
                  }
                }
            }
        } // close if (shiftingData)

        // Draw arrow if explicitly selected, OR if it has > 0 cases
        if (isExplicitlySelected || totalKasus > 0) {
          const center = getFeatureCenter(f);
          if (center) {
            bnds.extend(center);
            rData.push({
              feature: f,
              stateName,
              totalKasus,
              totalIna,
              center,
              curve: getBezierCurve(center[0], center[1], hLat, hLng)
            });
          }
        }
      }
    });

    return { targetRsCoords: [hLat, hLng], regionsData: rData, bounds: bnds };
  }, [geoData, hospitalCoords, selectedHospital, selectedProvinces, shiftingData]);

  const getFeatureStyle = (feature) => {
    const propName = feature.properties.Propinsi || feature.properties.NAME_1 || feature.properties.state;
    const stateName = getGeoStateName(propName);
    
    const isRegionWithCases = regionsData.some(r => r.stateName === stateName);
    
    if (isRegionWithCases) {
      return {
        fillColor: '#38bdf8',
        fillOpacity: 0.6,
        weight: 1.5,
        color: '#0284c7',
        dashArray: '0'
      };
    }
    
    return {
      fillColor: '#f1f5f9',
      fillOpacity: 0.5,
      weight: 1,
      color: '#cbd5e1',
      dashArray: '3'
    };
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '450px', background: '#f8fafc', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', zIndex: 0 }}>
      <MapContainer 
        center={[-2.5, 118]} 
        zoom={5} 
        style={{ height: '100%', width: '100%', background: '#e0f2fe' }} 
        zoomControl={false}
        attributionControl={false}
        preferCanvas={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
          opacity={0.8}
        />
        
        {geoData && (
          <GeoJSON 
            data={geoData} 
            style={getFeatureStyle}
            ref={geoJsonRef}
          />
        )}

        {targetRsCoords && (
          <Marker 
            position={targetRsCoords}
            icon={createHospitalIcon('#00B1A0')}
          >
            <Popup>
              <div style={{ fontFamily: 'Quattrocento Sans, sans-serif' }}>
                <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', fontSize: '14px', color: '#00B1A0' }}>{selectedHospital.label}</h4>
                <div style={{ fontSize: '12px', color: '#475569' }}>
                  Pusat rujukan dari region terpilih.
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {regionsData.map((r, i) => {
          // Arrow near the end
          const curveLen = r.curve.length;
          const arrowIdx = Math.floor(curveLen * 0.8);
          const p1 = r.curve[arrowIdx];
          const p2 = r.curve[arrowIdx + 1];
          
          return (
            <React.Fragment key={i}>
              <Polyline 
                positions={r.curve} 
                pathOptions={{ color: '#f97316', weight: 3, opacity: 0.8, dashArray: '5, 8' }} 
              />
              <Marker 
                position={p1} 
                icon={createArrowIcon(p1[0], p1[1], p2[0], p2[1], '#f97316')}
              />
              <Marker 
                position={r.center}
                icon={L.divIcon({
                  className: 'origin-marker',
                  html: `<div style="background: white; border: 2px solid #f97316; border-radius: 50%; width: 12px; height: 12px; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
                  iconSize: [12, 12],
                  iconAnchor: [6, 6]
                })}
              >
                <Popup>
                  <div style={{ fontFamily: 'Quattrocento Sans, sans-serif' }}>
                    <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', fontSize: '14px', color: '#0284c7' }}>{r.stateName}</h4>
                    <div style={{ fontSize: '12px', color: '#475569' }}>
                      Rujukan ke {selectedHospital.label}:<br/>
                      <strong>Kasus:</strong> {r.totalKasus.toLocaleString()}<br/>
                      <strong>Nilai INA-CBG:</strong> {formatCompactCurrency(r.totalIna)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        <BoundsController bounds={bounds} />
      </MapContainer>
    </div>
  );
};

export default MapRujukan;
