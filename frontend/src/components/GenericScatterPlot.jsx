import React, { useState } from 'react';
import { formatCompactCurrency, formatCurrency } from '../utils/formatters';
import PlotWithSave from './PlotWithSave';
import { Maximize2, Minimize2 } from 'lucide-react';

/**
 * GenericScatterPlot
 * data: array of objects { label, inacbg, simulasiVal, delta, kasus (optional), extra (optional string) }
 */
const GenericScatterPlot = ({ data, title, xAxisTitle = 'Tarif INA-CBG (Rp)', yAxisTitle = 'Simulasi Tarif (Rp)' }) => {
  const [useLogScale, setUseLogScale] = useState(false);

  // Exclude data with <= 0 if using log scale to prevent Plotly errors
  const safeData = useLogScale 
    ? data.filter(d => d.inacbg > 0 && d.simulasiVal > 0)
    : data;

  const surplusData = safeData.filter(d => d.delta >= 0);
  const defisitData = safeData.filter(d => d.delta < 0);

  // Maximum value for drawing the reference line (y = x)
  const maxX = Math.max(...safeData.map(d => d.inacbg), 0);
  const maxY = Math.max(...safeData.map(d => d.simulasiVal), 0);
  const maxVal = Math.max(maxX, maxY);
  
  // Minimum value for log scale reference line
  const minX = Math.min(...safeData.filter(d => d.inacbg > 0).map(d => d.inacbg), maxVal);
  const minY = Math.min(...safeData.filter(d => d.simulasiVal > 0).map(d => d.simulasiVal), maxVal);
  const minVal = useLogScale ? Math.min(minX, minY) : 0;

  // Calculate Means
  const totalInacbg = safeData.reduce((acc, curr) => acc + curr.inacbg, 0);
  const totalSimulasi = safeData.reduce((acc, curr) => acc + curr.simulasiVal, 0);
  const totalKasus = safeData.reduce((acc, curr) => acc + (curr.kasus || 0), 0);
  const meanInacbg = totalKasus > 0 ? totalInacbg / totalKasus : 0;
  const meanSimulasi = totalKasus > 0 ? totalSimulasi / totalKasus : 0;

  const getMarkerSize = (kasus) => {
    if (!kasus) return 10;
    // Scale size logarithmically to prevent overlapping of huge markers
    return Math.max(10, Math.min(40, 5 + Math.log(kasus) * 2));
  };

  const getHoverText = (d) => `<b>${d.label}</b><br>${d.extra ? d.extra + '<br>' : ''}Kasus: ${d.kasus ? d.kasus.toLocaleString() : '-'}<br><br><b>Per Titik Data:</b><br>INA-CBG: ${formatCurrency(d.inacbg)}<br>Simulasi: ${formatCurrency(d.simulasiVal)}<br>${d.delta >= 0 ? 'Surplus' : 'Defisit'}: ${d.delta >= 0 ? '+' : ''}${formatCurrency(d.delta)}<br><br><b>Rata-rata (Keseluruhan):</b><br>Mean INA-CBG: ${formatCurrency(meanInacbg)}<br>Mean Simulasi: ${formatCurrency(meanSimulasi)}${d.topInacbgStr || ''}`;

  const surplusTrace = {
    x: surplusData.map(d => d.inacbg),
    y: surplusData.map(d => d.simulasiVal),
    text: surplusData.map(d => getHoverText(d)),
    mode: 'markers',
    type: 'scatter',
    name: 'Surplus',
    hoverinfo: 'text',
    marker: {
      color: '#28a745',
      size: surplusData.map(d => getMarkerSize(d.kasus)),
      opacity: 0.6,
      line: {
        color: '#1e7e34',
        width: 1
      }
    }
  };

  const defisitTrace = {
    x: defisitData.map(d => d.inacbg),
    y: defisitData.map(d => d.simulasiVal),
    text: defisitData.map(d => getHoverText(d)),
    mode: 'markers',
    type: 'scatter',
    name: 'Defisit',
    hoverinfo: 'text',
    marker: {
      color: '#dc3545',
      size: defisitData.map(d => getMarkerSize(d.kasus)),
      opacity: 0.6,
      line: {
        color: '#bd2130',
        width: 1
      }
    }
  };

  const referenceLine = {
    x: [minVal, maxVal],
    y: [minVal, maxVal],
    mode: 'lines',
    type: 'scatter',
    name: 'Titik Impas (Y=X)',
    hoverinfo: 'none',
    line: {
      color: '#6c757d',
      width: 1,
      dash: 'dash'
    }
  };

  const layout = {
    title: {
      text: title,
      font: { size: 14, color: '#333333' }
    },
    autosize: true,
    margin: { l: 60, r: 20, t: 40, b: 40 },
    hovermode: 'closest',
    plot_bgcolor: '#ffffff',
    paper_bgcolor: 'transparent',
    xaxis: {
      title: xAxisTitle,
      gridcolor: '#e2e8f0',
      zerolinecolor: '#cbd5e1',
      type: useLogScale ? 'log' : 'linear'
    },
    yaxis: {
      title: yAxisTitle,
      gridcolor: '#e2e8f0',
      zerolinecolor: '#cbd5e1',
      type: useLogScale ? 'log' : 'linear'
    },
    legend: {
      orientation: 'h',
      y: -0.2
    }
  };

  let annotations = [];
  if (safeData.length > 0) {
    const maxKasusData = safeData.reduce((prev, current) => {
      return ((prev.kasus || 0) > (current.kasus || 0)) ? prev : current;
    }, safeData[0]);

    if (maxKasusData && maxKasusData.kasus > 0) {
      // For plotly log axes, annotation coordinates need to be log10 of the value
      const annX = useLogScale ? Math.log10(maxKasusData.inacbg || 1) : maxKasusData.inacbg;
      const annY = useLogScale ? Math.log10(maxKasusData.simulasiVal || 1) : maxKasusData.simulasiVal;

      annotations.push({
        x: annX,
        y: annY,
        xref: 'x',
        yref: 'y',
        text: `<b>KASUS TERBANYAK</b><br>${maxKasusData.label}<br>Total Kasus: ${maxKasusData.kasus.toLocaleString()}`,
        showarrow: true,
        arrowhead: 2,
        arrowsize: 1,
        arrowwidth: 2,
        arrowcolor: '#34495e',
        ax: 0,
        ay: -60,
        font: { size: 11, color: '#fff' },
        bgcolor: '#34495e',
        bordercolor: '#2c3e50',
        borderwidth: 1,
        borderpad: 4,
        opacity: 0.95
      });
    }
  }

  layout.annotations = annotations;

  return (
    <div className="glass-card" style={{ height: '100%', width: '100%', padding: '12px', position: 'relative' }}>
      <button 
        onClick={() => setUseLogScale(!useLogScale)}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          background: useLogScale ? 'var(--accent-primary)' : '#fff',
          color: useLogScale ? '#fff' : 'var(--text-primary)',
          border: '1px solid var(--glass-border)',
          borderRadius: '20px',
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          transition: 'all 0.2s'
        }}
      >
        {useLogScale ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        {useLogScale ? 'Kembali ke Skala Normal' : 'Ratakan Sebaran (Skala Logaritmik)'}
      </button>

      <PlotWithSave
        data={[surplusTrace, defisitTrace, referenceLine]}
        layout={{
          ...layout,
          paper_bgcolor: 'transparent',
          plot_bgcolor: '#ffffff'
        }}
        config={{ displayModeBar: false }}
        style={{ width: '100%', height: '100%' }}
        filename={title ? title.replace(/[^a-zA-Z0-9]/g, '_') : 'scatter_plot'}
        width={1400}
        height={800}
        useResizeHandler={true}
      />
    </div>
  );
};

export default GenericScatterPlot;
