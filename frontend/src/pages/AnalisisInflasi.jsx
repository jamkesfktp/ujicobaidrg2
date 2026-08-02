import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle, Info, Download } from 'lucide-react';
import DownloadExcelButton from '../components/DownloadExcelButton';
import { formatCurrency , formatTableMiliar} from '../utils/formatters';
import './AnalisisInflasi.css';

const AnalisisInflasi = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/data/comparison_result.json')
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load comparison data", err);
        setLoading(false);
      });
  }, []);

  const totalGapUser = data.reduce((acc, row) => acc + (row['Selisih Biaya'] || 0), 0);
  const totalInflatedCostD1 = data.reduce((acc, row) => acc + (row['Total Final COST (Unit Inflasi x Kasus Aplikasi Jan-Des)'] || 0), 0);
  const totalInflatedCostD2 = data.reduce((acc, row) => acc + (row['Total Final COST (Unit Inflasi x Kasus Aplikasi Okt-Mar)'] || 0), 0);
  const totalIdrgD1 = data.reduce((acc, row) => acc + (row['Biaya iDRG Baseline Aplikasi (Jan-Des)'] || 0), 0);
  const totalIdrgD2 = data.reduce((acc, row) => acc + (row['Biaya iDRG Baseline Aplikasi (Okt-Mar)'] || 0), 0);
  const totalInacbgD1 = data.reduce((acc, row) => acc + (row['Biaya INA-CBG Aplikasi (Jan-Des)'] || 0), 0);
  const totalInacbgD2 = data.reduce((acc, row) => acc + (row['Biaya INA-CBG Aplikasi (Okt-Mar)'] || 0), 0);



  return (
    <div className="analisis-container">
      <header className="page-header">
        <h1>Dashboard Analisis Inflasi & Unit Cost RS</h1>
        <p>Mempertahankan Kecukupan Tarif iDRG di Tengah Medical Inflation</p>
      </header>

      <div className="summary-cards">
        <div className="card glass-card">
          <h3>Total "Gap" Klaim RS (208 DRG)</h3>
          <p className="big-number highlight-danger">{formatCurrency(totalGapUser)}</p>
          <span className="subtitle">Berdasarkan Volume Data Awal</span>
        </div>
        <div className="card glass-card" style={{ borderTop: '4px solid #f59e0b' }}>
          <h3 style={{ color: '#b45309' }}>Total Pendapatan INA-CBG (Rp Miliar)</h3>
          <p className="big-number" style={{ color: '#b45309' }}>
            {formatCurrency(totalInacbgD1 + totalInacbgD2)}
          </p>
          <span className="subtitle">Aplikasi (Jan-Des + Okt-Mar)</span>
        </div>
        <div className="card glass-card" style={{ borderTop: '4px solid #0ea5e9' }}>
          <h3 style={{ color: '#0369a1' }}>Total Pendapatan iDRG (Rp Miliar)</h3>
          <p className="big-number" style={{ color: '#0369a1' }}>
            {formatCurrency(totalIdrgD1 + totalIdrgD2)}
          </p>
          <span className="subtitle">Aplikasi (Jan-Des + Okt-Mar)</span>
        </div>
        <div className="card glass-card">
          <h3>Total Selisih Cost Inflasi vs iDRG (Aplikasi)</h3>
          <p className="big-number highlight-warning">
            {formatCurrency((totalInflatedCostD1 + totalInflatedCostD2) - (totalIdrgD1 + totalIdrgD2))}
          </p>
          <span className="subtitle">Berdasarkan Volume Kasus Real (Aplikasi)</span>
        </div>
      </div>

      <div className="policy-brief-section">
        <h2>Policy Brief: Mempertahankan Tarif iDRG Saat Ini</h2>
        <div className="policy-grid">
          <div className="policy-item">
            <div className="icon">🏥</div>
            <h4>1. Efisiensi Operasional vs Inflasi</h4>
            <p>Unit Cost RS yang tinggi seringkali dipicu oleh inefisiensi pengadaan alkes & obat (HBR), bukan murni inflasi. Tarif iDRG Baseline saat ini sebenarnya mencukupi jika RS menerapkan kendali mutu & kendali biaya (managed care).</p>
          </div>
          <div className="policy-item">
            <div className="icon">⚖️</div>
            <h4>2. Prinsip Subsidi Silang (Cross-Subsidy)</h4>
            <p>Analisis pada ratusan DRG lain di aplikasi menunjukkan adanya surplus besar di kasus bedah/ringan. Defisit pada 208 DRG ini dapat tertutupi (cross-subsidized) secara agregat rumah sakit.</p>
          </div>
          <div className="policy-item">
            <div className="icon">📈</div>
            <h4>3. Mekanisme Adjustment / Top-Up</h4>
            <p>Daripada mengubah struktur dasar Tarif iDRG secara permanen, dampak inflasi khusus regional (Medical Inflation) sebaiknya diserap melalui skema <strong>Adjustment Factor</strong> atau <strong>Top-Up Terbatas</strong>.</p>
          </div>
        </div>
      </div>

      <div className="data-table-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>Detail Kesenjangan 208 DRG Prioritas</h2>
          {!loading && data.length > 0 && (
            <DownloadExcelButton 
              headers={["DRG Code", "Deskripsi", "Kasus (Aplikasi Jan-Des)", "Biaya iDRG Baseline (Jan-Des)", "Unit Cost Inflasi (Excel)", "Total Cost Inflasi (Jan-Des)", "Selisih (Inflasi vs iDRG)"]}
              data={data.map(row => [
                row.idrg, 
                row.deskripsi_idrg, 
                row['Kasus Aplikasi (Jan-Des)'] || 0,
                row['Biaya iDRG Baseline Aplikasi (Jan-Des)'] || 0,
                row['Unit Final COST Setelah di inflasikan (Sesuai Excel)'] || 0,
                row['Total Final COST (Unit Inflasi x Kasus Aplikasi Jan-Des)'] || 0,
                (row['Total Final COST (Unit Inflasi x Kasus Aplikasi Jan-Des)'] || 0) - (row['Biaya iDRG Baseline Aplikasi (Jan-Des)'] || 0)
              ])}
              filename="Analisis_Inflasi_208_DRG.xlsx"
            />
          )}
        </div>
        {loading ? (
          <div className="loading-spinner">Loading Data...</div>
        ) : (
          <div className="table-wrapper">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>DRG Code</th>
                  <th>Deskripsi</th>
                  <th>Kasus (Aplikasi Jan-Des)</th>
                  <th>Biaya iDRG Baseline (Jan-Des) (Rp Miliar)</th>
                  <th>Unit Cost Inflasi (Excel)</th>
                  <th>Total Cost Inflasi (Jan-Des)</th>
                  <th>Selisih (Inflasi vs iDRG) (Rp Miliar)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => {
                  const selisih = (row['Total Final COST (Unit Inflasi x Kasus Aplikasi Jan-Des)'] || 0) - (row['Biaya iDRG Baseline Aplikasi (Jan-Des)'] || 0);
                  return (
                    <tr key={idx}>
                      <td><span className="badge">{row.idrg}</span></td>
                      <td className="desc-col">{row.deskripsi_idrg}</td>
                      <td>{(row['Kasus Aplikasi (Jan-Des)'] || 0).toLocaleString('en-US')}</td>
                      <td>{formatTableMiliar(row['Biaya iDRG Baseline Aplikasi (Jan-Des)'])}</td>
                      <td>{formatTableMiliar(row['Unit Final COST Setelah di inflasikan (Sesuai Excel)'])}</td>
                      <td>{formatTableMiliar(row['Total Final COST (Unit Inflasi x Kasus Aplikasi Jan-Des)'])}</td>
                      <td className={selisih < 0 ? 'text-danger' : 'text-success'}>
                        {formatTableMiliar(selisih)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalisisInflasi;
