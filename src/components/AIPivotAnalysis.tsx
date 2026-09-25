import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import { AIPivotResult } from '../types/pivot';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Sparkles,
  Search,
  Table,
  BarChart2,
  TrendingUp,
  Lightbulb,
  Download,
  CheckCircle,
  HelpCircle,
  RotateCcw,
  Building2,
  PieChart,
  LineChart,
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface AIPivotAnalysisProps {
  sheetHeaders: string[];
  sheetRows: string[][];
  formTitle: string;
}

// Data Contoh Siap Pakai: Simulasi Penjualan Cabang sesuai skenario pertanyaan pengguna
export const SAMPLE_BRANCH_SALES_HEADERS = [
  'Tanggal',
  'Nama Cabang',
  'Kategori Produk',
  'Penjualan (Juta Rp)',
  'Jumlah Transaksi',
  'Skor Kepuasan Pelanggan (1-5)',
];

export const SAMPLE_BRANCH_SALES_ROWS = [
  ['2026-09-01', 'Cabang Jakarta Pusat', 'Elektronik & Gadget', '85', '142', '4.8'],
  ['2026-09-02', 'Cabang Jakarta Pusat', 'Aksesoris & Retail', '38', '95', '4.5'],
  ['2026-09-03', 'Cabang Surabaya Barat', 'Elektronik & Gadget', '62', '110', '4.2'],
  ['2026-09-04', 'Cabang Surabaya Barat', 'Aksesoris & Retail', '24', '70', '4.0'],
  ['2026-09-05', 'Cabang Bandung Kota', 'Elektronik & Gadget', '45', '88', '4.6'],
  ['2026-09-06', 'Cabang Bandung Kota', 'Aksesoris & Retail', '19', '55', '4.4'],
  ['2026-09-07', 'Cabang Medan Merdeka', 'Elektronik & Gadget', '52', '96', '3.9'],
  ['2026-09-08', 'Cabang Medan Merdeka', 'Aksesoris & Retail', '22', '60', '3.8'],
  ['2026-09-09', 'Cabang Bali Denpasar', 'Elektronik & Gadget', '70', '125', '4.7'],
  ['2026-09-10', 'Cabang Bali Denpasar', 'Aksesoris & Retail', '31', '80', '4.9'],
  ['2026-09-11', 'Cabang Jakarta Pusat', 'Elektronik & Gadget', '92', '150', '4.9'],
  ['2026-09-12', 'Cabang Surabaya Barat', 'Elektronik & Gadget', '58', '98', '4.1'],
  ['2026-09-13', 'Cabang Bandung Kota', 'Elektronik & Gadget', '48', '85', '4.5'],
  ['2026-09-14', 'Cabang Medan Merdeka', 'Elektronik & Gadget', '49', '90', '4.0'],
  ['2026-09-15', 'Cabang Bali Denpasar', 'Elektronik & Gadget', '75', '130', '4.8'],
];

const PRESET_QUERIES = [
  'Berapa total penjualan dan jumlah transaksi di setiap cabang?',
  'Tampilkan perbandingan penjualan per cabang dalam bentuk grafik dan peringkat cabang terbaik',
  'Berapa rata-rata skor kepuasan pelanggan per cabang dan identifikasi cabang yang perlu evaluasi',
  'Kelompokkan penjualan berdasarkan kategori produk di semua cabang',
];

export const AIPivotAnalysis: React.FC<AIPivotAnalysisProps> = ({
  sheetHeaders,
  sheetRows,
  formTitle,
}) => {
  const [activeDataSource, setActiveDataSource] = useState<'actual' | 'sample'>('actual');
  const [userQuery, setUserQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pivotResult, setPivotResult] = useState<AIPivotResult | null>(null);
  const [selectedChartType, setSelectedChartType] = useState<'bar' | 'line' | 'pie' | 'doughnut' | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Tentukan dataset mana yang aktif
  const hasActualData = sheetHeaders.length > 0 && sheetRows.length > 0;
  const currentHeaders =
    activeDataSource === 'actual' && hasActualData
      ? sheetHeaders
      : SAMPLE_BRANCH_SALES_HEADERS;
  const currentRows =
    activeDataSource === 'actual' && hasActualData
      ? sheetRows
      : SAMPLE_BRANCH_SALES_ROWS;
  const currentTitle =
    activeDataSource === 'actual' && hasActualData
      ? formTitle
      : 'Data Penjualan Multi-Cabang & Kepuasan Pelanggan';

  // Otomatis arahkan ke data sample jika belum ada respon riil
  useEffect(() => {
    if (!hasActualData) {
      setActiveDataSource('sample');
    }
  }, [hasActualData]);

  // Eksekusi Query AI Pivot
  const handleRunQuery = async (queryText?: string) => {
    const q = queryText || userQuery;
    if (!q.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/pivot-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userQuery: q,
          headers: currentHeaders,
          rows: currentRows,
          formTitle: currentTitle,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Gagal memproses analisis');
      }

      const json = await res.json();
      if (json.data) {
        setPivotResult(json.data);
        setSelectedChartType(json.data.chartConfig.chartType || 'bar');
      }
    } catch (err: any) {
      alert(`Error analisis AI: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Ekspor Khusus PDF Laporan Pimpinan
  const handleExportExecutivePDF = async () => {
    if (!pivotResult) return;
    setIsExportingPDF(true);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      let currentY = 18;

      // Header Banner
      doc.setFillColor(30, 41, 59); // Slate 800 dark
      doc.rect(0, 0, pageWidth, 26, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('LAPORAN EKSEKUTIF PIMPINAN • AI PIVOT & ANALISIS', margin, 11);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(203, 213, 225);
      doc.text(
        `Waktu Pembuatan: ${new Date().toLocaleString('id-ID')} | Sumber: ${currentTitle}`,
        margin,
        19
      );

      currentY = 34;

      // Judul Analisis
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(pivotResult.queryTitle, margin, currentY);
      currentY += 6;

      // Permintaan Pengguna
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Pertanyaan / Instruksi: "${userQuery || 'Analisis Data Terpilih'}"`, margin, currentY);
      currentY += 6;

      // Penjelasan Metodologi
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const explLines = doc.splitTextToSize(pivotResult.explanation, contentWidth);
      doc.text(explLines, margin, currentY);
      currentY += explLines.length * 4.5 + 4;

      // Tangkap Grafik Visual jika ada
      const chartElement = document.getElementById('ai-pivot-chart-container');
      if (chartElement) {
        try {
          const canvas = await html2canvas(chartElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
          });
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = contentWidth;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          if (currentY + imgHeight > pageHeight - 35) {
            doc.addPage();
            currentY = 18;
          }

          doc.addImage(imgData, 'PNG', margin, currentY, imgWidth, imgHeight);
          currentY += imgHeight + 8;
        } catch (e) {
          console.error('Error capturing chart:', e);
        }
      }

      // Render Tabel Pivot
      if (currentY > pageHeight - 60) {
        doc.addPage();
        currentY = 18;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text('Tabel Hasil Pivot Agregasi Data', margin, currentY);
      currentY += 5;

      const cols = pivotResult.pivotTable.columns;
      const rows = pivotResult.pivotTable.rows;
      const colWidth = contentWidth / cols.length;

      // Table Header Row
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, currentY, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);

      cols.forEach((col, i) => {
        doc.text(col, margin + i * colWidth + 2, currentY + 5);
      });
      currentY += 8;

      // Table Data Rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);

      rows.forEach((row, rIdx) => {
        if (currentY > pageHeight - 20) {
          doc.addPage();
          currentY = 18;
        }
        if (rIdx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, currentY - 1, contentWidth, 6, 'F');
        }
        row.forEach((val, cIdx) => {
          doc.text(String(val), margin + cIdx * colWidth + 2, currentY + 3.5);
        });
        currentY += 6;
      });

      // Total Row jika ada
      if (pivotResult.pivotTable.totalRow) {
        doc.setFillColor(226, 232, 240);
        doc.rect(margin, currentY - 1, contentWidth, 7, 'F');
        doc.setFont('helvetica', 'bold');
        pivotResult.pivotTable.totalRow.forEach((val, cIdx) => {
          doc.text(String(val), margin + cIdx * colWidth + 2, currentY + 4);
        });
        currentY += 10;
      } else {
        currentY += 5;
      }

      // Rekomendasi Keputusan Pimpinan
      if (currentY > pageHeight - 55) {
        doc.addPage();
        currentY = 18;
      }

      doc.setFillColor(238, 242, 255); // soft indigo
      doc.roundedRect(margin, currentY, contentWidth, 8, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(67, 56, 202);
      doc.text('Saran & Rekomendasi Keputusan Strategis untuk Pimpinan', margin + 3, currentY + 5.5);
      currentY += 12;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);

      pivotResult.decisionRecommendations.forEach((rec, idx) => {
        if (currentY > pageHeight - 18) {
          doc.addPage();
          currentY = 18;
        }
        const bulletText = `${idx + 1}. ${rec}`;
        const recLines = doc.splitTextToSize(bulletText, contentWidth - 4);
        doc.text(recLines, margin + 2, currentY);
        currentY += recLines.length * 4.5 + 2;
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Dokumen Keputusan Bisnis • Halaman ${p} dari ${pageCount} • FormToSheet AI Intelligence`,
          margin,
          pageHeight - 8
        );
      }

      doc.save(`Laporan_Pimpinan_${Date.now()}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Gagal mengekspor PDF');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Setup data grafik
  const chartTypeToRender = selectedChartType || pivotResult?.chartConfig.chartType || 'bar';
  const chartData = {
    labels: pivotResult?.chartConfig.labels || [],
    datasets: [
      {
        label: pivotResult?.chartConfig.datasetLabel || 'Nilai',
        data: pivotResult?.chartConfig.dataValues || [],
        backgroundColor: [
          'rgba(59, 130, 246, 0.85)',
          'rgba(16, 185, 129, 0.85)',
          'rgba(245, 158, 11, 0.85)',
          'rgba(139, 92, 246, 0.85)',
          'rgba(236, 72, 153, 0.85)',
          'rgba(20, 184, 166, 0.85)',
          'rgba(249, 115, 22, 0.85)',
        ],
        borderColor: [
          '#2563eb',
          '#059669',
          '#d97706',
          '#7c3aed',
          '#db2777',
          '#0d9488',
          '#ea580c',
        ],
        borderWidth: 1.5,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: chartTypeToRender === 'pie' || chartTypeToRender === 'doughnut',
        position: 'bottom' as const,
      },
      title: {
        display: true,
        text: pivotResult?.chartConfig.chartTitle || '',
        font: { size: 13, weight: 'bold' as const },
        color: '#1e293b',
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Box Pencarian / Instruksi Natural Language */}
      <div className="bg-linear-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-lg border border-indigo-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                Tanya Data AI (Pivot Tabel & Grafis Kapanpun)
              </h2>
              <p className="text-xs text-indigo-200">
                Ketikkan pertanyaan apa saja untuk pimpinan, AI akan otomatis mengolah tabel pivot, grafik, dan saran keputusan.
              </p>
            </div>
          </div>

          {/* Pemilih Sumber Data (Data Asli vs Data Contoh Penjualan Cabang) */}
          <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl text-xs self-start sm:self-center">
            {hasActualData && (
              <button
                type="button"
                onClick={() => setActiveDataSource('actual')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  activeDataSource === 'actual'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-indigo-200 hover:text-white'
                }`}
              >
                Sheet Aktif ({sheetRows.length} baris)
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setActiveDataSource('sample');
                setUserQuery('Berapa total penjualan dalam satu cabang dan perbandingannya?');
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 ${
                activeDataSource === 'sample'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Data Contoh Penjualan Cabang
            </button>
          </div>
        </div>

        {/* Input Bar */}
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Cth: Pimpinan mau berapa penjualan dalam satu cabang dan cabang mana tertinggi?"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 text-white placeholder-slate-400 border border-white/20 focus:outline-hidden focus:ring-2 focus:ring-indigo-400 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleRunQuery();
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => handleRunQuery()}
            disabled={isLoading || !userQuery.trim()}
            className="px-6 py-3 bg-linear-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Mengolah Data...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Proses Analisis</span>
              </>
            )}
          </button>
        </div>

        {/* Rekomendasi Pertanyaan Cepat */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="text-[11px] font-medium text-indigo-300 mb-2 flex items-center gap-1">
            <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
            Klik contoh permintaan analisis pimpinan di bawah ini:
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_QUERIES.map((pq, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setUserQuery(pq);
                  handleRunQuery(pq);
                }}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-indigo-100 border border-white/10 transition-colors text-left disabled:opacity-50"
              >
                {pq}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tampilan Hasil Analisis Pivot & Keputusan */}
      {pivotResult ? (
        <div className="space-y-6 animate-fade-in">
          {/* Header Hasil */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                  Hasil Pivot & AI
                </span>
                <h3 className="text-base font-bold text-slate-800">
                  {pivotResult.queryTitle}
                </h3>
              </div>
              <p className="text-xs text-slate-600 max-w-2xl">
                {pivotResult.explanation}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExecutivePDF}
                disabled={isExportingPDF}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {isExportingPDF ? 'Mengekspor PDF...' : 'Ekspor Laporan Pimpinan (PDF)'}
              </button>
            </div>
          </div>

          {/* Grid: Tabel Pivot & Grafik */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bagian 1: Tabel Pivot Teragregasi */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Table className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-bold text-slate-800">
                      Tabel Pivot Agregasi
                    </h4>
                  </div>
                  <span className="text-xs text-slate-400">
                    {pivotResult.pivotTable.rows.length} Baris Hasil
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        {pivotResult.pivotTable.columns.map((col, cIdx) => (
                          <th key={cIdx} className="py-2.5 px-3 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pivotResult.pivotTable.rows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="hover:bg-blue-50/40 transition-colors text-slate-700 font-medium"
                        >
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="py-2 px-3 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    {pivotResult.pivotTable.totalRow && (
                      <tfoot>
                        <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                          {pivotResult.pivotTable.totalRow.map((tot, tIdx) => (
                            <td key={tIdx} className="py-2.5 px-3 whitespace-nowrap">
                              {tot}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                Data diringkas dan dikelompokkan otomatis berdasarkan perintah Anda.
              </div>
            </div>

            {/* Bagian 2: Grafik Visual Dinamis */}
            <div
              id="ai-pivot-chart-container"
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-sm font-bold text-slate-800">
                      Visualisasi Grafis
                    </h4>
                  </div>

                  {/* Switcher Tipe Chart Cepat */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setSelectedChartType('bar')}
                      className={`px-2 py-1 text-[11px] rounded font-medium ${
                        chartTypeToRender === 'bar' ? 'bg-white shadow-2xs text-blue-600' : 'text-slate-500'
                      }`}
                      title="Diagram Batang"
                    >
                      Batang
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedChartType('line')}
                      className={`px-2 py-1 text-[11px] rounded font-medium ${
                        chartTypeToRender === 'line' ? 'bg-white shadow-2xs text-blue-600' : 'text-slate-500'
                      }`}
                      title="Grafik Garis"
                    >
                      Garis
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedChartType('pie')}
                      className={`px-2 py-1 text-[11px] rounded font-medium ${
                        chartTypeToRender === 'pie' ? 'bg-white shadow-2xs text-blue-600' : 'text-slate-500'
                      }`}
                      title="Diagram Lingkaran"
                    >
                      Pie
                    </button>
                  </div>
                </div>

                <div className="h-64 relative w-full flex items-center justify-center">
                  {chartTypeToRender === 'bar' && <Bar data={chartData} options={chartOptions} />}
                  {chartTypeToRender === 'line' && <Line data={chartData} options={chartOptions} />}
                  {chartTypeToRender === 'pie' && <Pie data={chartData} options={chartOptions} />}
                  {chartTypeToRender === 'doughnut' && (
                    <Doughnut data={chartData} options={chartOptions} />
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Grafik interaktif menyesuaikan otomatis</span>
                <span className="font-semibold text-slate-600">
                  {pivotResult.chartConfig.datasetLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Bagian 3: Temuan Utama & Saran Keputusan untuk Pimpinan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Temuan Utama */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">
                  Fakta & Temuan Kunci
                </h4>
              </div>
              <ul className="space-y-2.5">
                {pivotResult.keyFindings.map((finding, fIdx) => (
                  <li key={fIdx} className="flex items-start gap-2.5 text-xs text-slate-700">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{finding}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Saran Keputusan untuk Pimpinan */}
            <div className="bg-linear-to-br from-indigo-50/80 via-white to-purple-50/80 p-5 rounded-2xl border border-indigo-200 shadow-xs">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-indigo-100">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Saran & Rekomendasi Keputusan Pimpinan
                  </h4>
                  <p className="text-[11px] text-indigo-700">
                    Langkah strategis yang dapat segera diputuskan dan dieksekusi
                  </p>
                </div>
              </div>
              <ul className="space-y-3">
                {pivotResult.decisionRecommendations.map((rec, rIdx) => (
                  <li
                    key={rIdx}
                    className="p-2.5 rounded-xl bg-white border border-indigo-100 shadow-2xs flex items-start gap-2.5 text-xs text-slate-800"
                  >
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                      {rIdx + 1}
                    </span>
                    <span className="leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State / Panduan Awal */
        <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
          <Building2 className="w-12 h-12 mx-auto text-indigo-400" />
          <h4 className="text-base font-bold text-slate-800">
            Siap Menjawab Pertanyaan Analisis & Pivot Kapan Saja
          </h4>
          <p className="text-xs text-slate-500 max-w-lg mx-auto">
            Ketik permintaan data pimpinan pada kotak di atas atau klik salah satu contoh pertanyaan untuk melihat tabel agregasi otomatis, grafik visual, dan rekomendasi keputusannya.
          </p>
        </div>
      )}
    </div>
  );
};
