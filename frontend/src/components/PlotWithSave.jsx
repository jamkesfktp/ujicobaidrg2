import React from 'react';
import PlotlyChart from 'react-plotly.js';
const Plot = PlotlyChart.default || PlotlyChart;
import { ImageDown } from 'lucide-react';

/**
 * PlotWithSave
 * Wrapper Plotly dengan tombol "Simpan PNG".
 *
 * Saat menyimpan PNG:
 *   - Latar selalu PUTIH (bukan transparan)
 *   - Warna teks/sumbu disesuaikan agar terbaca di atas putih
 *   - exportTitle ditambahkan ke PNG (tidak tampil di layar)
 *   - Tampilan layar TIDAK diubah sama sekali
 *
 * Props:
 *   data          – Plotly traces array
 *   layout        – Plotly layout untuk tampilan layar
 *   config        – Plotly config (opsional)
 *   style         – style untuk elemen Plot
 *   containerStyle– style untuk div pembungkus
 *   filename      – nama file PNG tanpa ekstensi
 *   exportTitle   – judul yang HANYA muncul di PNG (gunakan <br> untuk baris baru)
 *   width         – lebar PNG (default 1200)
 *   height        – tinggi PNG (default 700)
 *   useResizeHandler
 */
const PlotWithSave = ({
  data,
  layout = {},
  config = {},
  style = {},
  containerStyle = {},
  filename = 'grafik',
  exportTitle,
  width = 1200,
  height = 700,
  useResizeHandler = true,
}) => {

  const handleSavePNG = () => {
    // Bangun layout khusus ekspor: latar putih + judul lengkap
    // Layout layar TIDAK disentuh sama sekali
    const hasExportTitle = !!exportTitle;
    const topMargin = hasExportTitle
      ? Math.max((layout.margin?.t ?? 40) + 70, 110)
      : Math.max(layout.margin?.t ?? 40, 60);

    const exportLayout = {
      ...layout,
      // Latar selalu putih di PNG
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
      // Font jadi gelap agar terbaca di putih
      font: { ...(layout.font ?? {}), color: '#1e293b' },
      // Margin cukup agar judul dan label tidak terpotong
      margin: {
        l: layout.margin?.l ?? 80,
        r: layout.margin?.r ?? 60,
        t: topMargin,
        b: Math.max(layout.margin?.b ?? 60, 80),
      },
      // Sumbu X
      xaxis: {
        ...(layout.xaxis ?? {}),
        color: '#1e293b',
        tickfont: { ...(layout.xaxis?.tickfont ?? {}), color: '#475569' },
        titlefont: { ...(layout.xaxis?.titlefont ?? {}), color: '#1e293b' },
        gridcolor: '#e2e8f0',
      },
      // Sumbu Y
      yaxis: {
        ...(layout.yaxis ?? {}),
        color: '#1e293b',
        tickfont: { ...(layout.yaxis?.tickfont ?? {}), color: '#475569' },
        titlefont: { ...(layout.yaxis?.titlefont ?? {}), color: '#1e293b' },
        gridcolor: '#e2e8f0',
      },
      // Legenda
      legend: {
        ...(layout.legend ?? {}),
        bgcolor: '#ffffff',
        font: { ...(layout.legend?.font ?? {}), color: '#1e293b' },
      },
    };

    // Tambahkan exportTitle ke PNG (menggantikan / melengkapi title layout)
    if (hasExportTitle) {
      exportLayout.title = {
        text: exportTitle,
        font: { size: 16, color: '#1e293b' },
        x: 0.5,
        xanchor: 'center',
        y: 0.99,
        yanchor: 'top',
      };
    } else if (layout.title) {
      // Pastikan title layout asli juga pakai warna gelap
      exportLayout.title = {
        ...(typeof layout.title === 'string'
          ? { text: layout.title }
          : layout.title),
        font: {
          ...(typeof layout.title === 'object' ? (layout.title.font ?? {}) : {}),
          color: '#1e293b',
        },
      };
    }

    // Kirim figure object langsung ke Plotly.toImage
    // → tidak menyentuh chart yang sedang tampil di layar
    window.Plotly.toImage(
      { data, layout: exportLayout },
      { format: 'png', width, height, scale: 2 }
    )
      .then(dataUrl => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${filename}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      })
      .catch(err => console.error('Gagal menyimpan PNG:', err));
  };

  const mergedConfig = {
    responsive: true,
    displayModeBar: false,
    displaylogo: false,
    ...config,
    displayModeBar: false,
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...containerStyle }}>
      {/* Tombol Simpan PNG */}
      <button
        onClick={handleSavePNG}
        title="Simpan sebagai PNG (latar putih, judul lengkap)"
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '5px 10px',
          background: 'rgba(255,255,255,0.92)',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#1e40af',
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          transition: 'background 0.15s, border-color 0.15s',
          backdropFilter: 'blur(4px)',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = '#e0f2fe';
          e.currentTarget.style.borderColor = '#0284c7';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.92)';
          e.currentTarget.style.borderColor = '#cbd5e1';
        }}
      >
        <ImageDown size={13} />
        Simpan PNG
      </button>

      <Plot
        data={data}
        layout={layout}
        config={mergedConfig}
        style={{ width: '100%', height: '100%', ...style }}
        useResizeHandler={useResizeHandler}
      />
    </div>
  );
};

export default PlotWithSave;
