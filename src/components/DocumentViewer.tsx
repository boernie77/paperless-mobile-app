import { useEffect, useState } from 'preact/hooks';
import { apiSignal } from '../store.ts';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';

interface DocumentViewerProps {
  document: any;
  onClose: () => void;
}

export function DocumentViewer({ document, onClose }: DocumentViewerProps) {
  const [contentUrl, setContentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('Lade Dokument...');

  useEffect(() => {
    let active = true;

    const loadDocument = async () => {
      const api = apiSignal.value;
      if (!api && !document.blob) {
        if (active) { setStatus('Keine Internetverbindung und nicht offline verfügbar.'); setLoading(false); }
        return;
      }

      try {
        const blob = document.blob || await api!.downloadDocument(document.id);
        
        // Versuchen, die Datei nativ per FileOpener zu öffnen (Vermeidung von Android-Iframe Problemen mit PDFs)
        if (blob.type === 'application/pdf' || document.title.toLowerCase().endsWith('.pdf')) {
          if (active) setStatus('Bereite Öffnen auf dem Gerät vor...');
          
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const base64data = (reader.result as string).split(',')[1];
            // Wir nutzen den Titel für den Dateinamen, um Umlaute/Leerzeichen sicher zu maskieren
            const safeTitle = document.title.replace(/[^a-zA-Z0-9-_\.]/g, '_').substring(0, 50);
            const fileName = `doc_${document.id}_${safeTitle}.pdf`;
            
            try {
              const fileData = await Filesystem.writeFile({
                path: fileName,
                data: base64data,
                directory: Directory.Cache
              });
              
              await FileOpener.open({
                filePath: fileData.uri,
                contentType: 'application/pdf'
              });
              
              // Schließe den Viewer, da die echte App sich nun darübergelegt hat
              if (active) onClose();
            } catch (err) {
              console.error('FileOpener error', err);
              if (active) { setStatus('Fehler beim Öffnen in einer PDF-App.'); setLoading(false); }
            }
          };
        } else {
          // Fallback (z.B. Bilder) können im Iframe/Tag gerendert werden
          const url = URL.createObjectURL(blob);
          if (active) { setContentUrl(url); setLoading(false); }
        }
      } catch (err) {
        console.error("Failed to fetch document", err);
        if (active) { setStatus('Dokument konnte nicht geladen werden.'); setLoading(false); }
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
        {loading && <div className="loading">{status}</div>}
        {!loading && contentUrl && (
          <iframe 
            src={contentUrl} 
            className="viewer-iframe" 
            title={document.title} 
          />
        )}
        {!loading && !contentUrl && (
          <div className="error-message">{status}</div>
        )}
      </div>
    </div>
  );
}
