export type AppUser = {
  id: string;
  username: string;
  full_name: string;
  email: string;
  org_unit: string;
  school_number: string | null;
  created_at: string;
  roles: string[];
  /** true = Anmeldung mit Admin-Passwort, Wechsel noch offen */
  password_change_required?: boolean;
  /** false = bei Schulregistrierung angelegter Admin (nicht löschbar) */
  deletable?: boolean;
};

export type DocumentTypeOption = {
  code: string;
  label: string;
  active: boolean;
  sort_order: number;
  draft_audience?: string | null;
  draft_tone?: string | null;
  draft_format_hint?: string | null;
};
export type ResponsibleUnitOption = { name: string; active: boolean; sort_order: number };
export type PromptUseCase = 'qa' | 'summary' | 'steering' | 'todos';

export type PromptTemplateConfig = {
  use_case: PromptUseCase;
  system_locked: string;
  user_locked: string;
  system_editable: string;
  user_editable: string;
  version: number;
  updated_at: string | null;
};

export type AdminStats = {
  scope: 'school';
  schoolNumber: string;
  userCount: number;
  documentTotal: number;
  documentActive: number;
  documentArchived: number;
  documentPublished: number;
  llmCallsTotal: number;
  llmCallsLast7Days: number;
  llmCallsThisMonth: number;
  llmCallsByDay: { date: string; count: number }[];
  aiQueriesTotal: number;
  aiQueriesLast7Days: number;
  aiQueriesByDay: { date: string; count: number }[];
  quotaMaxUsers: number | null;
  quotaMaxDocuments: number | null;
  quotaMaxAiQueriesPerMonth: number | null;
};

export const AVAILABLE_ROLES = [
  'SCHULLEITUNG', 'SEKRETARIAT', 'VERWALTUNG',
  'KOORDINATION', 'LEHRKRAFT', 'FACHVORSITZ', 'STEUERGRUPPE',
] as const;

export function formatStatsDayUtc(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((x) => Number(x));
  if (!y || !m || !d) return ymd;
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
