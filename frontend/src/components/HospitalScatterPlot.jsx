import React from 'react';
import { formatCompactCurrency, formatCurrency } from '../utils/formatters';
import PlotWithSave from './PlotWithSave';

const HospitalScatterPlot = ({ data, title }) => {
  const surplusData = data.filter(d => d.delta >= 0);
  const defisitData = data.filter(d => d.delta < 0);

  // Maximum value for drawing the reference line (y = x)
  const maxX = Math.max(...data.map(d => Number(d.inacbg) || 0), 0);
  const maxY = Math.max(...data.map(d => Number(d.simulasiVal) || 0), 0);
  const maxVal = Math.max(maxX, maxY);

  const surplusTrace = {
    x: surplusData.map(d => d.inacbg),
    y: surplusData.map(d => d.simulasiVal),
    text: surplusData.map(d => `<b>${d.nama}</b><br>${d.prop}<br>INA-CBG: ${formatCurrency(d.inacbg)}<br>Simulasi: ${formatCurrency(d.simulasiVal)}<br>Surplus: +${formatCurrency(d.delta)}`),
    mode: 'markers',
    type: 'scatter',
    name: 'Surplus',
    hoverinfo: 'text',
    marker: {
      color: '#28a745',
      size: 8,
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
    text: defisitData.map(d => `<b>${d.nama}</b><br>${d.prop}<br>INA-CBG: ${formatCurrency(d.inacbg)}<br>Simulasi: ${formatCurrency(d.simulasiVal)}<br>Defisit: ${formatCurrency(d.delta)}`),
    mode: 'markers',
    type: 'scatter',
    name: 'Defisit',
    hoverinfo: 'text',
    marker: {
      color: '#dc3545',
      size: 8,
      opacity: 0.6,
      line: {
        color: '#bd2130',
        width: 1
      }
    }
  };

  const referenceLine = {
    x: [0, maxVal],
    y: [0, maxVal],
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
      title: 'Tarif INA-CBG (Rp)',
      gridcolor: '#e2e8f0',
      zerolinecolor: '#cbd5e1'
    },
    yaxis: {
      title: 'Simulasi Tarif (Rp)',
      gridcolor: '#e2e8f0',
      zerolinecolor: '#cbd5e1'
    },
    legend: {
      orientation: 'h',
      y: -0.2
    }
  };

  return (
    <div className="glass-card" style={{ height: '100%', width: '100%', padding: '12px' }}>
      <PlotWithSave
        data={[surplusTrace, defisitTrace, referenceLine]}
        layout={{
          ...layout,
          paper_bgcolor: 'transparent',
          plot_bgcolor: '#ffffff'
        }}
        config={{ displayModeBar: false }}
        style={{ width: '100%', height: '100%' }}
        filename={title ? title.replace(/[^a-zA-Z0-9]/g, '_') : 'scatter_rs'}
        width={1400}
        height={800}
        useResizeHandler={true}
      />
    </div>
  );
};

export default HospitalScatterPlot;
