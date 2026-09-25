export type QuestionType =
  | 'TEXT'
  | 'PARAGRAPH'
  | 'EMAIL'
  | 'RADIO'
  | 'CHECKBOX'
  | 'DROPDOWN'
  | 'SCALE'
  | 'FILE_UPLOAD';

export interface FormQuestionDraft {
  id?: string;
  title: string;
  description?: string;
  required: boolean;
  type: QuestionType;
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  lowLabel?: string;
  highLabel?: string;
  allowedFileTypes?: string[];
  maxFileSizeMb?: number;
}

export interface FormDraft {
  title: string;
  description: string;
  questions: FormQuestionDraft[];
}

export interface GoogleFormItem {
  itemId: string;
  title: string;
  description?: string;
  questionItem?: {
    question: {
      questionId: string;
      required?: boolean;
      textQuestion?: {
        paragraph?: boolean;
      };
      choiceQuestion?: {
        type: 'RADIO' | 'CHECKBOX' | 'DROP_DOWN';
        options: { value: string }[];
      };
      scaleQuestion?: {
        low: number;
        high: number;
        lowLabel?: string;
        highLabel?: string;
      };
    };
  };
}

export interface GoogleFormData {
  formId: string;
  info: {
    title: string;
    description?: string;
    documentTitle?: string;
  };
  items?: GoogleFormItem[];
  responderUri?: string;
  editUri?: string;
  linkedSpreadsheetId?: string;
  linkedSpreadsheetUrl?: string;
}

export interface FormAnswer {
  questionId: string;
  textAnswers?: {
    answers: { value: string }[];
  };
}

export interface FormResponseItem {
  responseId: string;
  createTime: string;
  lastSubmittedTime: string;
  answers?: Record<string, FormAnswer>;
}

export interface FormResponsesResult {
  responses: FormResponseItem[];
  nextPageToken?: string;
}
