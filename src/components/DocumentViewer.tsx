import { useEffect, useState } from 'preact/hooks';
import { apiSignal } from '../store.ts';
import { db } from '../db.ts';

interface DocumentViewerProps {
  document: any;
  onClose: () => void;
}

export function DocumentViewer({ document, onClose }: DocumentViewerProps) {
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadDocument = async () => {
      // Offline fallback check first
      if (document.blob) {
        const url = URL.createObjectURL(document.blob);
        if (active) { setContentUrl(url); setLoading(false); }
        return;
      }

      const api = apiSignal.value;
      if (!api) {
        if (active) setLoading(false); // No internet and no offline copy
        return;
      }

      try {
        // Fetch on-demand
        const blob = await api.downloadDocument(document.id);
        const url = URL.createObjectURL(blob);
        if (active) { setContentUrl(url); setLoading(false); }
      } catch (err) {
        console.error("Failed to fetch document", err);
        if (active) setLoading(false);
      }
    };

    loadDocument();

    return () => {
      active = false;
      if (contentUrl) {
        URL.revokeObjectURL(contentUrl);
      }
    };
  }, [document.id, document.blob]);

  return (
    <div className="viewer-modal">
      <div className="viewer-header">
        <button className="text-button" onClick={onClose}>← Zurück</button>
        <span className="viewer-title">{document.title}</span>
      </div>
      <div className="viewer-content">
        {loading && <div className="loading">Lade Dokument...</div>}
        {!loading && contentUrl && (
          <iframe 
            src={contentUrl} 
            className="viewer-iframe" 
            title={document.title} 
          />
        )}
        {!loading && !contentUrl && (
          <div className="error-message">Dokument konnte nicht geladen werden.</div>
        )}
      </div>
    </div>
  );
}
