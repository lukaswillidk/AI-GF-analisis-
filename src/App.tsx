import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
} from './lib/auth';
import {
  createGoogleForm,
  populateGoogleForm,
  createIntegratedSpreadsheet,
  getFormResponses,
  syncResponsesToSpreadsheet,
  generateSimulatedResponses,
  readSpreadsheetData,
} from './lib/googleApi';
import { FormDraft, GoogleFormData } from './types/form';
import { FormBuilder } from './components/FormBuilder';
import { VisualAnalytics } from './components/VisualAnalytics';
import { AIPivotAnalysis } from './components/AIPivotAnalysis';
import { exportReportToPDF } from './lib/pdfExport';
import {
  FileSpreadsheet,
  FileText,
  BarChart3,
  Download,
  ExternalLink,
  RefreshCw,
  LogOut,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Share2,
  Copy,
  ChevronRight,
  Database,
  ArrowUpRight,
  TrendingUp,
  Edit3,
  Eye,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Status integrasi aktif
  const [activeTab, setActiveTab] = useState<'create' | 'analytics' | 'pivot'>('create');
  const [isCreating, setIsCreating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);

  // Form & Sheet data yang sedang aktif
  const [activeFormData, setActiveFormData] = useState<GoogleFormData | null>(null);
  const [activeSheetUrl, setActiveSheetUrl] = useState<string | null>(null);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);

  // Data sheet untuk analitik
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<string[][]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');

  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const [copySuccess, setCopySuccess] = useState(false);

  // Inisialisasi Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
        setAuthLoading(false);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
        setAuthLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const showNotify = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setAccessToken(res.accessToken);
        showNotify('Berhasil login ke akun Google!', 'success');
      }
    } catch (err: any) {
      console.error('Sign in failed:', err);
      showNotify(`Gagal login: ${err.message || 'Cek popup blocker'}`, 'error');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setAccessToken(null);
    setActiveFormData(null);
    setActiveSheetUrl(null);
    setActiveSheetId(null);
    setSheetHeaders([]);
    setSheetRows([]);
    setAiAnalysis('');
    showNotify('Anda telah keluar dari akun Google.', 'info');
  };

  // 1. Eksekusi Pembuatan Google Form + Google Sheets Terintegrasi
  const handleCreateIntegratedForm = async (draft: FormDraft) => {
    const token = accessToken || (await getAccessToken());
    if (!token) {
      showNotify('Silakan login dengan Google terlebih dahulu.', 'error');
      return;
    }

    setIsCreating(true);
    try {
      showNotify('1/3 Membuat Google Form baru...', 'info');
      // Step 1: Buat form dasar
      const initialForm = await createGoogleForm(token, draft.title);

      // Step 2: Isi pertanyaan ke form
      showNotify('2/3 Menyusun pertanyaan ke dalam Google Form...', 'info');
      const updatedForm = await populateGoogleForm(token, initialForm.formId, draft);

      // Step 3: Buat Google Sheet terintegrasi dengan header yang cocok
      showNotify('3/3 Menghubungkan Google Spreadsheet untuk menampung jawaban...', 'info');
      const sheet = await createIntegratedSpreadsheet(token, draft.title, draft.questions);

      const finalFormData: GoogleFormData = {
        ...updatedForm,
        linkedSpreadsheetId: sheet.spreadsheetId,
        linkedSpreadsheetUrl: sheet.spreadsheetUrl,
      };

      setActiveFormData(finalFormData);
      setActiveSheetId(sheet.spreadsheetId);
      setActiveSheetUrl(sheet.spreadsheetUrl);

      // Inisialisasi data sheet lokal
      setSheetHeaders(['Timestamp', ...draft.questions.map((q) => q.title)]);
      setSheetRows([]);
      setAiAnalysis('');

      setActiveTab('analytics');
      showNotify('🎉 Google Form dan Spreadsheet berhasil dibuat dan terintegrasi!', 'success');
    } catch (error: any) {
      console.error('Creation error:', error);
      showNotify(`Gagal membuat integrasi: ${error.message}`, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  // 2. Sinkronkan Respon dari Form ke Sheet & Perbarui Tampilan
  const handleSyncData = async () => {
    const token = accessToken || (await getAccessToken());
    if (!token || !activeFormData || !activeSheetId) return;

    setIsSyncing(true);
    try {
      // Ambil respon terbaru dari Google Form
      const responses = await getFormResponses(token, activeFormData.formId);

      if (responses.length > 0) {
        await syncResponsesToSpreadsheet(token, activeSheetId, activeFormData, responses);
      }

      // Baca data terbaru dari spreadsheet
      const sheetData = await readSpreadsheetData(token, activeSheetId);
      setSheetHeaders(sheetData.headers);
      setSheetRows(sheetData.rows);

      showNotify(
        `Berhasil menyinkronkan data! (${sheetData.rows.length} total baris jawaban)`,
        'success'
      );

      // Jalankan AI analysis otomatis jika ada data
      if (sheetData.rows.length > 0 && !aiAnalysis) {
        generateAiSummary(sheetData.headers, sheetData.rows);
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      showNotify(`Gagal sinkron data: ${err.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // 3. Tambahkan Respon Simulasi untuk kemudahan uji coba pengguna
  const handleSimulateData = async () => {
    const token = accessToken || (await getAccessToken());
    if (!token || !activeFormData || !activeSheetId) return;

    setIsSimulating(true);
    try {
      showNotify('Menambahkan 5 data jawaban simulasi ke Spreadsheet...', 'info');
      await generateSimulatedResponses(token, activeFormData.formId, activeSheetId, activeFormData, 5);

      const sheetData = await readSpreadsheetData(token, activeSheetId);
      setSheetHeaders(sheetData.headers);
      setSheetRows(sheetData.rows);

      showNotify('5 data jawaban berhasil ditambahkan ke Spreadsheet!', 'success');
      generateAiSummary(sheetData.headers, sheetData.rows);
    } catch (err: any) {
      console.error('Simulation error:', err);
      showNotify(`Gagal simulasi data: ${err.message}`, 'error');
    } finally {
      setIsSimulating(false);
    }
  };

  // 4. Analisis Cerdas Gemini AI
  const generateAiSummary = async (headers: string[], rows: string[][]) => {
    if (!activeFormData || rows.length === 0) return;
    setIsAnalyzingAI(true);
    try {
      // Format ringkasan jawaban untuk prompt AI
      const questions = headers.slice(1);
      const responsesSummary = questions.map((q, idx) => {
        const answers = rows.map((r) => r[idx + 1]).filter(Boolean);
        return {
          question: q,
          totalAnswered: answers.length,
          sampleAnswers: answers.slice(0, 10),
        };
      });

      const res = await fetch('/api/analyze-form-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formTitle: activeFormData.info.title,
          questions,
          responsesSummary,
        }),
      });

      const json = await res.json();
      if (json.analysis) {
        setAiAnalysis(json.analysis);
      }
    } catch (err) {
      console.error('AI summary error:', err);
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  // 5. Ekspor Laporan Otomatis ke Format PDF
  const handleExportPDF = async () => {
    if (!activeFormData) return;
    setIsExportingPDF(true);
    try {
      await exportReportToPDF({
        title: activeFormData.info.title,
        formUrl: activeFormData.responderUri,
        sheetUrl: activeSheetUrl || undefined,
        totalResponses: sheetRows.length,
        aiAnalysisText: aiAnalysis,
        summaryMetrics: [
          { label: 'Total Responden', value: sheetRows.length },
          { label: 'Jumlah Pertanyaan', value: Math.max(0, sheetHeaders.length - 1) },
          { label: 'Status Integrasi', value: 'Google Sheets Aktif' },
        ],
        elementIdToCapture: 'analytics-printable-area',
      });
      showNotify('Laporan PDF berhasil diunduh ke perangkat Anda!', 'success');
    } catch (err: any) {
      console.error('PDF error:', err);
      showNotify(`Gagal mengekspor PDF: ${err.message}`, 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleCopyResponderLink = () => {
    if (activeFormData?.responderUri) {
      navigator.clipboard.writeText(activeFormData.responderUri);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      showNotify('Tautan formulir responden berhasil disalin!', 'success');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Notifikasi Toast */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-3 text-sm animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : notification.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Utama */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">
                FormToSheet AI
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Google Form & Spreadsheet Terintegrasi + Analisis Grafis & Ekspor PDF
              </p>
            </div>
          </div>

          {/* User Auth Info */}
          <div className="flex items-center gap-3">
            {authLoading ? (
              <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
            ) : currentUser ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="avatar"
                      className="w-5 h-5 rounded-full"
                    />
                  ) : (
                    <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span className="font-medium text-slate-700 max-w-[120px] truncate hidden sm:inline">
                    {currentUser.displayName || currentUser.email}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  title="Keluar"
                  className="p-2 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="gsi-material-button text-xs font-semibold py-2 px-3.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 flex items-center gap-2 shadow-2xs transition-colors"
              >
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  className="w-4 h-4"
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>{isSigningIn ? 'Menghubungkan...' : 'Sign in with Google'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero / Warning jika belum login */}
      {!currentUser && !authLoading && (
        <div className="bg-amber-50/80 border-b border-amber-200 px-4 py-3">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Login Diperlukan:</strong> Masuk dengan akun Google Anda untuk mengizinkan aplikasi membuat Google Form dan Google Sheet langsung di Google Drive Anda.
              </span>
            </div>
            <button
              onClick={handleSignIn}
              className="text-xs font-semibold text-amber-800 underline hover:text-amber-950 self-start sm:self-auto"
            >
              Masuk Sekarang →
            </button>
          </div>
        </div>
      )}

      {/* Konten Utama */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'create'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              1. Buat Form & Sheets
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'analytics'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              2. Grafik & Laporan PDF
              {activeFormData && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('pivot')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'pivot'
                  ? 'bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-xs'
                  : 'text-indigo-900 bg-indigo-50/60 hover:bg-indigo-100 border border-indigo-200/60'
              }`}
            >
              <Sparkles className={`w-4 h-4 ${activeTab === 'pivot' ? 'text-amber-300' : 'text-indigo-600'}`} />
              <span>3. Tanya AI & Pivot Dinamis</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                activeTab === 'pivot' ? 'bg-white/20 text-white' : 'bg-indigo-600 text-white'
              }`}>
                Pimpinan
              </span>
            </button>
          </div>

          {/* Aksi Cepat jika Form aktif sudah dibuat */}
          {activeFormData && (
            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
              <a
                href={activeFormData.editUri || `https://docs.google.com/forms/d/${activeFormData.formId}/edit`}
                target="_blank"
                rel="noreferrer"
                title="Buka langsung halaman Editor Google Form"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5 text-purple-600" />
                <span>Buka Editor Form</span>
                <ArrowUpRight className="w-3 h-3 text-purple-400" />
              </a>

              {activeSheetUrl && (
                <a
                  href={activeSheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Buka Sheets</span>
                  <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                </a>
              )}

              <button
                onClick={handleCopyResponderLink}
                title="Salin tautan formulir untuk responden mengisi formulir"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copySuccess ? 'Tersalin!' : 'Salin Link Form'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Form Builder */}
        {activeTab === 'create' && (
          <div className="space-y-6">
            {!currentUser && (
              <div className="bg-blue-50/70 border border-blue-200 p-5 rounded-xl text-center space-y-3">
                <h3 className="text-sm font-bold text-blue-900">
                  Mulai Rancang Google Form & Spreadsheet
                </h3>
                <p className="text-xs text-blue-700 max-w-md mx-auto">
                  Anda dapat menyusun draf pertanyaan di bawah ini. Saat siap diterbitkan, klik Sign In with Google untuk menyimpan ke akun Anda secara otomatis.
                </p>
                <button
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  Sign in with Google
                </button>
              </div>
            )}

            <FormBuilder
              onBuildComplete={handleCreateIntegratedForm}
              isCreating={isCreating}
            />
          </div>
        )}

        {/* Tab 2: Visual Analytics & PDF Export */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Banner Langsung Masuk Editor Google Form */}
            {activeFormData && (
              <div className="bg-linear-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200/90 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-purple-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-purple-950 flex flex-wrap items-center gap-2">
                      <span>Buka Langsung ke Editor Google Form</span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 text-[10px] font-bold">
                        Mode Edit Pemilik
                      </span>
                    </div>
                    <p className="text-xs text-purple-900/80 mt-1 max-w-2xl leading-relaxed">
                      Klik <strong>"Buka Editor Form Langsung"</strong> untuk masuk ke tampilan edit formulir Google Forms Anda. Di sana Anda dapat mengatur urutan butir, melihat ringkasan respon resmi Google, atau mengubah butir berkas ke komponen unggah file Google Drive bawaan secara instan.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto shrink-0">
                  <a
                    href={activeFormData.editUri || `https://docs.google.com/forms/d/${activeFormData.formId}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Buka Editor Form Langsung</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>

                  {activeSheetUrl && (
                    <a
                      href={activeSheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Buka Sheets</span>
                    </a>
                  )}

                  <button
                    onClick={handleCopyResponderLink}
                    title="Salin tautan responden"
                    className="px-3.5 py-2.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copySuccess ? 'Tersalin!' : 'Salin Link Form'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Header info form aktif */}
            {activeFormData ? (
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-emerald-100 text-emerald-800">
                      Terhubung
                    </span>
                    <h2 className="text-base font-bold text-slate-900">
                      {activeFormData.info.title}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 max-w-xl">
                    {activeFormData.info.description || 'Tidak ada deskripsi'}
                  </p>
                </div>

                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSyncData}
                    disabled={isSyncing}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-all shadow-2xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Menyinkronkan...' : 'Sinkron Data Form'}
                  </button>

                  <button
                    onClick={handleSimulateData}
                    disabled={isSimulating}
                    title="Tambahkan data simulasi untuk melihat grafik jika belum ada responden asli"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-xl transition-all disabled:opacity-50"
                  >
                    <Database className="w-3.5 h-3.5" />
                    {isSimulating ? 'Mengisi...' : '+5 Respon Simulasi'}
                  </button>

                  <button
                    onClick={handleExportPDF}
                    disabled={isExportingPDF || sheetRows.length === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-xs disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {isExportingPDF ? 'Menyiapkan PDF...' : 'Ekspor Laporan PDF'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
                <FileSpreadsheet className="w-12 h-12 mx-auto text-blue-500" />
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Belum Ada Form & Spreadsheet yang Terpilih
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Silakan buka tab "Buat Form & Sheets" untuk merancang formulir baru dengan AI atau template cepat.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Buat Form Sekarang
                </button>
              </div>
            )}

            {/* Visualisasi Grafis Chart & AI Summary */}
            {activeFormData && (
              <VisualAnalytics
                formData={activeFormData}
                sheetHeaders={sheetHeaders}
                sheetRows={sheetRows}
                aiAnalysisText={aiAnalysis}
                isAnalyzing={isAnalyzingAI}
                onRefreshAnalysis={() => generateAiSummary(sheetHeaders, sheetRows)}
              />
            )}
          </div>
        )}

        {/* Tab 3: Dynamic AI Pivot Table & Decision Engine */}
        {activeTab === 'pivot' && (
          <AIPivotAnalysis
            sheetHeaders={sheetHeaders}
            sheetRows={sheetRows}
            formTitle={activeFormData?.info.title || 'Data Spreadsheet'}
          />
        )}
      </main>

      {/* Footer sederhana */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Terintegrasi langsung dengan <strong>Google Forms API</strong>, <strong>Google Sheets API</strong>, dan <strong>Gemini AI</strong>.
          </div>
          <div className="text-[11px] text-slate-400">
            Responsif, aman, dan mudah digunakan untuk pengguna awam.
          </div>
        </div>
      </footer>
    </div>
  );
}
