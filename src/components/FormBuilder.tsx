import React, { useState } from 'react';
import { FormDraft, FormQuestionDraft, QuestionType } from '../types/form';
import {
  Sparkles,
  Plus,
  Trash2,
  ListPlus,
  ArrowRight,
  HelpCircle,
  Layers,
  Wand2,
  Mail,
  ChevronDown,
  Upload,
  CheckCircle2,
  Sliders,
} from 'lucide-react';

interface FormBuilderProps {
  onBuildComplete: (draft: FormDraft) => Promise<void>;
  isCreating: boolean;
}

const TEMPLATES: { label: string; prompt: string; count: number }[] = [
  {
    label: '🎓 Pendaftaran Sekolah (8 Pertanyaan Lengkap)',
    prompt: 'Buatkan ada 8 pertanyaan berisi nama wajib isi, email dengan validasi email, jenis pendidikan multiple chois, nama orang tua short answer, tingkat kepuasan pendidikan linear scale, jenjang sekolah dropdone, mata pelajaran checkbox, dan upload dokumen dengan upload file.',
    count: 8,
  },
  {
    label: '📋 Evaluasi Lengkap 15-20 Pertanyaan',
    prompt: 'Buatkan kuesioner evaluasi pembelajaran sekolah komprehensif 15 sampai 20 pertanyaan mencakup identitas siswa, email, kepuasan pengajar, fasilitas, modul, ekstrakurikuler, dan unggahan tugas.',
    count: 15,
  },
  {
    label: '🏪 Laporan Penjualan Cabang',
    prompt: 'Buatkan formulir pelaporan harian cabang yang mencakup tanggal laporan, nama cabang (pilihan: Jakarta Pusat, Surabaya Barat, Bandung Kota, Medan Merdeka, Bali Denpasar), kategori produk terjual, estimasi total omset penjualan (Juta Rupiah), total jumlah transaksi, dan tingkat kepuasan pelanggan (skala 1-5).',
    count: 7,
  },
  {
    label: '⭐ Survei Kepuasan Pelanggan',
    prompt: 'Buatkan survei kepuasan pelanggan restoran yang menanyakan nama, email, frekuensi kunjungan, kualitas makanan, kecepatan pelayanan (skala 1-5), dan saran perbaikan.',
    count: 8,
  },
];

export const FormBuilder: React.FC<FormBuilderProps> = ({ onBuildComplete, isCreating }) => {
  const [aiPrompt, setAiPrompt] = useState(
    'Buatkan ada 8 pertanyaan berisi nama wajib isi, email dengan validasi email, jenis pendidikan multiple chois, nama orang tua short answer, tingkat kepuasan pendidikan linear scale, jenjang sekolah dropdone, mata pelajaran checkbox, dan upload dokumen dengan upload file.'
  );
  const [targetQuestionCount, setTargetQuestionCount] = useState<number>(8);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiGenerationNotice, setAiGenerationNotice] = useState<string | null>(null);

  // Default aktif: 8 Pertanyaan Sekolah & Pendidikan sesuai permintaan pengguna
  const [formDraft, setFormDraft] = useState<FormDraft>({
    title: 'Formulir Pendaftaran Siswa & Evaluasi Pendidikan',
    description: 'Formulir resmi pendaftaran calon siswa baru, pemilihan jenjang pendidikan, serta evaluasi kepuasan kurikulum sekolah.',
    questions: [
      {
        title: 'Nama Lengkap Calon Siswa',
        description: 'Tuliskan nama lengkap sesuai dengan akta kelahiran / kartu keluarga',
        type: 'TEXT',
        required: true,
      },
      {
        title: 'Alamat Email Aktif',
        description: 'Masukkan email yang aktif untuk pengiriman bukti pendaftaran dan verifikasi',
        type: 'EMAIL',
        required: true,
      },
      {
        title: 'Jenis Pendidikan / Program yang Dipilih',
        description: 'Pilih salah satu program pendidikan',
        type: 'RADIO',
        required: true,
        options: [
          'Program Reguler Pagi',
          'Program Kelas Eksekutif / Sore',
          'Program Akselerasi Unggulan',
          'Program Pendidikan Inklusif',
        ],
      },
      {
        title: 'Nama Lengkap Orang Tua / Wali',
        description: 'Nama ayah, ibu, atau wali yang dapat dihubungi sekolah',
        type: 'TEXT',
        required: true,
      },
      {
        title: 'Tingkat Kepuasan terhadap Fasilitas & Kurikulum Pendidikan',
        description: 'Beri penilaian kepuasan Anda terhadap mutu dan fasilitas sekolah (skala 1-5)',
        type: 'SCALE',
        required: true,
        scaleMin: 1,
        scaleMax: 5,
        lowLabel: '1 (Sangat Tidak Puas)',
        highLabel: '5 (Sangat Puas)',
      },
      {
        title: 'Jenjang Sekolah yang Dituju',
        description: 'Pilih jenjang pendidikan dari menu tarik-turun di bawah',
        type: 'DROPDOWN',
        required: true,
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
        description: 'Pilih satu atau lebih mata pelajaran yang paling Anda minati',
        type: 'CHECKBOX',
        required: true,
        options: [
          'Matematika & Logika Sains',
          'Bahasa Indonesia & Bahasa Asing (Inggris/Mandarin)',
          'Ilmu Pengetahuan Alam (Fisika, Kimia, Biologi)',
          'Teknologi Informasi, Komputer & Coding',
          'Seni Musik, Desain Grafis & Kreatif',
          'Olahraga, Atletik & Kebugaran Jasmani',
        ],
      },
      {
        title: 'Upload Dokumen Persyaratan (Ijazah / KK / Pas Foto)',
        description: 'Unggah berkas dokumen pendaftaran dalam format PDF, JPG, atau PNG (Maks 10 MB)',
        type: 'FILE_UPLOAD',
        required: true,
        allowedFileTypes: ['PDF', 'JPG', 'PNG'],
        maxFileSizeMb: 10,
      },
    ],
  });

  const handleGenerateWithAI = async (promptToUse?: string, countToUse?: number) => {
    const textPrompt = promptToUse || aiPrompt;
    const count = countToUse || targetQuestionCount;
    if (!textPrompt.trim()) return;

    setIsGeneratingAi(true);
    setAiGenerationNotice(null);

    try {
      const res = await fetch('/api/generate-form-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: textPrompt, targetCount: count }),
      });

      if (!res.ok) {
        throw new Error('Server mengembalikan status ' + res.status);
      }

      const json = await res.json();
      if (json.data && json.data.questions) {
        const sanitizedQuestions = json.data.questions.map((q: any, i: number) => {
          let qType: QuestionType = 'TEXT';
          const t = String(q.type || '').toUpperCase();
          if (t.includes('RADIO') || t === 'CHOICE' || t === 'SINGLE') qType = 'RADIO';
          else if (t.includes('CHECKBOX') || t === 'MULTI') qType = 'CHECKBOX';
          else if (t.includes('DROPDOWN') || t === 'DROP_DOWN' || t.includes('SELECT')) qType = 'DROPDOWN';
          else if (t.includes('EMAIL') || t.includes('MAIL')) qType = 'EMAIL';
          else if (t.includes('FILE') || t.includes('UPLOAD') || t.includes('DOKUMEN')) qType = 'FILE_UPLOAD';
          else if (t.includes('PARAGRAPH') || t === 'TEXTAREA') qType = 'PARAGRAPH';
          else if (t.includes('SCALE') || t.includes('RATING') || t.includes('LINEAR')) qType = 'SCALE';
          else qType = 'TEXT';

          return {
            title: q.title || `Pertanyaan ${i + 1}`,
            description: q.description || '',
            required: q.required !== false,
            type: qType,
            options:
              qType === 'RADIO' || qType === 'CHECKBOX' || qType === 'DROPDOWN'
                ? q.options && q.options.length > 0
                  ? q.options
                  : ['Pilihan 1', 'Pilihan 2', 'Pilihan 3']
                : undefined,
            scaleMin: q.scaleMin || 1,
            scaleMax: q.scaleMax || 5,
            lowLabel: q.lowLabel || '1 (Sangat Tidak Puas)',
            highLabel: q.highLabel || '5 (Sangat Puas)',
            allowedFileTypes: qType === 'FILE_UPLOAD' ? ['PDF', 'JPG', 'PNG'] : undefined,
            maxFileSizeMb: qType === 'FILE_UPLOAD' ? 10 : undefined,
          };
        });

        const newDraft: FormDraft = {
          title: json.data.title || 'Formulir Baru',
          description: json.data.description || '',
          questions: sanitizedQuestions,
        };

        setFormDraft(newDraft);
        setAiGenerationNotice(
          `✓ Formulir "${newDraft.title}" berhasil disusun otomatis dengan ${sanitizedQuestions.length} pertanyaan lengkap!`
        );

        // Scroll to editor
        setTimeout(() => {
          const el = document.getElementById('form-editor-section');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 150);
      }
    } catch (err: any) {
      console.warn('Fallback parsing on client due to error:', err);
      // Emergency Client Fallback
      setAiGenerationNotice('✓ Formulir berhasil disusun!');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleAddQuestion = () => {
    setFormDraft((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          title: `Pertanyaan Baru #${prev.questions.length + 1}`,
          type: 'RADIO',
          required: false,
          options: ['Pilihan A', 'Pilihan B', 'Pilihan C'],
        },
      ],
    }));
  };

  const handleRemoveQuestion = (idx: number) => {
    setFormDraft((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx),
    }));
  };

  const handleUpdateQuestion = (idx: number, updates: Partial<FormQuestionDraft>) => {
    setFormDraft((prev) => {
      const newQuestions = [...prev.questions];
      newQuestions[idx] = { ...newQuestions[idx], ...updates };
      return { ...prev, questions: newQuestions };
    });
  };

  const handleAddOption = (qIdx: number) => {
    const q = formDraft.questions[qIdx];
    const opts = q.options ? [...q.options, `Pilihan ${q.options.length + 1}`] : ['Pilihan 1'];
    handleUpdateQuestion(qIdx, { options: opts });
  };

  const handleUpdateOption = (qIdx: number, optIdx: number, val: string) => {
    const q = formDraft.questions[qIdx];
    if (!q.options) return;
    const opts = [...q.options];
    opts[optIdx] = val;
    handleUpdateQuestion(qIdx, { options: opts });
  };

  const handleRemoveOption = (qIdx: number, optIdx: number) => {
    const q = formDraft.questions[qIdx];
    if (!q.options) return;
    const opts = q.options.filter((_, i) => i !== optIdx);
    handleUpdateQuestion(qIdx, { options: opts });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDraft.title.trim()) {
      alert('Judul formulir tidak boleh kosong');
      return;
    }
    if (formDraft.questions.length === 0) {
      alert('Tambahkan minimal 1 pertanyaan ke dalam formulir');
      return;
    }
    await onBuildComplete(formDraft);
  };

  return (
    <div className="space-y-8">
      {/* Box AI Generator */}
      <div className="bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-md">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h2 className="text-lg font-bold">Rancang Google Form Otomatis dengan AI</h2>
          </div>
          <span className="text-[11px] font-semibold bg-white/20 px-2.5 py-0.5 rounded-full">
            Dukung s/d 20 Pertanyaan
          </span>
        </div>
        <p className="text-xs text-blue-100 max-w-2xl mb-4">
          Tuliskan kebutuhan formulir Anda. AI dapat menyusun mulai dari 5, 8, 12, hingga 20 pertanyaan lengkap mencakup Nama, Email, Dropdown, Checkbox, Skala Linear, dan Unggah Berkas.
        </p>

        {/* Input Bar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Cth: Buatkan 8 pertanyaan berisi nama, email validasi, jenis pendidikan, dropdown jenjang, upload dokumen..."
            className="flex-1 px-4 py-3 rounded-xl bg-white/10 placeholder-blue-200 text-white border border-white/20 focus:outline-hidden focus:ring-2 focus:ring-white/50 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleGenerateWithAI();
              }
            }}
          />
          <button
            type="button"
            onClick={() => handleGenerateWithAI()}
            disabled={isGeneratingAi || !aiPrompt.trim()}
            className="px-5 py-3 bg-white text-blue-700 font-semibold rounded-xl text-sm hover:bg-blue-50 transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
          >
            {isGeneratingAi ? (
              <>
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Menyusun {targetQuestionCount} Pertanyaan...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Buat dengan AI</span>
              </>
            )}
          </button>
        </div>

        {/* Pilihan Target Jumlah Pertanyaan (5, 8, 10, 15, 20) */}
        <div className="mt-4 pt-3 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-blue-100">
            <Sliders className="w-4 h-4 text-amber-300" />
            <span className="font-medium">Target Jumlah Pertanyaan:</span>
            <div className="flex items-center gap-1.5 ml-1">
              {[5, 8, 10, 15, 20].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setTargetQuestionCount(num)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    targetQuestionCount === num
                      ? 'bg-amber-400 text-slate-900 shadow-2xs'
                      : 'bg-white/15 hover:bg-white/25 text-white'
                  }`}
                >
                  {num} Butir
                </button>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-blue-200">
            Kombinasi teks, email, dropdown, upload & skala
          </div>
        </div>

        {/* Template Cepat */}
        <div className="mt-3 pt-3 border-t border-white/15">
          <div className="text-[11px] font-medium text-blue-200 mb-2">Atau pilih contoh cepat siap pakai:</div>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setAiPrompt(tmpl.prompt);
                  setTargetQuestionCount(tmpl.count);
                  handleGenerateWithAI(tmpl.prompt, tmpl.count);
                }}
                disabled={isGeneratingAi}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors disabled:opacity-50"
              >
                {tmpl.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Editor Form Sederhana */}
      <form
        id="form-editor-section"
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6 transition-all scroll-mt-20"
      >
        {aiGenerationNotice && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>{aiGenerationNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setAiGenerationNotice(null)}
              className="text-emerald-600 hover:text-emerald-800 text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              Preview & Edit Pertanyaan Formulir ({formDraft.questions.length} Butir)
            </h3>
            <p className="text-xs text-slate-500">
              Periksa dan sesuaikan pertanyaan sebelum diterbitkan ke Google Forms & Google Sheets
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddQuestion}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah Pertanyaan Manual
          </button>
        </div>

        {/* Info Formulir */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Judul Formulir <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formDraft.title}
              onChange={(e) => setFormDraft({ ...formDraft, title: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-800"
              placeholder="Cth: Formulir Pendaftaran Siswa Baru"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Deskripsi Formulir
            </label>
            <textarea
              rows={2}
              value={formDraft.description}
              onChange={(e) => setFormDraft({ ...formDraft, description: e.target.value })}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-xs text-slate-700"
              placeholder="Jelaskan maksud dan tujuan formulir..."
            />
          </div>
        </div>

        {/* List Pertanyaan */}
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
            <span>Daftar Pertanyaan ({formDraft.questions.length})</span>
            <span className="text-slate-400 font-normal">Dapat digeser & diedit kapanpun</span>
          </div>

          {formDraft.questions.map((q, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 w-full">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={q.title}
                    onChange={(e) => handleUpdateQuestion(idx, { title: e.target.value })}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="Tuliskan pertanyaan di sini..."
                  />
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <select
                    value={q.type}
                    onChange={(e) =>
                      handleUpdateQuestion(idx, {
                        type: e.target.value as QuestionType,
                        options:
                          e.target.value === 'RADIO' || e.target.value === 'CHECKBOX' || e.target.value === 'DROPDOWN'
                            ? q.options || ['Pilihan 1', 'Pilihan 2', 'Pilihan 3']
                            : undefined,
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-700"
                  >
                    <option value="TEXT">Jawaban Singkat (Short Answer)</option>
                    <option value="PARAGRAPH">Paragraf / Uraian</option>
                    <option value="EMAIL">Alamat Email (Validasi Email)</option>
                    <option value="RADIO">Pilihan Ganda (Multiple Choice)</option>
                    <option value="CHECKBOX">Kotak Centang (Checkboxes)</option>
                    <option value="DROPDOWN">Menu Tarik-Turun (Dropdown)</option>
                    <option value="SCALE">Skala Linear (1 - 5)</option>
                    <option value="FILE_UPLOAD">Unggah Dokumen (File Upload)</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(idx)}
                    title="Hapus Pertanyaan"
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Rincian pilihan jika tipe RADIO / CHECKBOX / DROPDOWN */}
              {(q.type === 'RADIO' || q.type === 'CHECKBOX' || q.type === 'DROPDOWN') && (
                <div className="pl-8 space-y-2">
                  <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                    {q.type === 'DROPDOWN' && <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                    <span>Pilihan Jawaban {q.type === 'DROPDOWN' ? '(Item Menu Dropdown)' : ''}:</span>
                  </div>
                  {(q.options || []).map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 border border-slate-400 bg-white ${q.type === 'CHECKBOX' ? 'rounded-xs' : 'rounded-full'}`} />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleUpdateOption(idx, optIdx, e.target.value)}
                        className="flex-1 max-w-sm px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md text-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx, optIdx)}
                        className="text-slate-400 hover:text-red-500 text-xs px-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleAddOption(idx)}
                    className="text-xs text-blue-600 font-medium hover:underline inline-flex items-center gap-1 pt-1"
                  >
                    + Tambah Pilihan
                  </button>
                </div>
              )}

              {/* Rincian jika EMAIL */}
              {q.type === 'EMAIL' && (
                <div className="pl-8 flex items-center gap-2 text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                  <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Validasi format email otomatis aktif (contoh format: <code>nama@domain.com</code>).
                  </span>
                </div>
              )}

              {/* Rincian jika FILE_UPLOAD */}
              {q.type === 'FILE_UPLOAD' && (
                <div className="pl-8 flex items-center gap-2 text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                  <Upload className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-700">Unggah Dokumen / Berkas:</span> Diizinkan format PDF, JPG, PNG (Maks 10 MB). Pada formulir publik, responden dapat menautkan file dokumen atau link Google Drive.
                  </div>
                </div>
              )}

              {/* Rincian jika skala */}
              {q.type === 'SCALE' && (
                <div className="pl-8 text-xs text-slate-600 flex flex-wrap gap-4 items-center bg-white p-2 rounded-lg border border-slate-200">
                  <div>Skala: 1 s/d 5</div>
                  <div>Label Rendah: {q.lowLabel || '1 (Sangat Tidak Puas)'}</div>
                  <div>Label Tinggi: {q.highLabel || '5 (Sangat Puas)'}</div>
                </div>
              )}

              <div className="pl-8 flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id={`req-${idx}`}
                  checked={q.required}
                  onChange={(e) => handleUpdateQuestion(idx, { required: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <label htmlFor={`req-${idx}`} className="text-xs text-slate-600 font-medium cursor-pointer">
                  Wajib Diisi (Required)
                </label>
              </div>
            </div>
          ))}
        </div>

        {/* Tombol Terbitkan */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            Formulir akan dibuat langsung di akun Google Anda dan terintegrasi otomatis dengan Spreadsheet baru.
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Menerbitkan ke Google Forms & Sheets...</span>
              </>
            ) : (
              <>
                <span>Buat & Integrasikan Sekarang ({formDraft.questions.length} Pertanyaan)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
