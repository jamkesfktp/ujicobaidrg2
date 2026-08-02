import pptxgen from "pptxgenjs";
import html2canvas from "html2canvas";

/**
 * Utility to export charts and tables to Google Slides (PPTX format).
 * It automatically scans the current page for elements with specific classes.
 * 
 * @param {string} title - Title of the presentation
 */
export const exportToPPTX = async (title) => {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';
  
  // Title slide
  let slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addText(title, {
    x: 0, y: 2.2, w: "100%", h: 1, 
    fontSize: 32, bold: true, color: "0284c7", align: "center", fontFace: "Quattrocento Sans"
  });
  slide.addText("Diekspor otomatis dari Dasbor iDRG", {
    x: 0, y: 3.2, w: "100%", h: 0.5, 
    fontSize: 14, color: "64748b", align: "center", fontFace: "Quattrocento Sans"
  });

  // Find all elements marked for export
  // Charts: <div className="export-pptx-chart" data-title="Chart Title">
  // Charts: <div className="export-pptx-chart" data-title="Chart Title" data-rs-name="RS Name">
  const charts = Array.from(document.querySelectorAll('.export-pptx-chart'));
  
  for (const domEl of charts) {
    try {
      const elTitle = domEl.getAttribute('data-title') || 'Grafik';
      const rsName = domEl.getAttribute('data-rs-name');
      const displayTitle = rsName ? `${elTitle} - ${rsName}` : elTitle;
      
      // Temporarily expand height for capture if it's scrollable, or just capture as is
      const canvas = await html2canvas(domEl, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL("image/png");
      
      let chartSlide = pptx.addSlide();
      chartSlide.addText(displayTitle, {
        x: 0.5, y: 0.3, w: "90%", h: 0.5, fontSize: 16, bold: true, color: "333333", fontFace: "Quattrocento Sans"
      });
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgWidth / imgHeight;
      
      let targetW = 9;
      let targetH = 9 / ratio;
      if (targetH > 4.5) {
        targetH = 4.5;
        targetW = 4.5 * ratio;
      }
      
      const targetX = (10 - targetW) / 2;
      const targetY = (5.625 - targetH) / 2 + 0.3;

      chartSlide.addImage({
        data: imgData,
        x: targetX, y: targetY, w: targetW, h: targetH
      });
    } catch (e) {
      console.error(`Gagal mengekstrak chart`, e);
    }
  }

  // Tables: <table id="some-id" className="export-pptx-table" data-title="Table Title">
  const tables = Array.from(document.querySelectorAll('.export-pptx-table'));
  for (const tableEl of tables) {
    let tableId = tableEl.id;
    if (!tableId) {
      tableId = `pptx-table-${Math.random().toString(36).substr(2, 9)}`;
      tableEl.id = tableId;
    }
    
    const elTitle = tableEl.getAttribute('data-title') || 'Tabel';
    
    // Check if table has more than 10 data rows
    const tbody = tableEl.querySelector('tbody');
    const rowCount = tbody ? tbody.querySelectorAll('tr').length : 0;
    
    // Calculate proportional column widths from the original table's first body row
    let colW = [];
    const firstBodyRow = tbody ? tbody.querySelector('tr') : null;
    if (firstBodyRow) {
      const tds = Array.from(firstBodyRow.children);
      const totalWidth = tds.reduce((sum, td) => sum + (td.offsetWidth || 0), 0);
      if (totalWidth > 0) {
        colW = tds.map(td => ((td.offsetWidth || 0) / totalWidth) * 9.0);
      }
    }
    
    const colCount = colW.length > 0 ? colW.length : (firstBodyRow ? firstBodyRow.children.length : 8);
    const isManyCols = colCount > 8;
    
    const applyStyles = (tbl) => {
      // 1. Headers (thead)
      const thead = tbl.querySelector('thead');
      if (thead) {
        thead.querySelectorAll('th, td').forEach(cell => {
          cell.style.fontFamily = 'Quattrocento Sans, Arial, sans-serif';
          cell.style.fontSize = isManyCols ? '8pt' : '10pt';
          cell.style.fontWeight = 'bold';
          cell.style.backgroundColor = '#0F172A';
          cell.style.color = '#FFFFFF';
          cell.style.border = '1px solid #334155';
          cell.style.padding = '4px';
          cell.style.textAlign = 'center';
          cell.style.verticalAlign = 'middle';
        });
      }
      
      // 2. Body (zebra shading)
      const tBody = tbl.querySelector('tbody');
      if (tBody) {
        tBody.querySelectorAll('tr').forEach((tr, i) => {
          const isZebra = i % 2 === 1;
          tr.querySelectorAll('td, th').forEach(cell => {
            cell.style.fontFamily = 'Quattrocento Sans, Arial, sans-serif';
            cell.style.fontSize = isManyCols ? '8pt' : '10pt';
            cell.style.backgroundColor = isZebra ? '#F8FAFC' : '#FFFFFF';
            cell.style.color = '#334155';
            cell.style.border = '1px solid #E2E8F0';
            cell.style.padding = '4px';
            // keep existing text-align if inline, else default
            if (!cell.style.textAlign) {
              const text = cell.innerText.trim();
              const isNumeric = /^[0-9.,%Rp -]+$/.test(text);
              cell.style.textAlign = isNumeric ? 'right' : 'left';
            }
          });
        });
      }
      
      // 3. Footer (tfoot)
      const tfoot = tbl.querySelector('tfoot');
      if (tfoot) {
        tfoot.querySelectorAll('tr').forEach(tr => {
          tr.querySelectorAll('td, th').forEach(cell => {
            cell.style.fontFamily = 'Quattrocento Sans, Arial, sans-serif';
            cell.style.fontSize = isManyCols ? '8pt' : '10pt';
            cell.style.fontWeight = 'bold';
            cell.style.backgroundColor = '#F1F5F9';
            cell.style.color = '#0F172A';
            cell.style.border = '1px solid #CBD5E1';
            cell.style.padding = '4px';
          });
        });
      }
    };
    
    // Shared tableToSlides options
    const tableOptions = {
      x: 0.5, y: 1.0, w: 9.0, h: 4.0, 
      autoPage: true, autoPageRepeatHeader: true,
      autoPageCharWeight: -0.2
    };
    
    if (colW.length > 0) {
      tableOptions.colW = colW;
    }
    
    if (rowCount > 10) {
      // 1. Export Top 10
      const clone10 = tableEl.cloneNode(true);
      clone10.id = tableId + '_top10';
      const clone10Tbody = clone10.querySelector('tbody');
      const allRows10 = Array.from(clone10Tbody.querySelectorAll('tr'));
      allRows10.slice(10).forEach(r => r.remove()); // remove rows after 10
      applyStyles(clone10);
      document.body.appendChild(clone10);
      clone10.style.display = 'none';
      
      pptx.defineSlideMaster({
        title: `MASTER_${clone10.id}`,
        background: { color: "FFFFFF" },
        objects: [
          { text: { text: `${elTitle} (Top 10)`, options: { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 16, bold: true, color: "0f172a", fontFace: "Quattrocento Sans" } } }
        ]
      });
      
      try {
        tableOptions.masterSlideName = `MASTER_${clone10.id}`;
        pptx.tableToSlides(clone10.id, tableOptions);
      } catch (e) { console.error('Gagal mengekstrak top 10 tabel', e); }
      
      clone10.remove();
      
      // 2. Export Full
      const cloneFull = tableEl.cloneNode(true);
      cloneFull.id = tableId + '_full';
      applyStyles(cloneFull);
      document.body.appendChild(cloneFull);
      cloneFull.style.display = 'none';
      
      pptx.defineSlideMaster({
        title: `MASTER_${cloneFull.id}`,
        background: { color: "FFFFFF" },
        objects: [
          { text: { text: `${elTitle} (Semua Data)`, options: { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 16, bold: true, color: "0f172a", fontFace: "Quattrocento Sans" } } }
        ]
      });
      
      try {
        tableOptions.masterSlideName = `MASTER_${cloneFull.id}`;
        pptx.tableToSlides(cloneFull.id, tableOptions);
      } catch (e) { console.error('Gagal mengekstrak tabel penuh', e); }
      
      cloneFull.remove();
      
    } else {
      // Just export normally
      const cloneNorm = tableEl.cloneNode(true);
      cloneNorm.id = tableId + '_norm';
      applyStyles(cloneNorm);
      document.body.appendChild(cloneNorm);
      cloneNorm.style.display = 'none';
      
      pptx.defineSlideMaster({
        title: `MASTER_${cloneNorm.id}`,
        background: { color: "FFFFFF" },
        objects: [
          { text: { text: elTitle, options: { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 16, bold: true, color: "0f172a", fontFace: "Quattrocento Sans" } } }
        ]
      });
      
      try {
        tableOptions.masterSlideName = `MASTER_${cloneNorm.id}`;
        pptx.tableToSlides(cloneNorm.id, tableOptions);
      } catch (e) {
        console.error('Gagal mengekstrak tabel', e);
      }
      
      cloneNorm.remove();
    }
  }

  pptx.writeFile({ fileName: `${title.replace(/[\s\/]+/g, '_')}.pptx` });
};

/**
 * Export specific map and data container to PPTX.
 * @param {string} title 
 */
export const exportMapRegionToPPTX = async (title, options = {}) => {
  try {
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';

    // Title slide
    let slide1 = pptx.addSlide();
    slide1.background = { color: "FFFFFF" };
    slide1.addText(title, {
      x: 0, y: 2.2, w: "100%", h: 1, 
      fontSize: 32, bold: true, color: "0284c7", align: "center", fontFace: "Quattrocento Sans"
    });
    slide1.addText("Laporan Peta & Profil RS Diekspor otomatis dari Dasbor iDRG", {
      x: 0, y: 3.2, w: "100%", h: 0.5, 
      fontSize: 14, color: "64748b", align: "center", fontFace: "Quattrocento Sans"
    });

    const mapDom = document.getElementById('export-map-container');
    const dataDom = document.getElementById('export-data-container');
    const regionProfileDom = document.getElementById('export-region-profile');
    const hiddenProfilesDom = document.getElementById('export-hidden-profiles');

    if (mapDom) {
      const canvasMap = await html2canvas(mapDom, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' });

      const imgMap = canvasMap.toDataURL("image/png");
      let slide2 = pptx.addSlide();
      slide2.addText(`Peta Sebaran: ${title}`, {
        x: 0.5, y: 0.3, w: "90%", h: 0.5, fontSize: 16, bold: true, color: "333333", fontFace: "Quattrocento Sans"
      });
      const ratio = canvasMap.width / canvasMap.height;
      let targetH = 4.5;
      let targetW = 4.5 * ratio;
      if (targetW > 9) {
          targetW = 9;
          targetH = 9 / ratio;
      }
      slide2.addImage({ data: imgMap, x: (10 - targetW)/2, y: (5.625 - targetH)/2 + 0.3, w: targetW, h: targetH });
    }

    if (dataDom) {
      // Temporary style adjustments to prevent scroll capture cutoff
      const origMaxHeight = dataDom.style.maxHeight;
      const origOverflow = dataDom.style.overflow;
      const scrollableDiv = dataDom.querySelector('[style*="overflow-y"], [style*="overflowY"]');
      let scrollOrigMaxHeight = '';
      if (scrollableDiv) {
        scrollOrigMaxHeight = scrollableDiv.style.maxHeight;
        scrollableDiv.style.maxHeight = 'none';
        scrollableDiv.style.overflowY = 'visible';
      }

      const canvasData = await html2canvas(dataDom, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvasData.toDataURL("image/png");
      
      // Restore styles
      if (scrollableDiv) {
        scrollableDiv.style.maxHeight = scrollOrigMaxHeight;
        scrollableDiv.style.overflowY = 'auto';
      }

      let slide3 = pptx.addSlide();
      slide3.addText(`Rincian Data: ${title}`, {
        x: 0.5, y: 0.3, w: "90%", h: 0.5, fontSize: 16, bold: true, color: "333333", fontFace: "Quattrocento Sans"
      });
      const ratio = canvasData.width / canvasData.height;
      let targetH = 4.5;
      let targetW = 4.5 * ratio;
      if (targetW > 9) {
          targetW = 9;
          targetH = 9 / ratio;
      }
      if (targetH > 4.5) { // If it's too tall
          targetH = 4.5;
          targetW = 4.5 * ratio;
      }
      slide3.addImage({ data: imgData, x: (10 - targetW)/2, y: (5.625 - targetH)/2 + 0.3, w: targetW, h: targetH });
    }

    if (options.type === 'native') {
      // --- NATIVE REGIONAL PROFILE SLIDE ---
      if (options.regionalData) {
        const rData = options.regionalData;
        let slideReg = pptx.addSlide();
        slideReg.addText(`Detail Regional: ${title}`, {
          x: 0.5, y: 0.5, w: 9, h: 0.8, fontSize: 24, bold: true, color: "0284c7"
        });

        // Metrik Utama Regional
        slideReg.addText(`Metrik Utama Regional`, {
          x: 0.5, y: 1.5, w: 9, h: 0.5, fontSize: 18, bold: true, color: "333333"
        });
        
        const selisih = (rData.sim || 0) - (rData.inacbg || 0);
        const formatRp = (val) => val >= 1e12 ? `${(val/1e12).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})} T` : val >= 1e9 ? `${(val/1e9).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})} M` : val.toLocaleString('en-US');
        
        slideReg.addTable([
          [{ text: "Total Kasus", options: { bold: true, fill: "f8fafc" } }, { text: "Pendapatan Eksisting", options: { bold: true, fill: "f8fafc" } }, { text: "Potensi iDRG", options: { bold: true, fill: "f8fafc" } }, { text: "Selisih Pendapatan", options: { bold: true, fill: "f8fafc" } }],
          [
            `${(rData.kasus || 0).toLocaleString('en-US')} Kasus`, 
            `Rp ${formatRp(rData.inacbg || 0)}`, 
            `Rp ${formatRp(rData.sim || 0)}`, 
            `Rp ${formatRp(selisih)}`
          ]
        ], { x: 0.5, y: 2.1, w: 9, colW: [2, 2.3, 2.3, 2.4], border: { pt: 1, color: "e2e8f0" }, align: "center", valign: "middle", fontSize: 14 });
      }

      // --- NATIVE RS PROFILES SLIDES ---
      if (options.topHospitals && options.topHospitals.length > 0) {
        options.topHospitals.forEach(rs => {
          const simVal = rs.sim || 0;
          const incVal = rs.inacbg || 0;
          const selVal = simVal - incVal;
          const formatRp = (val) => val >= 1e12 ? `${(val/1e12).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})} T` : val >= 1e9 ? `${(val/1e9).toLocaleString('id-ID', {minimumFractionDigits: 2, maximumFractionDigits: 2})} M` : val.toLocaleString('en-US');

          const services = rs.byKelompok ? Object.entries(rs.byKelompok).sort((a,b) => b[1].kasus - a[1].kasus) : [];
          const chunkSize = 8; // Adjust to fit the slide height safely
          
          if (services.length === 0) {
             let slideRS = pptx.addSlide();
             slideRS.addText(`Profil RS: ${rs.nama} (${title})`, { x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 20, bold: true, color: "0284c7" });
             slideRS.addText(`Kelas ${rs.kelas || '-'} | Kompetensi: ${rs.faskesKomp || '-'}`, { x: 0.5, y: 1.1, w: 9, h: 0.4, fontSize: 14, color: "64748b" });
             slideRS.addTable([
               [{ text: "Total Kasus", options: { bold: true, fill: "f8fafc" } }, { text: "Pendapatan Eksisting", options: { bold: true, fill: "f8fafc" } }, { text: "Potensi iDRG", options: { bold: true, fill: "f8fafc" } }, { text: "Selisih Pendapatan", options: { bold: true, fill: "f8fafc" } }],
               [`${(rs.kasus || 0).toLocaleString('en-US')} Kasus`, `Rp ${formatRp(incVal)}`, `Rp ${formatRp(simVal)}`, `Rp ${formatRp(selVal)}`]
             ], { x: 0.5, y: 1.6, w: 9, colW: [2, 2.3, 2.3, 2.4], border: { pt: 1, color: "e2e8f0" }, align: "center", valign: "middle", fontSize: 12 });
             return;
          }

          for (let i = 0; i < services.length; i += chunkSize) {
            const chunk = services.slice(i, i + chunkSize);
            let slideRS = pptx.addSlide();
            slideRS.addText(`Profil RS: ${rs.nama} (${title}) ${i > 0 ? '(Lanjutan)' : ''}`, {
              x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 20, bold: true, color: "0284c7"
            });
            slideRS.addText(`Kelas ${rs.kelas || '-'} | Kompetensi: ${rs.faskesKomp || '-'}`, {
              x: 0.5, y: 1.1, w: 9, h: 0.4, fontSize: 14, color: "64748b"
            });

            let startYForTable = 1.6;

            if (i === 0) {
              slideRS.addTable([
                [{ text: "Total Kasus", options: { bold: true, fill: "f8fafc" } }, { text: "Pendapatan Eksisting", options: { bold: true, fill: "f8fafc" } }, { text: "Potensi iDRG", options: { bold: true, fill: "f8fafc" } }, { text: "Selisih Pendapatan", options: { bold: true, fill: "f8fafc" } }],
                [`${(rs.kasus || 0).toLocaleString('en-US')} Kasus`, `Rp ${formatRp(incVal)}`, `Rp ${formatRp(simVal)}`, `Rp ${formatRp(selVal)}`]
              ], { x: 0.5, y: 1.6, w: 9, colW: [2, 2.3, 2.3, 2.4], border: { pt: 1, color: "e2e8f0" }, align: "center", valign: "middle", fontSize: 12 });
              
              slideRS.addText(`Rincian Pendapatan per Kelompok Layanan`, {
                x: 0.5, y: 2.6, w: 9, h: 0.4, fontSize: 14, bold: true, color: "333333"
              });
              startYForTable = 3.1;
            } else {
              slideRS.addText(`Rincian Pendapatan per Kelompok Layanan (Lanjutan)`, {
                x: 0.5, y: 1.6, w: 9, h: 0.4, fontSize: 14, bold: true, color: "333333"
              });
              startYForTable = 2.1;
            }

            const tableData = [
              [
                { text: "Layanan", options: { bold: true, fill: "f1f5f9" } },
                { text: "Kasus", options: { bold: true, fill: "f1f5f9" } },
                { text: "Eksisting", options: { bold: true, fill: "f1f5f9" } },
                { text: "Potensi iDRG", options: { bold: true, fill: "f1f5f9" } }
              ]
            ];

            chunk.forEach(([kelompok, kData]) => {
               tableData.push([
                 kelompok,
                 kData.kasus.toLocaleString('en-US'),
                 `Rp ${formatRp(kData.inacbg || 0)}`,
                 `Rp ${formatRp(kData.sim || 0)}`
               ]);
            });

            slideRS.addTable(tableData, { x: 0.5, y: startYForTable, w: 9, colW: [3, 1.5, 2.25, 2.25], border: { pt: 1, color: "e2e8f0" }, align: "center", valign: "middle", fontSize: 10 });
          }
        });
      }
    } else {
      // --- LEGACY IMAGE EXPORT FOR PROFILES (If not native) ---
      if (regionProfileDom) {
        const canvasReg = await html2canvas(regionProfileDom, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgReg = canvasReg.toDataURL("image/png");
        let slideReg = pptx.addSlide();
        slideReg.addText(`Profil Wilayah: ${title}`, {
          x: 0.5, y: 0.3, w: "90%", h: 0.5, fontSize: 16, bold: true, color: "333333", fontFace: "Quattrocento Sans"
        });
        const ratio = canvasReg.width / canvasReg.height;
        let targetH = 4.5;
        let targetW = 4.5 * ratio;
        if (targetW > 9) { targetW = 9; targetH = 9 / ratio; }
        if (targetH > 4.5) { targetH = 4.5; targetW = 4.5 * ratio; }
        slideReg.addImage({ data: imgReg, x: (10 - targetW)/2, y: (5.625 - targetH)/2 + 0.3, w: targetW, h: targetH });
      }

      if (hiddenProfilesDom) {
        const children = Array.from(hiddenProfilesDom.children);
        for (const child of children) {
          child.style.display = 'block';
          const canvasChild = await html2canvas(child, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
          const imgChild = canvasChild.toDataURL("image/png");
          
          let slideRS = pptx.addSlide();
          const rsName = child.getAttribute('data-rs-name');
          const slideTitle = rsName ? `Profil RS: ${rsName} (${title})` : `Profil RS (${title})`;
          slideRS.addText(slideTitle, {
            x: 0.5, y: 0.3, w: "90%", h: 0.5, fontSize: 16, bold: true, color: "333333", fontFace: "Quattrocento Sans"
          });
          const ratio = canvasChild.width / canvasChild.height;
          let targetH = 4.5;
          let targetW = 4.5 * ratio;
          if (targetW > 9) { targetW = 9; targetH = 9 / ratio; }
          if (targetH > 4.5) { targetH = 4.5; targetW = 4.5 * ratio; }
          slideRS.addImage({ data: imgChild, x: (10 - targetW)/2, y: (5.625 - targetH)/2 + 0.3, w: targetW, h: targetH });
        }
      }
    }

    pptx.writeFile({ fileName: `Ekspor_${title.replace(/[\s\/]+/g, '_')}.pptx` });
    return true;
  } catch (err) {
    console.error("Export PPT Map Failed", err);
    throw err;
  }
};
