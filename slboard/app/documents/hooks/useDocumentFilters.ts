import { useState } from 'react';

export type DocumentFilters = {
  typeFilter: string;
  responsibleUnitFilter: string;
  statusFilters: string[];
  protectionFilter: string;
  reachScopeFilters: Array<'intern' | 'extern'>;
  participationFilter: string;
  gremiumFilter: string;
  reviewFilter: string;
  summaryFilter: string;
  steeringFilter: string;
  searchQuery: string;
};

export type UseDocumentFiltersResult = DocumentFilters & {
  searchInput: string;
  showAdvancedFilters: boolean;
  setTypeFilter: (v: string) => void;
  setResponsibleUnitFilter: (v: string) => void;
  setStatusFilters: React.Dispatch<React.SetStateAction<string[]>>;
  toggleStatusChip: (v: string) => void;
  setProtectionFilter: (v: string) => void;
  toggleReachScopeChip: (scope: 'intern' | 'extern') => void;
  setParticipationFilter: (v: string) => void;
  setGremiumFilter: (v: string) => void;
  setReviewFilter: (v: string) => void;
  setSummaryFilter: (v: string) => void;
  setSteeringFilter: (v: string) => void;
  setSearchInput: (v: string) => void;
  applySearch: () => void;
  setShowAdvancedFilters: (v: boolean) => void;
  resetFilters: () => void;
};

export function useDocumentFilters(): UseDocumentFiltersResult {
  const [typeFilter, setTypeFilter] = useState('');
  const [responsibleUnitFilter, setResponsibleUnitFilter] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [protectionFilter, setProtectionFilter] = useState('');
  const [reachScopeFilters, setReachScopeFilters] = useState<Array<'intern' | 'extern'>>([]);
  const [participationFilter, setParticipationFilter] = useState('');
  const [gremiumFilter, setGremiumFilter] = useState('');
  const [reviewFilter, setReviewFilter] = useState('');
  const [summaryFilter, setSummaryFilter] = useState('');
  const [steeringFilter, setSteeringFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const toggleStatusChip = (value: string) =>
    setStatusFilters((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  const toggleReachScopeChip = (scope: 'intern' | 'extern') =>
    setReachScopeFilters((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));

  const applySearch = () => setSearchQuery(searchInput.trim());

  const resetFilters = () => {
    setTypeFilter('');
    setResponsibleUnitFilter('');
    setStatusFilters([]);
    setProtectionFilter('');
    setReachScopeFilters([]);
    setParticipationFilter('');
    setGremiumFilter('');
    setReviewFilter('');
    setSummaryFilter('');
    setSteeringFilter('');
    setSearchInput('');
    setSearchQuery('');
  };

  return {
    typeFilter, setTypeFilter,
    responsibleUnitFilter, setResponsibleUnitFilter,
    statusFilters, setStatusFilters, toggleStatusChip,
    protectionFilter, setProtectionFilter,
    reachScopeFilters, toggleReachScopeChip,
    participationFilter, setParticipationFilter,
    gremiumFilter, setGremiumFilter,
    reviewFilter, setReviewFilter,
    summaryFilter, setSummaryFilter,
    steeringFilter, setSteeringFilter,
    searchInput, setSearchInput, applySearch,
    searchQuery,
    showAdvancedFilters, setShowAdvancedFilters,
    resetFilters,
  };
}
