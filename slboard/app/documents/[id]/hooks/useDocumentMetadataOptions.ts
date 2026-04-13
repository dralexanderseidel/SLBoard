import { useEffect, useState } from 'react';

type MetadataOptions = {
  documentTypeOptions: Array<{ code: string; label: string }>;
  responsibleUnitOptions: string[];
};

export function useDocumentMetadataOptions(): MetadataOptions {
  const [documentTypeOptions, setDocumentTypeOptions] = useState<Array<{ code: string; label: string }>>([]);
  const [responsibleUnitOptions, setResponsibleUnitOptions] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/metadata/options', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as {
          documentTypes?: Array<{ code: string; label: string }>;
          responsibleUnits?: string[];
        };
        if (Array.isArray(data.documentTypes)) setDocumentTypeOptions(data.documentTypes);
        if (Array.isArray(data.responsibleUnits)) setResponsibleUnitOptions(data.responsibleUnits);
      } catch {
        // ignore
      }
    };
    void load();
  }, []);

  return { documentTypeOptions, responsibleUnitOptions };
}
