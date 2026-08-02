import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { exportToExcel } from '../utils/exportExcel';

const DownloadExcelButton = ({ headers, data, filename, customExportFn, groupHeaders }) => {
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState('');

  const handleConfirm = async () => {
    setShowModal(false);
    if (customExportFn) {
      await customExportFn(password);
    } else {
      exportToExcel(headers, data, filename || 'Data_Export.xlsx', password, groupHeaders || null);
    }
    setPassword('');
  };

  const handleCancel = () => {
    setShowModal(false);
    setPassword('');
  };

  const [copied, setCopied] = useState(false);

  const handleCopyTable = (e) => {
    let current = e.currentTarget;
    let table = null;
    while (current && current !== document.body) {
      table = current.parentElement.querySelector('table');
      if (table) break;
      current = current.parentElement;
    }

    if (!table) {
      alert("Tabel tidak ditemukan untuk disalin.");
      return;
    }

    // Clone table to modify it without affecting the UI
    const clone = table.cloneNode(true);
    
    // Google Slides friendly base styles
    clone.style.fontFamily = 'Arial, sans-serif';
    clone.style.fontSize = '10pt';
    clone.style.borderCollapse = 'collapse';
    clone.style.width = '100%';
    clone.style.color = '#333333';

    // Apply inline styles to all headers
    const ths = clone.querySelectorAll('th');
    ths.forEach(th => {
      th.style.border = '1px solid #e2e8f0';
      th.style.padding = '6px 8px';
      th.style.backgroundColor = '#f4f7f6';
      th.style.fontWeight = 'bold';
      th.style.textAlign = 'left';
      if (!th.style.color) th.style.color = '#333333';
    });

    // Apply inline styles to all cells
    const tds = clone.querySelectorAll('td');
    tds.forEach(td => {
      td.style.border = '1px solid #e2e8f0';
      td.style.padding = '6px 8px';
      if (!td.style.color) td.style.color = '#333333';
    });

    const html = clone.outerHTML;
    const blob = new Blob([html], { type: 'text/html' });
    try {
      const clipboardItem = new window.ClipboardItem({ 'text/html': blob });
      navigator.clipboard.write([clipboardItem]).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } catch (err) {
      console.error('Clipboard write failed:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = table.innerText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      <button 
        onClick={handleCopyTable}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          borderRadius: '6px',
          background: copied ? '#e6f6f3' : '#ffffff',
          color: copied ? 'var(--accent-primary, #00B1A0)' : '#475569',
          border: '1px solid ' + (copied ? 'var(--accent-primary, #00B1A0)' : '#cbd5e1'),
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: '500',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          transition: 'all 0.2s'
        }}
        title="Copy tabel untuk dipaste ke Google Slide / Word / Excel"
      >
        {copied ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Tersalin!
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy Tabel
          </>
        )}
      </button>

      <button 
        onClick={() => setShowModal(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: '6px',
          background: 'var(--accent-primary, #00B1A0)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: '500',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        <Download size={16} />
        Download Excel
      </button>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '24px',
            width: '420px',
            maxWidth: '90%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: '600' }}>Proteksi File Excel</h3>
              <button 
                onClick={handleCancel} 
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '4px'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
              >
                <X size={20} />
              </button>
            </div>
            
            <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '20px', lineHeight: '1.5' }}>
              Anda dapat mengunci file Excel ini dengan password (Opsional). Kosongkan kolom di bawah jika tidak perlu perlindungan password.
            </p>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>
                Password File Excel
              </label>
              <input 
                type="password"
                placeholder="Masukkan password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.95rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#00B1A0'}
                onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm();
                }}
                autoFocus
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={handleCancel}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                onMouseOut={(e) => e.currentTarget.style.background = '#f8fafc'}
              >
                Batal
              </button>
              <button 
                onClick={handleConfirm}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  background: '#00B1A0',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#0d655d'}
                onMouseOut={(e) => e.currentTarget.style.background = '#00B1A0'}
              >
                <Download size={16} />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadExcelButton;
