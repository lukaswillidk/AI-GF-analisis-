import express, { Request, Response } from 'express';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Helper to call Gemini with multi-model fallback and strict timeout
async function generateWithFallback(params: {
  contents: string;
  config?: any;
  timeoutMs?: number;
}) {
  if (!ai) throw new Error('GEMINI_API_KEY is not configured');

  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  const timeoutMs = params.timeoutMs || 6000;
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const callPromise = ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout calling model ${model} after ${timeoutMs}ms`)), timeoutMs)
      );

      const response: any = await Promise.race([callPromise, timeoutPromise]);
      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      console.warn(`Model ${model} attempt failed:`, err.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error('All AI models failed or timed out');
}

// Heuristic fallback for form generation if AI quota is completely exhausted
function fallbackFormFromPrompt(prompt: string, targetCount: number = 8) {
  const pLower = prompt.toLowerCase();
  
  // 1. Specific check for Education / Sekolah 8-pertanyaan request
  if (
    pLower.includes('pendidikan') ||
    pLower.includes('sekolah') ||
    pLower.includes('orang tua') ||
    pLower.includes('mata pelajaran') ||
    (pLower.includes('email') && pLower.includes('jenjang'))
  ) {
    const educationQuestions = [
      {
        title: 'Nama Lengkap Calon Siswa / Mahasiswa',
        description: 'Tuliskan nama lengkap sesuai dengan akta kelahiran atau ijazah',
        required: true,
        type: 'TEXT',
      },
      {
        title: 'Alamat Email Aktif',
        description: 'Harap masukkan alamat email valid yang aktif untuk konfirmasi pendaftaran',
        required: true,
        type: 'EMAIL',
      },
      {
        title: 'Jenis Pendidikan / Program Peminatan',
        description: 'Pilih jenis program pendidikan yang ingin Anda ikuti',
        required: true,
        type: 'RADIO',
        options: ['Program Reguler Pagi', 'Program Eksekutif / Sore', 'Program Akselerasi Unggulan', 'Program Pendidikan Inklusif'],
      },
      {
        title: 'Nama Lengkap Orang Tua / Wali',
        description: 'Tuliskan nama ayah, ibu, atau wali yang bertanggung jawab',
        required: true,
        type: 'TEXT',
      },
      {
        title: 'Tingkat Kepuasan terhadap Fasilitas & Kurikulum Pendidikan',
        description: 'Beri penilaian kepuasan Anda terhadap mutu dan kurikulum kami sejauh ini',
        required: true,
        type: 'SCALE',
        scaleMin: 1,
        scaleMax: 5,
        lowLabel: '1 (Sangat Tidak Puas)',
        highLabel: '5 (Sangat Puas)',
      },
      {
        title: 'Jenjang Sekolah yang Dituju',
        description: 'Pilih salah satu jenjang pendidikan dari daftar menu tarik-turun',
        required: true,
        type: 'DROPDOWN',
        options: [
          'PAUD / Taman Kanak-Kanak',
          'Sekolah Dasar (SD / MI)',
          'Sekolah Menengah Pertama (SMP / MTs)',
          'Sekolah Menengah Atas / Kejuruan (SMA / SMK)',
          'Perguruan Tinggi / Akademi (D3 / S1)',
        ],
      },
      {
        title: 'Mata Pelajaran & Bidang Keahlian yang Diminati',
        description: 'Anda dapat memilih lebih dari satu mata pelajaran favorit',
        required: true,
        type: 'CHECKBOX',
        options: [
          'Matematika & Logika Sains',
          'Bahasa Indonesia & Bahasa Asing (Inggris/Mandarin)',
          'Ilmu Pengetahuan Alam (Fisika, Kimia, Biologi)',
          'Teknologi Informasi, Komputer & Coding',
          'Seni Musik, Rupa & Desain Kreatif',
          'Olahraga, Atletik & Kebugaran Jasmani',
        ],
      },
      {
        title: 'Upload Dokumen Persyaratan (Ijazah / Kartu Keluarga / Rapor)',
        description: 'Unggah file berkas atau masukkan link Google Drive dokumen Anda (format PDF atau JPG/PNG)',
        required: true,
        type: 'FILE_UPLOAD',
        allowedFileTypes: ['PDF', 'JPG', 'PNG'],
        maxFileSizeMb: 10,
      },
    ];

    // If user requested even more questions (e.g. up to 20)
    const extraQuestions = [
      { title: 'Nomor WhatsApp / Telepon Aktif', description: 'Nomor telepon yang dapat dihubungi via WA', required: true, type: 'TEXT' },
      { title: 'Alamat Tempat Tinggal Saat Ini', description: 'Sesuai domisili tinggal sekarang', required: true, type: 'PARAGRAPH' },
      { title: 'Tempat & Tanggal Lahir', description: 'Format: Kota, DD-MM-YYYY', required: true, type: 'TEXT' },
      { title: 'Golongan Darah', description: 'Pilih golongan darah', required: false, type: 'DROPDOWN', options: ['A', 'B', 'AB', 'O', 'Tidak Tahu'] },
      { title: 'Pekerjaan Orang Tua / Wali', description: 'Bidang profesi pekerjaan', required: false, type: 'TEXT' },
      { title: 'Penghasilan Rata-rata Orang Tua per Bulan', description: 'Untuk pertimbangan beasiswa/subsidi', required: false, type: 'RADIO', options: ['< Rp 3 Juta', 'Rp 3 - 6 Juta', 'Rp 6 - 10 Juta', '> Rp 10 Juta'] },
      { title: 'Prestasi Akademik / Non-Akademik yang Pernah Diraih', description: 'Sebutkan lomba atau kejuaraan jika ada', required: false, type: 'PARAGRAPH' },
      { title: 'Pernah Mengikuti Bimbingan Belajar atau Kursus Tambahan?', description: 'Pengalaman belajar luar sekolah', required: false, type: 'RADIO', options: ['Pernah Rutin', 'Kadang-kadang', 'Belum Pernah'] },
      { title: 'Aktivitas Ekstrakurikuler yang Ingin Diikuti', description: 'Pilih minat organisasi/klub', required: false, type: 'CHECKBOX', options: ['Pramuka / PMR', 'Robotik / Sains Club', 'Paduan Suara / Band', 'Futsal / Basket', 'Paskibra'] },
      { title: 'Kesiapan Mengikuti Pembelajaran Digital & Laptop', description: 'Ketersediaan gawai perangkat belajar', required: false, type: 'RADIO', options: ['Memiliki Laptop Pribadi', 'Memiliki Smartphone/Tablet', 'Menggunakan Fasilitas Lab Sekolah'] },
      { title: 'Ekspektasi & Target Prestasi yang Ingin Dicapai', description: 'Harapan Anda selama masa studi', required: false, type: 'PARAGRAPH' },
      { title: 'Darimana Anda Mengetahui Informasi Sekolah Ini?', description: 'Sumber referensi', required: false, type: 'DROPDOWN', options: ['Rekomendasi Alumni / Teman', 'Media Sosial (Instagram/TikTok)', 'Brosur & Spanduk', 'Pencarian Google / Website'] },
    ];

    const countToReturn = Math.max(8, Math.min(targetCount, 20));
    const merged = [...educationQuestions, ...extraQuestions].slice(0, countToReturn);

    return {
      title: 'Formulir Pendaftaran Siswa & Evaluasi Pendidikan',
      description: 'Formulir resmi pendaftaran calon siswa dan evaluasi kepuasan kurikulum pendidikan tahun ajaran baru.',
      questions: merged,
    };
  }

  // 2. Specific check for branch daily sales report request
  if (pLower.includes('cabang') || pLower.includes('penjualan')) {
    let branches = ['Jakarta Pusat', 'Surabaya Barat', 'Bandung Kota', 'Medan Merdeka', 'Bali Denpasar'];
    
    // Extract custom options from (pilihan: ...) if present
    const optionsMatch = prompt.match(/\(pilihan:\s*([^)]+)\)/i);
    if (optionsMatch && optionsMatch[1]) {
      branches = optionsMatch[1].split(/[,;]/).map(s => s.trim()).filter(Boolean);
    }

    return {
      title: 'Formulir Pelaporan Harian Cabang',
      description: 'Formulir pelaporan operasional harian cabang mencakup transaksi penjualan, kategori produk, dan kepuasan pelanggan.',
      questions: [
        {
          title: 'Tanggal Laporan',
          description: 'Format: YYYY-MM-DD atau pilih tanggal hari ini',
          required: true,
          type: 'TEXT',
        },
        {
          title: 'Nama Cabang',
          description: 'Pilih lokasi cabang pelapor',
          required: true,
          type: 'RADIO',
          options: branches,
        },
        {
          title: 'Kategori Produk Terjual',
          description: 'Pilih kategori produk utama yang ditransaksikan hari ini',
          required: true,
          type: 'CHECKBOX',
          options: ['Elektronik & Gadget', 'Aksesoris & Retail', 'Perangkat Kantor', 'Layanan Servis', 'Lainnya'],
        },
        {
          title: 'Estimasi Total Omset Penjualan (Juta Rupiah)',
          description: 'Tuliskan angka estimasi omset penjualan (contoh: 45 atau 85.5)',
          required: true,
          type: 'TEXT',
        },
        {
          title: 'Total Jumlah Transaksi',
          description: 'Jumlah transaksi struk/kasir yang berhasil',
          required: true,
          type: 'TEXT',
        },
        {
          title: 'Tingkat Kepuasan Pelanggan Hari Ini',
          description: 'Skor rata-rata kepuasan layanan di cabang (skala 1 - 5)',
          required: true,
          type: 'SCALE',
          scaleMin: 1,
          scaleMax: 5,
          lowLabel: '1 (Sangat Tidak Puas)',
          highLabel: '5 (Sangat Puas)',
        },
        {
          title: 'Catatan Khusus / Masukan Operasional Cabang',
          description: 'Kendala atau hal penting yang terjadi di cabang hari ini',
          required: false,
          type: 'PARAGRAPH',
        },
      ],
    };
  }

  // 3. General fallback parser with dynamic count up to 20
  const baseQuestions = [
    { title: 'Nama Lengkap / Identitas', required: true, type: 'TEXT' },
    { title: 'Alamat Email', required: true, type: 'EMAIL' },
    { title: 'Kategori / Pilihan Utama', required: true, type: 'RADIO', options: ['Pilihan A', 'Pilihan B', 'Pilihan C'] },
    { title: 'Jenjang / Klasifikasi', required: false, type: 'DROPDOWN', options: ['Tingkat Dasar', 'Tingkat Menengah', 'Tingkat Lanjut'] },
    { title: 'Skala Penilaian & Kepuasan', required: true, type: 'SCALE', scaleMin: 1, scaleMax: 5, lowLabel: '1 (Rendah)', highLabel: '5 (Tinggi)' },
    { title: 'Pilihan Layanan / Minat Terkait', required: false, type: 'CHECKBOX', options: ['Opsi 1', 'Opsi 2', 'Opsi 3', 'Opsi 4'] },
    { title: 'Uraian Catatan atau Masukan Tambahan', required: false, type: 'PARAGRAPH' },
    { title: 'Lampiran / Dokumen Pendukung', required: false, type: 'FILE_UPLOAD' },
  ];

  return {
    title: prompt.length > 50 ? prompt.slice(0, 47) + '...' : prompt,
    description: 'Formulir dibuat berdasarkan kebutuhan: ' + prompt,
    questions: baseQuestions.slice(0, Math.max(4, Math.min(targetCount, 20))),
  };
}

// Endpoint for AI Form Generation
app.post('/api/generate-form-schema', async (req: Request, res: Response) => {
  const { prompt, language = 'id', targetCount = 8 } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const formSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Judul formulir yang jelas dan formal/ramah' },
      description: { type: Type.STRING, description: 'Penjelasan tujuan formulir' },
      questions: {
        type: Type.ARRAY,
        description: `Daftar pertanyaan lengkap dalam formulir (susun antara 5 hingga 20 pertanyaan sesuai instruksi)`,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Teks pertanyaan' },
            description: { type: Type.STRING, description: 'Petunjuk tambahan pertanyaan jika ada' },
            required: { type: Type.BOOLEAN, description: 'Apakah wajib diisi' },
            type: {
              type: Type.STRING,
              description: 'Tipe pertanyaan: TEXT, PARAGRAPH, EMAIL, RADIO, CHECKBOX, DROPDOWN, SCALE, FILE_UPLOAD',
            },
            options: {
              type: Type.ARRAY,
              description: 'Daftar pilihan jika tipe RADIO, CHECKBOX, atau DROPDOWN',
              items: { type: Type.STRING },
            },
            scaleMin: { type: Type.INTEGER, description: 'Nilai minimum jika tipe SCALE (cth: 1)' },
            scaleMax: { type: Type.INTEGER, description: 'Nilai maksimum jika tipe SCALE (cth: 5)' },
            lowLabel: { type: Type.STRING, description: 'Label skala terendah (cth: Sangat Tidak Puas)' },
            highLabel: { type: Type.STRING, description: 'Label skala tertinggi (cth: Sangat Puas)' },
          },
          required: ['title', 'type', 'required'],
        },
      },
    },
    required: ['title', 'description', 'questions'],
  };

  const systemInstruction = `Kamu adalah pakar perancang formulir survei, pendaftaran, dan sistem evaluasi Google Form profesional.
Tugasmu adalah menganalisis permintaan pengguna dan membuat struktur Google Form yang sangat relevan, komprehensif, mendalam, dan logis.
Bila pengguna meminta jumlah pertanyaan tertentu (misalnya 8 pertanyaan, 10 pertanyaan, 15 pertanyaan, hingga 20 pertanyaan), penuhi jumlah tersebut secara lengkap tanpa memotongnya.
Gunakan tipe pertanyaan yang beragam dan tepat:
- TEXT (jawaban singkat seperti nama, nama orang tua, dsb)
- PARAGRAPH (uraian panjang / saran)
- EMAIL (alamat email aktif dengan format valid)
- RADIO (pilihan ganda satu pilihan)
- CHECKBOX (pilihan kotak centang multi-pilihan)
- DROPDOWN (menu tarik-turun dropdown)
- SCALE (skala kepuasan linear 1 s/d 5)
- FILE_UPLOAD (unggah berkas atau dokumen)
Gunakan Bahasa Indonesia yang baik dan profesional.`;

  try {
    const text = await generateWithFallback({
      contents: `Buatkan formulir berdasarkan kebutuhan ini:\n"${prompt}"\nTarget jumlah pertanyaan: sekitar ${targetCount} pertanyaan (buat lengkap hingga ${targetCount} butir pertanyaan).\nBahasa: ${language}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: formSchema,
        temperature: 0.2,
      },
      timeoutMs: 7000,
    });

    const parsed = JSON.parse(text);
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.warn('AI form generation encountered error, utilizing intelligent heuristic fallback:', error.message);
    const fallbackData = fallbackFormFromPrompt(prompt, targetCount);
    return res.json({ success: true, data: fallbackData, fallback: true });
  }
});

// Endpoint for AI Data Insight / Summary
app.post('/api/analyze-form-data', async (req: Request, res: Response) => {
  try {
    const { formTitle, questions, responsesSummary } = req.body;

    const promptText = `
Berikut adalah data hasil survei/formulir:
Judul Formulir: ${formTitle}
Daftar Pertanyaan: ${JSON.stringify(questions, null, 2)}
Ringkasan Jawaban Responden: ${JSON.stringify(responsesSummary, null, 2)}

Berikan analisis mendalam dan ringkas dalam Bahasa Indonesia yang mencakup:
1. Ringkasan Eksekutif (1-2 paragraf)
2. Temuan Utama (3-5 poin penting berdasarkan persentase atau kecenderungan data)
3. Rekomendasi Tindak Lanjut (3 poin konkret yang bisa langsung dieksekusi)
4. Kesimpulan Akhir
Gunakan format teks Markdown yang rapi dengan heading dan bullet point.`;

    const text = await generateWithFallback({
      contents: promptText,
      config: {
        temperature: 0.3,
      },
    });

    return res.json({ success: true, analysis: text });
  } catch (error: any) {
    console.error('Error analyzing form data:', error);
    return res.status(500).json({ error: error.message || 'Internal server error analyzing data' });
  }
});

// Endpoint for Dynamic AI Natural Language Pivot Table & Decision Engine
app.post('/api/pivot-query', async (req: Request, res: Response) => {
  try {
    const { userQuery, headers, rows, formTitle = 'Data Spreadsheet' } = req.body;
    if (!userQuery) {
      return res.status(400).json({ error: 'Permintaan analisis (userQuery) wajib diisi' });
    }
    if (!headers || !rows || rows.length === 0) {
      return res.status(400).json({ error: 'Data spreadsheet kosong' });
    }

    const pivotSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        queryTitle: { type: Type.STRING, description: 'Judul jelas dari analisis pivot yang dihasilkan' },
        explanation: { type: Type.STRING, description: 'Penjelasan metodologi agregasi atau filter data dalam 1-2 kalimat ringkas' },
        pivotTable: {
          type: Type.OBJECT,
          description: 'Hasil tabel pivot teragregasi',
          properties: {
            columns: {
              type: Type.ARRAY,
              description: 'Header kolom tabel pivot (cth: ["Cabang", "Jumlah Transaksi", "Total Penjualan (Rp)", "Rata-rata Kepuasan"])',
              items: { type: Type.STRING },
            },
            rows: {
              type: Type.ARRAY,
              description: 'Baris data pivot hasil perhitungan',
              items: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            totalRow: {
              type: Type.ARRAY,
              description: 'Baris total / agregat keseluruhan di bagian paling bawah jika relevan',
              items: { type: Type.STRING },
            },
          },
          required: ['columns', 'rows'],
        },
        chartConfig: {
          type: Type.OBJECT,
          description: 'Spesifikasi grafik visual untuk Chart.js',
          properties: {
            chartType: { type: Type.STRING, description: 'Tipe chart: "bar" | "line" | "pie" | "doughnut"' },
            chartTitle: { type: Type.STRING, description: 'Judul grafik' },
            labels: {
              type: Type.ARRAY,
              description: 'Label sumbu X atau label segmen (cth: daftar nama cabang/kategori)',
              items: { type: Type.STRING },
            },
            datasetLabel: { type: Type.STRING, description: 'Label data (cth: "Total Penjualan", "Skor")' },
            dataValues: {
              type: Type.ARRAY,
              description: 'Nilai angka numerik murni untuk setiap label',
              items: { type: Type.NUMBER },
            },
          },
          required: ['chartType', 'chartTitle', 'labels', 'datasetLabel', 'dataValues'],
        },
        keyFindings: {
          type: Type.ARRAY,
          description: '3-4 poin temuan fakta kunci dari data tersebut',
          items: { type: Type.STRING },
        },
        decisionRecommendations: {
          type: Type.ARRAY,
          description: '3-4 saran keputusan bisnis konkret untuk pimpinan yang dapat segera dieksekusi',
          items: { type: Type.STRING },
        },
      },
      required: ['queryTitle', 'explanation', 'pivotTable', 'chartConfig', 'keyFindings', 'decisionRecommendations'],
    };

    const systemInstruction = `Kamu adalah Chief Data Analyst dan Konsultan Bisnis Eksekutif Senior.
Tugasmu adalah menganalisis data mentah spreadsheet yang diberikan, lalu melakukan operasi pivot table (agregasi grouping, count, sum, average, min/max, perbandingan kategori, dsb) sesuai instruksi atau pertanyaan pengguna/pimpinan.
Lakukan perhitungan matematika dengan cermat dari baris data yang diberikan.
Jika data berupa angka numerik (misal penjualan, nilai skor, jumlah), konversikan ke angka murni untuk dataValues grafik. Format tampilan di tabel boleh menggunakan format rupiah/angka yang nyaman dibaca.
Berikan saran keputusan bisnis (decisionRecommendations) yang tajam, solutif, realistis, dan berorientasi pada peningkatan profitabilitas, efisiensi operasional, atau kepuasan konsumen.`;

    const sampleRows = rows.slice(0, 200);

    const contents = `
SUMBER DATA:
Judul Formulir/Sheet: ${formTitle}
Kolom Data (Headers): ${JSON.stringify(headers)}
Data Mentah (${sampleRows.length} baris):
${JSON.stringify(sampleRows)}

PERMINTAAN ANALISIS PIMPINAN / PENGGUNA:
"${userQuery}"

Lakukan pengelompokan (grouping / pivot table) dari data di atas, susun grafik yang paling representatif, buatkan kesimpulan angka, dan berikan saran keputusan terbaik untuk pimpinan.`;

    const text = await generateWithFallback({
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: pivotSchema,
        temperature: 0.2,
      },
    });

    const result = JSON.parse(text);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error in pivot-query:', error);
    return res.status(500).json({ error: error.message || 'Gagal memproses query pivot AI' });
  }
});

// In production or when serving static files
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProduction) {
    // Vite middleware for development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static build in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
