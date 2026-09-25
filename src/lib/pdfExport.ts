import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PDFExportOptions {
  title: string;
  formUrl?: string;
  sheetUrl?: string;
  totalResponses: number;
  aiAnalysisText?: string;
  summaryMetrics?: { label: string; value: string | number }[];
  elementIdToCapture?: string;
}

export async function exportReportToPDF(options: PDFExportOptions): Promise<void> {
  const {
    title,
    formUrl,
    sheetUrl,
    totalResponses,
    aiAnalysisText,
    summaryMetrics,
    elementIdToCapture,
  } = options;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let currentY = 20;

  // Header Banner
  doc.setFillColor(37, 99, 235); // Blue primary
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Laporan Hasil Form & Spreadsheet AI', margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Digenerate otomatis pada: ${new Date().toLocaleString('id-ID')}`, margin, 20);

  currentY = 38;

  // Title Box
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, margin, currentY);
  currentY += 8;

  // Meta info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Total Responden Terdata: ${totalResponses} orang`, margin, currentY);
  currentY += 6;

  if (sheetUrl) {
    doc.setTextColor(37, 99, 235);
    doc.text(`Tautan Google Sheet: ${sheetUrl}`, margin, currentY);
    currentY += 6;
  }
  if (formUrl) {
    doc.setTextColor(100, 116, 139);
    doc.text(`Tautan Google Form: ${formUrl}`, margin, currentY);
    currentY += 8;
  }

  // Key metrics cards
  if (summaryMetrics && summaryMetrics.length > 0) {
    const cardWidth = contentWidth / Math.min(summaryMetrics.length, 3) - 3;
    let cardX = margin;
    doc.setFont('helvetica', 'normal');

    summaryMetrics.slice(0, 3).forEach((m) => {
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(cardX, currentY, cardWidth, 18, 2, 2, 'F');
      
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(m.label, cardX + 4, currentY + 6);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(String(m.value), cardX + 4, currentY + 14);

      cardX += cardWidth + 4;
    });

    currentY += 26;
  }

  // Tangkap elemen chart visual jika ada
  if (elementIdToCapture) {
    const element = document.getElementById(elementIdToCapture);
    if (element) {
      try {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = contentWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (currentY + imgHeight > pageHeight - 30) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(30, 41, 59);
        doc.text('Visualisasi Grafis Analisis Jawaban', margin, currentY);
        currentY += 6;

        doc.addImage(imgData, 'PNG', margin, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 12;
      } catch (err) {
        console.error('Gagal mengambil screenshot chart:', err);
      }
    }
  }

  // AI Insights Section
  if (aiAnalysisText) {
    if (currentY > pageHeight - 50) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFillColor(238, 242, 255); // soft indigo
    doc.roundedRect(margin, currentY, contentWidth, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(67, 56, 202);
    doc.text('Analisis Cerdas & Rekomendasi (Gemini AI)', margin + 4, currentY + 7);
    currentY += 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    // Split text into lines that fit the page width
    const cleanText = aiAnalysisText.replace(/[*#]/g, '');
    const lines = doc.splitTextToSize(cleanText, contentWidth);

    lines.forEach((line: string) => {
      if (currentY > pageHeight - 16) {
        doc.addPage();
        currentY = 20;
      }
      doc.text(line, margin, currentY);
      currentY += 5;
    });
  }

  // Footer on all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Halaman ${i} dari ${pageCount} • Terintegrasi dengan Google Forms & Sheets`,
      margin,
      pageHeight - 8
    );
  }

  // Trigger download
  const filename = `Laporan_${title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
  doc.save(filename);
}
