import { FormDraft, FormQuestionDraft, GoogleFormData, FormResponseItem } from '../types/form';

const FORMS_API_BASE = 'https://forms.googleapis.com/v1/forms';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

/**
 * 1. Membuat Form Baru di Google Forms
 */
export async function createGoogleForm(
  accessToken: string,
  title: string
): Promise<{ formId: string; responderUri: string; editUri: string; revisionId: string }> {
  const response = await fetch(FORMS_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title: title || 'Formulir Baru',
        documentTitle: title || 'Formulir Baru',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gagal membuat Google Form: ${errorText}`);
  }

  const data = await response.json();
  return {
    formId: data.formId,
    responderUri: data.responderUri,
    editUri: `https://docs.google.com/forms/d/${data.formId}/edit`,
    revisionId: data.revisionId,
  };
}

/**
 * 2. Memperbarui Detail dan Menambahkan Pertanyaan ke Google Form
 */
export async function populateGoogleForm(
  accessToken: string,
  formId: string,
  formDraft: FormDraft
): Promise<GoogleFormData> {
  const requests: any[] = [];

  // Update deskripsi form jika ada
  if (formDraft.description) {
    requests.push({
      updateFormInfo: {
        info: {
          description: formDraft.description,
        },
        updateMask: 'description',
      },
    });
  }

  // Tambahkan setiap pertanyaan
  formDraft.questions.forEach((q, index) => {
    let questionPayload: any = {
      required: !!q.required,
    };

    if (q.type === 'TEXT') {
      questionPayload.textQuestion = { paragraph: false };
    } else if (q.type === 'PARAGRAPH') {
      questionPayload.textQuestion = { paragraph: true };
    } else if (q.type === 'EMAIL') {
      questionPayload.textQuestion = { paragraph: false };
      if (!q.description) {
        q.description = 'Harap masukkan alamat email yang valid (contoh: nama@domain.com)';
      }
    } else if (q.type === 'RADIO' || q.type === 'CHECKBOX' || q.type === 'DROPDOWN') {
      const choiceType = q.type === 'DROPDOWN' ? 'DROP_DOWN' : q.type === 'RADIO' ? 'RADIO' : 'CHECKBOX';
      questionPayload.choiceQuestion = {
        type: choiceType,
        options: (q.options && q.options.length > 0 ? q.options : ['Pilihan 1', 'Pilihan 2']).map((opt) => ({
          value: opt,
        })),
        shuffle: false,
      };
    } else if (q.type === 'SCALE') {
      questionPayload.scaleQuestion = {
        low: q.scaleMin || 1,
        high: q.scaleMax || 5,
        lowLabel: q.lowLabel || '1 (Rendah)',
        highLabel: q.highLabel || '5 (Tinggi)',
      };
    } else if (q.type === 'FILE_UPLOAD') {
      // In Google Forms API, text question with document/file URL is the universally supported way across all account types
      questionPayload.textQuestion = { paragraph: false };
      q.description = q.description || 'Tempelkan link Google Drive / tautan dokumen yang dapat diakses (format PDF/Gambar)';
    }

    requests.push({
      createItem: {
        item: {
          title: q.title,
          description: q.description || undefined,
          questionItem: {
            question: questionPayload,
          },
        },
        location: {
          index: index,
        },
      },
    });
  });

  if (requests.length > 0) {
    const batchUpdateResponse = await fetch(`${FORMS_API_BASE}/${formId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });

    if (!batchUpdateResponse.ok) {
      const err = await batchUpdateResponse.text();
      throw new Error(`Gagal mengisi pertanyaan ke form: ${err}`);
    }
  }

  // Ambil detail form yang sudah diperbarui
  return await getGoogleForm(accessToken, formId);
}

/**
 * 3. Ambil Detail Google Form
 */
export async function getGoogleForm(accessToken: string, formId: string): Promise<GoogleFormData> {
  const response = await fetch(`${FORMS_API_BASE}/${formId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gagal mengambil data formulir: ${err}`);
  }

  const data = await response.json();
  return {
    ...data,
    editUri: `https://docs.google.com/forms/d/${formId}/edit`,
  };
}

/**
 * 4. Buat Spreadsheet Google Sheets Baru yang Terintegrasi
 */
export async function createIntegratedSpreadsheet(
  accessToken: string,
  title: string,
  formQuestions: FormQuestionDraft[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  // Buat spreadsheet dengan header kolom pertanyaan
  const headers = ['Timestamp', ...formQuestions.map((q) => q.title)];

  const response = await fetch(SHEETS_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: `${title} (Respon Integrasi)`,
      },
      sheets: [
        {
          properties: {
            title: 'Jawaban Form',
            gridProperties: {
              frozenRowCount: 1,
            },
          },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: headers.map((h) => ({
                    userEnteredValue: { stringValue: h },
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      backgroundColor: { red: 0.9, green: 0.95, blue: 1.0 },
                    },
                  })),
                },
              ],
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gagal membuat Google Spreadsheet: ${err}`);
  }

  const data = await response.json();
  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
  };
}

/**
 * 5. Ambil Respon Formulir dari Google Forms API
 */
export async function getFormResponses(
  accessToken: string,
  formId: string
): Promise<FormResponseItem[]> {
  try {
    const response = await fetch(`${FORMS_API_BASE}/${formId}/responses`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      console.warn('Gagal membaca respon form:', err);
      return [];
    }

    const data = await response.json();
    return data.responses || [];
  } catch (error) {
    console.error('Error fetching responses:', error);
    return [];
  }
}

/**
 * 6. Sinkronisasikan Jawaban Form ke Google Sheets
 */
export async function syncResponsesToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  formData: GoogleFormData,
  responses: FormResponseItem[]
): Promise<number> {
  if (!responses || responses.length === 0) return 0;

  // Siapkan baris data
  const questionItems = formData.items?.filter((it) => it.questionItem) || [];
  const rows: any[][] = [];

  for (const resp of responses) {
    const row = [resp.lastSubmittedTime || resp.createTime || new Date().toISOString()];
    
    questionItems.forEach((item) => {
      const qId = item.questionItem?.question.questionId;
      if (!qId) {
        row.push('');
        return;
      }
      const answerObj = resp.answers?.[qId];
      if (answerObj && answerObj.textAnswers?.answers) {
        const val = answerObj.textAnswers.answers.map((a) => a.value).join(', ');
        row.push(val);
      } else {
        row.push('-');
      }
    });

    rows.push(row);
  }

  // Update nilai pada sheet 'Jawaban Form' mulai baris 2
  const range = `Jawaban Form!A2`;
  const updateResp = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );

  if (!updateResp.ok) {
    const err = await updateResp.text();
    console.error('Error syncing to sheets:', err);
    throw new Error(`Gagal menyinkronkan data ke Sheets: ${err}`);
  }

  return rows.length;
}

/**
 * 7. Tambahkan Data Dummy/Simulasi jika form baru dan belum ada responden nyata
 */
export async function generateSimulatedResponses(
  accessToken: string,
  formId: string,
  spreadsheetId: string,
  formData: GoogleFormData,
  count: number = 5
): Promise<number> {
  const questionItems = formData.items?.filter((it) => it.questionItem) || [];
  const rows: any[][] = [];

  const sampleNames = ['Ahmad Rizky', 'Siti Rahma', 'Budi Santoso', 'Dewi Lestari', 'Eko Prasetyo', 'Fanny Wijaya', 'Gita Gutawa', 'Hendra Setiawan'];
  const sampleComments = [
    'Sangat memuaskan dan pelayanannya cepat!',
    'Cukup baik namun perlu peningkatan pada waktu respon.',
    'Aplikasi sangat mudah dipahami dan fungsional.',
    'Bagus sekali, saya rekomendasikan ke rekan lainnya.',
    'Overall memuaskan dan sudah sesuai kebutuhan.'
  ];

  for (let i = 0; i < count; i++) {
    const time = new Date(Date.now() - (count - i) * 3600000).toISOString();
    const row = [time];

    questionItems.forEach((item, itemIdx) => {
      const q = item.questionItem?.question;
      const titleLower = item.title.toLowerCase();

      if (q?.textQuestion) {
        if (titleLower.includes('email')) {
          const emailUser = sampleNames[i % sampleNames.length].toLowerCase().replace(/\s+/g, '.');
          row.push(`${emailUser}@gmail.com`);
        } else if (titleLower.includes('orang tua') || titleLower.includes('wali')) {
          const parentNames = ['Bambang Sutrisno', 'Hj. Endang Suryani', 'Drs. Hendro Wibowo', 'Ir. Agus Pratama', 'Sri Wahyuni, M.Pd'];
          row.push(parentNames[i % parentNames.length]);
        } else if (titleLower.includes('upload') || titleLower.includes('dokumen') || titleLower.includes('berkas')) {
          row.push(`https://drive.google.com/file/d/dokumen_persyaratan_${i + 1}.pdf`);
        } else if (q.textQuestion.paragraph) {
          row.push(sampleComments[i % sampleComments.length]);
        } else {
          row.push(sampleNames[i % sampleNames.length]);
        }
      } else if (q?.choiceQuestion) {
        const opts = q.choiceQuestion.options;
        if (opts && opts.length > 0) {
          if (q.choiceQuestion.type === 'CHECKBOX') {
            const selected = [opts[i % opts.length].value];
            if (opts.length > 1 && i % 2 === 0) {
              selected.push(opts[(i + 1) % opts.length].value);
            }
            row.push(selected.join(', '));
          } else {
            row.push(opts[i % opts.length].value);
          }
        } else {
          row.push('Pilihan 1');
        }
      } else if (q?.scaleQuestion) {
        const min = q.scaleQuestion.low || 1;
        const max = q.scaleQuestion.high || 5;
        const val = Math.floor(Math.random() * (max - min + 1)) + min;
        row.push(String(val));
      } else {
        row.push(`Respon #${i + 1}`);
      }
    });

    rows.push(row);
  }

  // Tulis ke spreadsheet
  const range = `Jawaban Form!A2`;
  const updateResp = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: rows,
      }),
    }
  );

  if (!updateResp.ok) {
    const err = await updateResp.text();
    throw new Error(`Gagal menulis simulasi data ke Sheets: ${err}`);
  }

  return rows.length;
}

/**
 * 8. Baca Data Nilai dari Spreadsheet untuk Analitik
 */
export async function readSpreadsheetData(
  accessToken: string,
  spreadsheetId: string
): Promise<{ headers: string[]; rows: string[][] }> {
  const range = `Jawaban Form!A1:Z500`;
  const response = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${range}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gagal membaca data spreadsheet: ${err}`);
  }

  const data = await response.json();
  const allValues = data.values || [];
  if (allValues.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = allValues[0];
  const rows = allValues.slice(1);
  return { headers, rows };
}

/**
 * 9. Cari File Spreadsheet atau Form di Drive pengguna
 */
export async function listUserFormsAndSheets(accessToken: string) {
  try {
    const query = encodeURIComponent(
      "(mimeType = 'application/vnd.google-apps.form' or mimeType = 'application/vnd.google-apps.spreadsheet') and trashed = false"
    );
    const response = await fetch(
      `${DRIVE_API_BASE}/files?q=${query}&pageSize=20&fields=files(id,name,mimeType,webViewLink,createdTime)&orderBy=modifiedTime desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Error listing drive files:', error);
    return [];
  }
}
