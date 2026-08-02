import React, { useState } from 'react';
import { Presentation } from 'lucide-react';
import { exportToPPTX } from '../utils/exportPptx';

const DownloadPptxButton = ({ title, disabled = false }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (disabled || isExporting) return;
    setIsExporting(true);
    
    try {
      await exportToPPTX(title);
    } catch (err) {
      console.error("Gagal mengekspor PPTX", err);
      alert("Terjadi kesalahan saat mengekspor ke PPTX.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button 
      onClick={handleExport}
      disabled={disabled || isExporting}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        backgroundColor: '#f59e0b',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontWeight: '600',
        cursor: (disabled || isExporting) ? 'not-allowed' : 'pointer',
        opacity: (disabled || isExporting) ? 0.7 : 1,
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)'
      }}
      onMouseOver={(e) => {
        if (!disabled && !isExporting) e.currentTarget.style.backgroundColor = '#d97706';
      }}
      onMouseOut={(e) => {
        if (!disabled && !isExporting) e.currentTarget.style.backgroundColor = '#f59e0b';
      }}
    >
      <Presentation size={18} />
      {isExporting ? 'Mengekspor...' : 'Export PPTX'}
    </button>
  );
};

export default DownloadPptxButton;
