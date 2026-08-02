import React, { useMemo, useState } from 'react';
import Indonesia from '@react-map/indonesia';
import { formatCompactCurrency } from '../utils/formatters';

const normalizeProvince = (name) => {
  if (!name) return '';
  const n = name.toUpperCase();
  if (n.includes("JAKARTA")) return "Jakarta Raya";
  if (n.includes("YOGYAKARTA")) return "Yogyakarta";
  if (n.includes("BANGKA BELITUNG")) return "Bangka Belitung";
  
  // Title case conversion
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

// Color scale helper for Delta
const getDeltaColor = (deltaPercent) => {
  // We can use a simple scale:
  // Green for positive, Red for negative. The intensity depends on the value.
  if (deltaPercent === undefined || deltaPercent === null) return '#2c3e50';
  
  if (deltaPercent > 0) {
    if (deltaPercent > 20) return '#27ae60'; // strong green
    if (deltaPercent > 5) return '#2ecc71'; // normal green
    return '#a9dfbf'; // light green
  } else if (deltaPercent < 0) {
    if (deltaPercent < -20) return '#c0392b'; // strong red
    if (deltaPercent < -5) return '#e74c3c'; // normal red
    return '#f5b7b1'; // light red
  }
  return '#bdc3c7'; // zero/neutral
};

const IndonesiaMap = ({ data }) => {
  const [hoveredData, setHoveredData] = useState(null);

  // Mapped data structured for the map
  const { cityColors, mappedData } = useMemo(() => {
    const colors = {};
    const dataMap = {};
    
    data.forEach(region => {
      const stateCode = normalizeProvince(region.name);
      colors[stateCode] = getDeltaColor(region.deltaPercent);
      dataMap[stateCode] = region;
    });
    
    return { cityColors: colors, mappedData: dataMap };
  }, [data]);

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <h3 style={{ alignSelf: 'flex-start', margin: '0 0 16px 0' }}>Sebaran Dampak Finansial (Peta Indonesia)</h3>
      
      {/* Container for Map */}
      <div style={{ width: '100%', maxWidth: '900px', display: 'flex', justifyContent: 'center' }}>
        <Indonesia 
          type="select-single"
          size={800}
          mapColor="#34495e"
          strokeColor="#2c3e50"
          strokeWidth={1}
          hoverColor="#f1c40f" // highlight yellow on hover
          cityColors={cityColors}
          onSelect={(state) => {
            if (state && mappedData[state]) {
              setHoveredData(mappedData[state]);
            } else {
              setHoveredData(null);
            }
          }}
        />
      </div>
      
      {/* Legend / Hover Info */}
      <div style={{ 
        marginTop: '24px', 
        width: '100%', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid var(--glass-border)'
      }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <strong>Legenda:</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{width: 16, height: 16, background: '#c0392b', borderRadius: 4}}></div> Defisit Besar (&lt; -20%)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{width: 16, height: 16, background: '#e74c3c', borderRadius: 4}}></div> Defisit</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{width: 16, height: 16, background: '#a9dfbf', borderRadius: 4}}></div> Surplus Kecil</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{width: 16, height: 16, background: '#27ae60', borderRadius: 4}}></div> Surplus Besar (&gt; 20%)</div>
        </div>

        {hoveredData ? (
          <div style={{ textAlign: 'right' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: 'var(--primary-color)' }}>{hoveredData.name}</h4>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.9rem' }}>
              <span>Kasus: <strong>{hoveredData.kasus.toLocaleString()}</strong></span>
              <span>Delta: <strong style={{ color: hoveredData.delta > 0 ? 'var(--accent-success)' : 'var(--accent-danger)'}}>
                {hoveredData.delta > 0 ? '+' : ''}{formatCompactCurrency(hoveredData.delta)} ({hoveredData.deltaPercent.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})}%)
              </strong></span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
            Klik / Pilih provinsi pada peta untuk melihat detail
          </div>
        )}
      </div>
    </div>
  );
};

export default IndonesiaMap;
