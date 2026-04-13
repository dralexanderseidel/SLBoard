'use client';

import React from 'react';
import type { UseDocumentFiltersResult } from '../hooks/useDocumentFilters';

const STATUS_CHIPS = [
  { value: 'ENTWURF', label: 'Entwurf' },
  { value: 'FREIGEGEBEN', label: 'Freigegeben' },
  { value: 'BESCHLUSS', label: 'Beschluss' },
  { value: 'VEROEFFENTLICHT', label: 'Veröffentlicht' },
];

const PARTICIPATION_SUGGESTIONS = [
  'Schulkonferenz', 'Lehrerkonferenz', 'Fachkonferenz',
  'Steuergruppe', 'Arbeitsgruppe', 'Schulpflegschaft', 'Schülervertretung',
];

const FALLBACK_TYPE_OPTIONS = [
  { code: 'PROTOKOLL', label: 'Protokoll' },
  { code: 'BESCHLUSSVORLAGE', label: 'Beschlussvorlage' },
  { code: 'KONZEPT', label: 'Konzept' },
  { code: 'CURRICULUM', label: 'Curriculum' },
  { code: 'VEREINBARUNG', label: 'Vereinbarung' },
  { code: 'ELTERNBRIEF', label: 'Elternbrief' },
  { code: 'RUNDSCHREIBEN', label: 'Rundschreiben' },
  { code: 'SITUATIVE_REGELUNG', label: 'Situative Regelung' },
];

const FALLBACK_UNIT_OPTIONS = [
  'Schulleitung', 'Sekretariat', 'Fachschaft Deutsch',
  'Fachschaft Mathematik', 'Fachschaft Englisch', 'Steuergruppe', 'Lehrkräfte',
];

type Props = Pick<
  UseDocumentFiltersResult,
  | 'searchInput' | 'setSearchInput' | 'applySearch' | 'searchQuery'
  | 'typeFilter' | 'setTypeFilter'
  | 'responsibleUnitFilter' | 'setResponsibleUnitFilter'
  | 'statusFilters' | 'toggleStatusChip'
  | 'protectionFilter' | 'setProtectionFilter'
  | 'reachScopeFilters' | 'toggleReachScopeChip'
  | 'participationInput' | 'setParticipationFilter'
  | 'gremiumInput' | 'setGremiumFilter'
  | 'reviewFilter' | 'setReviewFilter'
  | 'summaryFilter' | 'setSummaryFilter'
  | 'steeringFilter' | 'setSteeringFilter'
  | 'showAdvancedFilters' | 'setShowAdvancedFilters'
> & {
  typeOptions: Array<{ code: string; label: string }>;
  responsibleUnitOptions: string[];
  onResetFilters: () => void;
};

export function DocumentFilterBar({
  searchInput, setSearchInput, applySearch, searchQuery,
  typeFilter, setTypeFilter,
  responsibleUnitFilter, setResponsibleUnitFilter,
  statusFilters, toggleStatusChip,
  protectionFilter, setProtectionFilter,
  reachScopeFilters, toggleReachScopeChip,
  participationInput, setParticipationFilter,
  gremiumInput, setGremiumFilter,
  reviewFilter, setReviewFilter,
  summaryFilter, setSummaryFilter,
  steeringFilter, setSteeringFilter,
  showAdvancedFilters, setShowAdvancedFilters,
  typeOptions, responsibleUnitOptions,
  onResetFilters,
}: Props) {
  const inputClass = 'h-8 rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100';
  const selectClass = inputClass;

  return (
    <>
      {/* Suchfeld + Basisfilter */}
      <section className="flex flex-wrap items-end gap-4">
        <div className="flex flex-1 flex-col gap-1 min-w-[200px]">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Suche</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); applySearch(); }
              }}
              placeholder="z. B. Handynutzung, Medienwoche, Schulkonferenz…"
              className={`${inputClass} w-full`}
            />
            <button
              type="button"
              onClick={applySearch}
              className="h-8 rounded bg-blue-600 px-3 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              Suchen
            </button>
          </div>
          {searchQuery && (
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              Aktuelle Suche: <span className="font-medium">{searchQuery}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Dokumenttyp</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectClass}>
            <option value="">Alle</option>
            {(typeOptions.length > 0 ? typeOptions : FALLBACK_TYPE_OPTIONS).map((t) => (
              <option key={t.code} value={t.code}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Verantwortlich</label>
          <select value={responsibleUnitFilter} onChange={(e) => setResponsibleUnitFilter(e.target.value)} className={selectClass}>
            <option value="">Alle</option>
            {(responsibleUnitOptions.length > 0 ? responsibleUnitOptions : FALLBACK_UNIT_OPTIONS).map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Filter-Steuerung */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="h-8 rounded border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
        >
          Erweiterte Filter {showAdvancedFilters ? 'einklappen' : 'ausklappen'}
        </button>
        <button
          type="button"
          onClick={onResetFilters}
          className="h-8 rounded border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
        >
          Filter zurücksetzen
        </button>
      </div>

      {/* Erweiterte Filter */}
      {showAdvancedFilters && (
        <section className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-end gap-4">

            <div className="flex flex-col gap-1 min-w-[240px] flex-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Status (Mehrfachauswahl)</label>
              <div className="flex flex-wrap gap-2">
                {STATUS_CHIPS.map((chip) => {
                  const active = statusFilters.includes(chip.value);
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => toggleStatusChip(chip.value)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                        active
                          ? 'border-blue-300 bg-blue-50 text-zinc-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-zinc-50'
                          : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Schutzklasse</label>
              <select value={protectionFilter} onChange={(e) => setProtectionFilter(e.target.value)} className={selectClass}>
                <option value="">Alle</option>
                <option value="1">1 – Öffentlich / unkritisch</option>
                <option value="2">2 – Verwaltung/Sekretariat + Schulleitung</option>
                <option value="3">3 – Nur Schulleitung</option>
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-[240px] flex-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Reichweite</label>
              <div className="flex flex-wrap gap-2">
                {(['intern', 'extern'] as const).map((scope) => {
                  const active = reachScopeFilters.includes(scope);
                  return (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => toggleReachScopeChip(scope)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                        active
                          ? 'border-violet-300 bg-violet-50 text-zinc-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-zinc-50'
                          : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {scope}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1 min-w-[240px] flex-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Beteiligung enthält</label>
              <input
                list="participation_suggestions"
                value={participationInput}
                onChange={(e) => setParticipationFilter(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                placeholder="z. B. Schulkonferenz (auch mehrere: A, B)"
                className={inputClass}
              />
              <datalist id="participation_suggestions">
                {PARTICIPATION_SUGGESTIONS.map((g) => <option key={g} value={g} />)}
              </datalist>
            </div>

            <div className="flex flex-col gap-1 min-w-[240px] flex-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Beschlussgremium</label>
              <input
                type="text"
                value={gremiumInput}
                onChange={(e) => setGremiumFilter(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                placeholder="z. B. Schulkonferenz"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Evaluation/Wiedervorlage</label>
              <select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)} className={selectClass}>
                <option value="">Alle</option>
                <option value="overdue">überfällig</option>
                <option value="set">Datum gesetzt</option>
                <option value="empty">Datum leer</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">KI-Zusammenfassung</label>
              <select value={summaryFilter} onChange={(e) => setSummaryFilter(e.target.value)} className={selectClass}>
                <option value="">Alle</option>
                <option value="has">vorhanden</option>
                <option value="missing">fehlt</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Steuerungsanalyse</label>
              <select value={steeringFilter} onChange={(e) => setSteeringFilter(e.target.value)} className={`${selectClass} min-w-[220px]`}>
                <option value="">Alle</option>
                <option value="has">vorhanden</option>
                <option value="missing">fehlt</option>
                <option value="low">niedrig (Ampel grün)</option>
                <option value="medium">mittel (Ampel gelb)</option>
                <option value="high">hoch (Ampel rot)</option>
              </select>
            </div>

          </div>
        </section>
      )}
    </>
  );
}
