import type { SteeringAnalysis } from '@/lib/steeringAnalysisV2';

export type { SteeringAnalysis };
export type DocumentDetail = {
  id: string;
  title: string;
  document_type_code: string;
  created_at: string;
  archived_at?: string | null;
  status: string;
  protection_class_id: number;
  reach_scope: 'intern' | 'extern';
  gremium: string | null;
  responsible_unit: string;
  participation_groups: string[] | null;
  legal_reference: string | null;
  summary: string | null;
  review_date: string | null;
  summary_updated_at?: string | null;
  steering_analysis?: SteeringAnalysis | null;
  steering_analysis_updated_at?: string | null;
  schulentwicklung_primary_field?: string | null;
  schulentwicklung_fields?: string[] | null;
  steering_todos?: SteeringTodosResult | null;
  steering_todos_updated_at?: string | null;
  current_version_id?: string | null;
};

export type VersionInfo = {
  id: string;
  version_number: string;
  created_at: string;
  file_uri: string;
  mime_type: string;
};

export type VersionRow = {
  id: string;
  version_number: string;
  created_at: string;
  comment: string | null;
  mime_type: string | null;
  is_current: boolean;
};

export type AuditEntry = {
  user_email: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
};

/** API-Shape von /api/documents/[id]/comments und detail.comments */
export type DocumentComment = {
  id: string;
  authorEmail: string;
  authorLabel: string | null;
  authorAppUserId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type SteeringTodoItem = {
  titel: string;
  beschreibung?: string;
  prioritaet?: 'niedrig' | 'mittel' | 'hoch';
  verantwortlich_hint?: string;
  frist_hint?: string;
};

export type SteeringTodosResult = {
  aufgaben: SteeringTodoItem[];
  hinweis?: string;
};

