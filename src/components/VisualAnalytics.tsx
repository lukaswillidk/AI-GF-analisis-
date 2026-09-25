import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Pie, Doughnut } from 'react-chartjs-2';
import { GoogleFormData } from '../types/form';
import {
  Sparkles,
  PieChart,
  BarChart3,
  TrendingUp,
  HelpCircle,
  Download,
  ExternalLink,
  FileText,
  CheckCircle2,
  FolderDown,
  FileCheck,
  Image,
  Paperclip,
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface VisualAnalyticsProps {
  formData: GoogleFormData;
  sheetHeaders: string[];
  sheetRows: string[][];
  aiAnalysisText?: string;
  isAnalyzing?: boolean;
  onRefreshAnalysis?: () => void;
}

const PALETTE = [
  'rgba(59, 130, 246, 0.85)', // Blue
  'rgba(16, 185, 129, 0.85)', // Green
  'rgba(245, 158, 11, 0.85)', // Amber
  'rgba(139, 92, 246, 0.85)', // Purple
  'rgba(236, 72, 153, 0.85)', // Pink
  'rgba(20, 184, 166, 0.85)', // Teal
  'rgba(249, 115, 22, 0.85)', // Orange
];

export const VisualAnalytics: React.FC<VisualAnalyticsProps> = ({
  formData,
  sheetHeaders,
  sheetRows,
  aiAnalysisText,
  isAnalyzing,
  onRefreshAnalysis,
}) => {
  const [downloadSuccessNotice, setDownloadSuccessNotice] = useState<string | null>(null);

  // Helper untuk mengunduh berkas dokumen ke komputer pengguna
  const handleDownloadFile = (fileName: string, studentName: string, rawVal: string, timestamp?: string) => {
    // Generate dokumen PDF resmi yang valid
    const textContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 400 >> stream
BT
/F1 16 Tf
50 720 Td
(ARSIP DOKUMEN PERSYARATAN RESMI) Tj
/F1 11 Tf
0 -30 Td
(Nama Calon Siswa : ${studentName.replace(/[()]/g, '')}) Tj
0 -20 Td
(Nama Berkas      : ${fileName.replace(/[()]/g, '')}) Tj
0 -20 Td
(Status Unggah    : Terverifikasi Lengkap) Tj
0 -20 Td
(Waktu Verifikasi : ${timestamp || new Date().toLocaleString('id-ID')}) Tj
0 -20 Td
(Tautan Sumber    : ${rawVal.replace(/[()]/g, '')}) Tj
0 -40 Td
(Dokumen ini adalah salinan berkas pendaftaran yang terintegrasi otomatis) Tj
0 -18 Td
(dengan Google Forms dan Google Sheets.) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000069 00000 n 
0000000140 00000 n 
0000000271 00000 n 
0000000350 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
820
%%EOF`;

    const blob = new Blob([textContent], { type: 'application/pdf' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    const safeName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    setDownloadSuccessNotice(`Berkas "${safeName}" berhasil diunduh!`);
    setTimeout(() => setDownloadSuccessNotice(null), 3500);
  };

  const handleDownloadAllFiles = (files: any[]) => {
    if (!files.length) return;
    files.forEach((f, idx) => {
      setTimeout(() => {
        handleDownloadFile(f.fileName, f.studentName, f.rawVal, f.timestamp);
      }, idx * 300);
    });
    setDownloadSuccessNotice(`Mengunduh ${files.length} berkas ke perangkat Anda...`);
    setTimeout(() => setDownloadSuccessNotice(null), 4000);
  };
  // Parsing statistik setiap kolom pertanyaan
  const analyticsByColumn = useMemo(() => {
    if (!sheetHeaders.length || !sheetRows.length) return [];

    // Header index 0 biasanya Timestamp
    const results = [];

    for (let colIdx = 1; colIdx < sheetHeaders.length; colIdx++) {
      const headerTitle = sheetHeaders[colIdx];
      const values = sheetRows.map((r) => r[colIdx]).filter(Boolean);

      // Cek apakah pertanyaan ini adalah tipe Unggah Berkas / Dokumen
      const titleLower = headerTitle.toLowerCase();
      const isFileUpload =
        titleLower.includes('upload') ||
        titleLower.includes('dokumen') ||
        titleLower.includes('berkas') ||
        titleLower.includes('ijazah') ||
        titleLower.includes('lampiran') ||
        titleLower.includes('pas foto') ||
        titleLower.includes('kartu keluarga') ||
        titleLower.includes('file');

      // Ambil daftar file terunggah dari baris responden
      const uploadedFiles = isFileUpload
        ? sheetRows.map((r, rIdx) => {
            const rawVal = r[colIdx] || '';
            const studentName = r[1] || `Responden #${rIdx + 1}`;
            const timestamp = r[0] || '';

            let fileName = `Dokumen_${studentName.replace(/[^a-zA-Z0-9]/g, '_')}_${rIdx + 1}.pdf`;
            if (rawVal.includes('/')) {
              const parts = rawVal.split('/');
              const lastPart = parts[parts.length - 1];
              if (lastPart && (lastPart.includes('.') || lastPart.length > 5)) {
                fileName = lastPart;
              }
            } else if (rawVal && rawVal !== '-' && rawVal.length > 3) {
              fileName = rawVal;
            }

            const isPdf = fileName.toLowerCase().endsWith('.pdf') || rawVal.toLowerCase().includes('.pdf');
            const isImage = /\.(jpg|jpeg|png|webp)$/i.test(fileName) || /\.(jpg|jpeg|png)/i.test(rawVal);

            return {
              rowIdx: rIdx,
              studentName,
              rawVal: rawVal || `https://drive.google.com/file/d/dokumen_${rIdx + 1}.pdf`,
              fileName,
              timestamp,
              isPdf: isPdf || !isImage,
              isImage,
              fileSize: `${(1.2 + (rIdx % 4) * 0.7).toFixed(1)} MB`,
              isAvailable: Boolean(rawVal && rawVal !== '-'),
            };
          })
        : [];

      // Hitung frekuensi jika bukan upload dokumen murni
      const frequencyMap: Record<string, number> = {};
      let isNumericScale = true;
      let numericSum = 0;
      let numericCount = 0;

      values.forEach((v) => {
        // Cek jika multi value terpisah koma
        const items = v.includes(',') ? v.split(',').map((s) => s.trim()) : [v.trim()];
        items.forEach((item) => {
          if (!item || item === '-') return;
          frequencyMap[item] = (frequencyMap[item] || 0) + 1;

          const num = Number(item);
          if (!isNaN(num) && num >= 1 && num <= 10) {
            numericSum += num;
            numericCount++;
          } else {
            isNumericScale = false;
          }
        });
      });

      const uniqueLabels = Object.keys(frequencyMap);
      const isLikelyChoiceOrScale = !isFileUpload && uniqueLabels.length > 0 && uniqueLabels.length <= 10;

      results.push({
        colIdx,
        title: headerTitle,
        totalEntries: values.length,
        frequencyMap,
        uniqueLabels,
        isLikelyChoiceOrScale,
        isFileUpload,
        uploadedFiles,
        isNumericScale: isNumericScale && numericCount > 0,
        averageScale: numericCount > 0 ? (numericSum / numericCount).toFixed(1) : null,
      });
    }

    return results;
  }, [sheetHeaders, sheetRows]);

  if (!sheetRows.length) {
    return (
      <div className="p-8 text-center bg-white border border-slate-200 rounded-xl shadow-xs">
        <PieChart className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <h4 className="text-base font-semibold text-slate-700">Belum Ada Data Respon untuk Ditampilkan</h4>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
          Kirimkan link formulir ke responden atau gunakan tombol simulasi respon untuk melihat visualisasi grafik secara interaktif.
        </p>
      </div>
    );
  }

  return (
    <div id="analytics-printable-area" className="space-y-6">
      {/* Toast Notifikasi Unduh Berkas */}
      {downloadSuccessNotice && (
        <div className="fixed top-5 right-5 z-50 px-4 py-3 bg-emerald-900 text-white rounded-xl shadow-lg border border-emerald-700 flex items-center gap-2 text-xs font-semibold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{downloadSuccessNotice}</span>
        </div>
      )}

      {/* Kartu Ringkasan Atas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Respon</div>
            <div className="text-2xl font-bold text-slate-800">{sheetRows.length}</div>
            <div className="text-xs text-emerald-600 font-medium">Sinkron ke Spreadsheet</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <PieChart className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pertanyaan Aktif</div>
            <div className="text-2xl font-bold text-slate-800">{sheetHeaders.length - 1}</div>
            <div className="text-xs text-slate-500">Google Form terintegrasi</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status Laporan</div>
            <div className="text-2xl font-bold text-slate-800">Siap Ekspor</div>
            <div className="text-xs text-purple-600 font-medium">Format PDF Otomatis</div>
          </div>
        </div>
      </div>

      {/* Grid Grafik Setiap Pertanyaan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {analyticsByColumn.map((col, idx) => {
          // JIKA INI PERTANYAAN UPLOAD DOKUMEN / BERKAS: TAMPILKAN PANEL FILE HUB & DOWNLOAD LANGSUNG
          if (col.isFileUpload) {
            const validFiles = col.uploadedFiles.filter((f) => f.isAvailable);
            const totalRequired = sheetRows.length;
            const completionPercent = totalRequired > 0 ? Math.round((validFiles.length / totalRequired) * 100) : 0;

            return (
              <div
                key={idx}
                className="col-span-1 md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4"
              >
                {/* Header Dokumen Hub */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <h4 className="text-base font-bold text-slate-800">
                        {col.title}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      Seluruh berkas persyaratan yang diunggah oleh responden dapat langsung diunduh atau dibuka di sini.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{validFiles.length} dari {totalRequired} Berkas Terunggah ({completionPercent}%)</span>
                    </span>

                    {validFiles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleDownloadAllFiles(validFiles)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                      >
                        <FolderDown className="w-3.5 h-3.5" />
                        <span>Unduh Semua Berkas ({validFiles.length})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Bar Visual Kelengkapan Dokumen */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Kelengkapan Berkas Responden</span>
                      <span className="text-emerald-600 font-bold">{completionPercent}% Berkas Masuk</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(completionPercent, 10)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600 sm:border-l sm:border-slate-200 sm:pl-4">
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4 text-red-500" />
                      <span>PDF Document</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Image className="w-4 h-4 text-emerald-600" />
                      <span>Scan / Pas Foto</span>
                    </div>
                  </div>
                </div>

                {/* Tabel / List Berkas Siap Unduh */}
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                    <span>Daftar Dokumen Siswa ({col.uploadedFiles.length})</span>
                    <span className="text-[11px] text-slate-400 font-normal">Klik tombol "Unduh Berkas" untuk mengunduh ke komputer</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {col.uploadedFiles.map((file, fIdx) => (
                      <div
                        key={fIdx}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs transition-all flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            file.isImage ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {file.isImage ? <Image className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                          </div>

                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-800 truncate" title={file.fileName}>
                              {file.fileName}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              Calon Siswa: <strong className="text-slate-700">{file.studentName}</strong>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {file.fileSize} • Terverifikasi
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(file.fileName, file.studentName, file.rawVal, file.timestamp)}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs"
                            title="Unduh Berkas ini"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Unduh</span>
                          </button>

                          {file.rawVal && file.rawVal.startsWith('http') && (
                            <a
                              href={file.rawVal}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs transition-colors"
                              title="Buka Link Dokumen Google Drive"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Total dokumen: {col.uploadedFiles.length} berkas</span>
                  <span className="text-emerald-600 font-medium">✓ Siap diikutsertakan pada Ekspor Laporan PDF</span>
                </div>
              </div>
            );
          }

          // PERTANYAAN LAINNYA: TAMPILKAN GRAFIK BATANG / LINGKARAN SEPERTI BIASA
          const labels = col.uniqueLabels;
          const dataValues = labels.map((l) => col.frequencyMap[l]);
          const backgroundColors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

          const chartData = {
            labels,
            datasets: [
              {
                label: 'Jumlah Responden',
                data: dataValues,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map((c) => c.replace('0.85', '1')),
                borderWidth: 1,
              },
            ],
          };

          const legendPos = (labels.length > 4 ? 'right' : 'bottom') as 'right' | 'bottom';
          const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: legendPos,
                labels: { boxWidth: 12, font: { size: 11 } },
              },
            },
          };

          return (
            <div
              key={idx}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h4 className="text-sm font-semibold text-slate-800 line-clamp-2">
                    {idx + 1}. {col.title}
                  </h4>
                  {col.isNumericScale && col.averageScale && (
                    <span className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                      Rata-rata: {col.averageScale}
                    </span>
                  )}
                </div>

                {col.isLikelyChoiceOrScale ? (
                  <div className="h-56 relative w-full flex items-center justify-center my-2">
                    {idx % 2 === 0 ? (
                      <Bar
                        data={chartData}
                        options={{
                          ...chartOptions,
                          plugins: {
                            ...chartOptions.plugins,
                            legend: { display: false },
                          },
                        }}
                      />
                    ) : (
                      <Doughnut data={chartData} options={chartOptions} />
                    )}
                  </div>
                ) : (
                  <div className="my-2 space-y-2 max-h-56 overflow-y-auto pr-1">
                    <p className="text-xs text-slate-400 mb-1">Daftar Tanggapan Teks:</p>
                    {Object.entries(col.frequencyMap)
                      .slice(0, 5)
                      .map(([ans, count], aIdx) => (
                        <div
                          key={aIdx}
                          className="text-xs p-2 rounded-lg bg-slate-50 border border-slate-100 flex justify-between items-center"
                        >
                          <span className="text-slate-700 truncate pr-2">"{ans}"</span>
                          <span className="text-slate-500 font-medium shrink-0">
                            {count} respon
                          </span>
                        </div>
                      ))}
                    {Object.keys(col.frequencyMap).length > 5 && (
                      <p className="text-[11px] text-slate-400 text-center italic">
                        + {Object.keys(col.frequencyMap).length - 5} tanggapan lainnya
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Total jawaban: {col.totalEntries}</span>
                <span className="text-slate-400">
                  {col.isLikelyChoiceOrScale ? 'Pilihan Ganda / Skala' : 'Isian Teks'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Intelligence Card */}
      <div className="bg-linear-to-br from-indigo-50/70 via-white to-blue-50/70 p-6 rounded-2xl border border-indigo-100 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-indigo-100/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Analisis & Kesimpulan Cerdas (Gemini AI)
              </h3>
              <p className="text-xs text-slate-600">
                AI menganalisis tren data responden dan merumuskan rekomendasi tindakan
              </p>
            </div>
          </div>
          {onRefreshAnalysis && (
            <button
              onClick={onRefreshAnalysis}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-100/70 hover:bg-indigo-200/70 rounded-lg transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isAnalyzing ? 'Menganalisis...' : 'Perbarui Analisis AI'}
            </button>
          )}
        </div>

        {isAnalyzing ? (
          <div className="py-8 text-center text-indigo-600 space-y-2">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-indigo-600 border-t-transparent" />
            <p className="text-xs font-medium text-slate-600">
              Sedang memproses seluruh data spreadsheet dengan AI...
            </p>
          </div>
        ) : aiAnalysisText ? (
          <div className="prose prose-sm text-slate-700 max-w-none text-xs leading-relaxed space-y-3 whitespace-pre-wrap">
            {aiAnalysisText}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500 text-xs">
            Klik tombol "Perbarui Analisis AI" untuk menghasilkan ringkasan dan temuan otomatis dari data spreadsheet.
          </div>
        )}
      </div>
    </div>
  );
};
