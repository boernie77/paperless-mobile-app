import { useState } from 'preact/hooks';
import { Camera, CameraResultType } from '@capacitor/camera';
import { apiSignal } from '../store.ts';
import { db } from '../db.ts';

interface MainMenuProps {
  onClose: () => void;
}

export function MainMenu({ onClose }: MainMenuProps) {
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const takePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri
      });

      if (image.webPath) {
        setUploading(true);
        setStatus('Scan wird hochgeladen...');
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        
        const api = apiSignal.value;
        if (api) {
          const fileName = `Scan_${new Date().getTime()}.jpg`;
          await api.uploadDocument(blob, fileName);
          setStatus('Erfolgreich hochgeladen!');
        }
      }
    } catch (err) {
      console.error(err);
      if (String(err).includes('User cancelled')) {
        // User just closed camera, do nothing
      } else {
        setStatus('Fehler beim Scan-Upload.');
      }
    } finally {
      setTimeout(() => setStatus(''), 3000);
      setUploading(false);
    }
  };

  const importFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        setUploading(true);
        setStatus(`Lade '${file.name}' hoch...`);
        try {
          const api = apiSignal.value;
          if (api) {
            await api.uploadDocument(file, file.name || `Import_${new Date().getTime()}`);
            setStatus('Erfolgreich importiert!');
          }
        } catch (err) {
          setStatus('Fehler beim Importieren.');
        } finally {
          setTimeout(() => setStatus(''), 3000);
          setUploading(false);
        }
      }
    };
    input.click();
  };

  const downloadAll = async () => {
    const api = apiSignal.value;
    if (!api) return;
    
    setDownloading(true);
    setStatus('Starte Offline-Synchronisation...');
    
    try {
      const result = await api.getDocuments(); // Default page size currently limited, should be increased or paginated for full sync
      const onlineDocs = result.results;
      
      let count = 0;
      for (const doc of onlineDocs) {
        setStatus(`Lade Dokument ${count + 1} von ${onlineDocs.length}`);
        try {
          const blob = await api.downloadDocument(doc.id);
          await db.documents.update(doc.id, { blob });
          count++;
        } catch (e) {
          console.error("Failed to download", doc.id, e);
        }
      }
      
      setStatus(`Erfolgreich: ${count} Dokumente offline gespeichert.`);
    } catch (err) {
      setStatus('Synchronisation fehlgeschlagen.');
    } finally {
      setTimeout(() => {
        setStatus('');
        setDownloading(false);
      }, 3000);
    }
  };

  // Schätzung für Offline Speicher: 1.5MB pro Dokument grob gepeilt
  const estimatedSizeMb = 15; // Wir nehmen an, dass es im Schnitt 15MB sind für eine kleine Instanz, kann später dynamisch berechnet werden.

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="main-menu" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Menü</h2>
          <button className="text-button" onClick={onClose} disabled={uploading || downloading}>✕</button>
        </div>

        <div className="menu-items">
          <button className="menu-button" onClick={takePhoto} disabled={uploading || downloading}>
            <span className="icon">📷</span> Foto aufnehmen
          </button>
          <button className="menu-button" onClick={importFile} disabled={uploading || downloading}>
            <span className="icon">📄</span> Datei importieren
          </button>
          <hr className="menu-divider" />
          <div className="menu-info-block">
            <button className="menu-button" onClick={downloadAll} disabled={uploading || downloading}>
              <span className="icon">☁️</span> Alle Dokumente offline speichern
            </button>
            <p className="menu-hint">Hinweis: Dies erfordert ca. 1-2 MB Speicherplatz pro Dokument in der lokalen Datenbank.</p>
          </div>
        </div>
        
        {status && (
          <div className="menu-status-bar">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
