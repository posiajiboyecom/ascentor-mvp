// ============================================================
// SURVEY TYPES — Ascentor
// ============================================================

export type QuestionType = 'radio' | 'checkbox' | 'scale' | 'textarea' | 'text';

export interface SurveyQuestion {
  id: string;
  type: QuestionType;
  required: boolean;
  text: string;
  hint?: string;
  placeholder?: string;
  options?: string[];
  allowCustom?: boolean;
}

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  is_published: boolean;
  questions: SurveyQuestion[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type SurveyAnswers = Record<string, string | string[] | number>;

export interface SurveyResponse {
  id: string;
  survey_id: string;
  user_id: string | null;
  answers: SurveyAnswers;
  metadata: { duration_seconds?: number } | null;
  submitted_at: string;
}

export interface AnalysisInsight {
  headline: string;
  detail: string;
}

export interface QuestionAnalysis {
  question_id: string;
  question_text: string;
  type: QuestionType;
  // For choice questions
  distribution?: { label: string; count: number; pct: number }[];
  // For text questions
  themes?: string[];
  sample_responses?: string[];
  // For scale questions
  average?: number;
  distribution_1_10?: number[];
}

export interface SurveyAnalysis {
  id: string;
  survey_id: string;
  insights: {
    total_responses: number;
    completion_rate: number;
    avg_duration_seconds: number;
    willingness_to_pay_pct: number;
    key_insights: AnalysisInsight[];
    per_question: QuestionAnalysis[];
  };
  generated_at: string;
}
