import type { DocumentListItem, SortField } from '../types';

export type RowActions = {
  handleRowWorkflowStep: (id: string, newStatus: string) => Promise<void>;
  handleRowDelete: (id: string) => Promise<void>;
  handleRowArchive: (id: string) => Promise<void>;
  handleRowRestore: (id: string) => Promise<void>;
};

export type DocViewSharedProps = {
  displayedDocs: DocumentListItem[];
  selectedSet: ReadonlySet<string>;
  toggleSelectOne: (id: string) => void;
  archiveView: boolean;
  rowActionLoadingId: string | null;
  isBusy: boolean;
  docTypeLabel: (code: string) => string;
  rowActions: RowActions;
};

export type DocTableViewProps = DocViewSharedProps & {
  allSelected: boolean;
  toggleSelectAll: () => void;
  cycleSort: (field: SortField) => void;
  sortIndicator: (field: SortField) => string | null;
};
