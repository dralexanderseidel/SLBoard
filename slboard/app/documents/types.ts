export type DocumentListItem = {
  id: string;
  title: string;
  document_type_code: string;
  created_at: string;
  status: string;
  protection_class_id: number;
  reach_scope?: 'intern' | 'extern' | null;
  gremium: string | null;
  responsible_unit: string;
  participation_groups?: string[] | null;
  summary: string | null;
  steering_analysis?: {
    gesamtbewertung?: {
      score?: 'niedriger Steuerungsbedarf' | 'mittlerer Steuerungsbedarf' | 'hoher Steuerungsbedarf' | string;
    } | null;
  } | null;
};

export type ViewMode = 'table' | 'cards' | 'compact';
export type SortField = 'created_at' | 'title' | 'document_type_code' | 'status';
export type SortDir = 'asc' | 'desc';
