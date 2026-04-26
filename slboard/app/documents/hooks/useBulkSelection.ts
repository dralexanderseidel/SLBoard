import { useEffect, useRef, useState } from 'react';

export type UseBulkSelectionResult = {
  selectedIds: string[];
  editableSelectedIds: string[];
  blockedSelectedIds: string[];
  bulkCapabilitiesLoading: boolean;
  toggleSelectAll: (allVisibleIds: string[]) => void;
  toggleSelectOne: (id: string) => void;
  clearSelection: () => void;
};

/**
 * Manages document row selection and loads editable/blocked capabilities
 * from the server whenever the selection changes.
 *
 * Pass an optional `onClearResults` callback to reset bulk-result messages
 * whenever the selection changes.
 */
export function useBulkSelection(onClearResults: () => void = () => {}): UseBulkSelectionResult {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editableSelectedIds, setEditableSelectedIds] = useState<string[]>([]);
  const [blockedSelectedIds, setBlockedSelectedIds] = useState<string[]>([]);
  const [bulkCapabilitiesLoading, setBulkCapabilitiesLoading] = useState(false);
  const capabilitiesSeqRef = useRef(0);

  useEffect(() => {
    if (selectedIds.length === 0) {
      setEditableSelectedIds([]);
      setBlockedSelectedIds([]);
      setBulkCapabilitiesLoading(false);
      return;
    }

    const seq = ++capabilitiesSeqRef.current;
    setBulkCapabilitiesLoading(true);

    const run = async () => {
      try {
        const res = await fetch('/api/documents/bulk-capabilities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds }),
        });
        const data = (await res.json()) as { editableIds?: string[]; blockedIds?: string[] };
        if (seq !== capabilitiesSeqRef.current) return;
        if (!res.ok) {
          setEditableSelectedIds([]);
          setBlockedSelectedIds([]);
          return;
        }
        setEditableSelectedIds(data.editableIds ?? []);
        setBlockedSelectedIds(data.blockedIds ?? []);
      } catch {
        if (seq !== capabilitiesSeqRef.current) return;
        setEditableSelectedIds([]);
        setBlockedSelectedIds([]);
      } finally {
        if (seq === capabilitiesSeqRef.current) setBulkCapabilitiesLoading(false);
      }
    };

    void run();
  }, [selectedIds]);

  const toggleSelectAll = (allVisibleIds: string[]) => {
    onClearResults();
    setSelectedIds((prev) => (prev.length === allVisibleIds.length ? [] : [...allVisibleIds]));
  };

  const toggleSelectOne = (id: string) => {
    onClearResults();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const clearSelection = () => setSelectedIds([]);

  return {
    selectedIds,
    editableSelectedIds,
    blockedSelectedIds,
    bulkCapabilitiesLoading,
    toggleSelectAll,
    toggleSelectOne,
    clearSelection,
  };
}
