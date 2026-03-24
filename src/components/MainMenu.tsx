import { useState, useEffect } from 'preact/hooks';
import { Camera, CameraResultType } from '@capacitor/camera';
import { apiSignal } from '../store.ts';
import { db } from '../db.ts';

interface MainMenuProps {
  onClose: () => void;
}

export function MainMenu({ onClose }: MainMenuProps) {
  const [view, setView] = useState<'menu' | 'about'>('menu');
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [estimatedSizeMb, setEstimatedSizeMb] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const fetchCount = async () => {
      try {
        const api = apiSignal.value;
        if (api) {
          const res = await api.getDocuments({ page_size: '1' });
          if (active) setEstimatedSizeMb(Math.round(res.count * 1.5 * 10) / 10);
        }
      } catch (err) {
        // Fallback or ignore
      }
    };
    fetchCount();
    return () => { active = false; };
  }, [apiSignal.value]);

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
      if (!String(err).includes('User cancelled')) {
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
      const result = await api.getDocuments(); 
      const onlineDocs = result.results;
      
      let count = 0;
      for (const doc of onlineDocs) {
        setStatus(`Lade Dokument ${count + 1} von ${onlineDocs.length}`);
        try {
           const blob = await api.downloadDocument(doc.id);
           await db.documents.update(doc.id, { blob });
           count++;
        } catch(e) {}
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

  const renderAbout = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.3s', paddingBottom: '2rem' }}>
      <button className="header-button" onClick={() => setView('menu')}>← Zurück</button>
      
      <div className="filter-section">
        <h3>App Version</h3>
        <p style={{ margin: 0 }}>v1.3.0 stable</p>
      </div>

      <div className="filter-section">
        <h3>Lizenzen</h3>
        <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4' }}>
          Diese App basiert auf Open-Source-Software:<br/>
          • Paperless-ngx Logo (GPLv3)<br/>
          • Preact & Signals (MIT)<br/>
          • Capacitor (MIT) & Plugins (MIT/ISC)<br/>
          • PDF.js (Apache 2.0)<br/>
          • Dexie.js (Apache 2.0)<br/>
          • Lucide Icons (ISC)
        </p>
      </div>

      <div className="filter-section">
        <h3>Impressum</h3>
        <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4' }}>
          <strong>Verantwortlich gemäß § 5 TMG:</strong><br/>
          Christian Bernauer<br/>
          Dianastr. 2b<br/>
          90547 Stein<br/>
          E-Mail: christian@bernauer24.com
        </p>
      </div>

      <div className="filter-section">
        <h3>Datenschutz</h3>
        <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4' }}>
          Die Betreiber dieser App nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung. Die Nutzung dieser App ist in der Regel ohne Angabe personenbezogener Daten möglich.
        </p>
      </div>

      <div className="filter-section">
        <h3>Hinweis</h3>
        <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4' }}>
          Dies ist ein Drittanbieter-Interface für Paperless-ngx. Es besteht keine offizielle Verbindung zum Paperless-ngx Team.
        </p>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="main-menu" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{view === 'menu' ? 'Menü' : 'Über & Lizenzen'}</h2>
          <button className="close-button" onClick={onClose} disabled={uploading || downloading}>✕</button>
        </div>

        {view === 'menu' ? (
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
                <span className="icon">☁️</span> Alle offline verfügbar machen
              </button>
              <p className="menu-hint">Hinweis: Dies erfordert insgesamt ca. {estimatedSizeMb !== null ? estimatedSizeMb : '?'} MB Speicherplatz auf deinem Gerät.</p>
            </div>
            <button className="menu-button" onClick={() => setView('about')} style={{ marginTop: 'auto', opacity: 0.7 }}>
              <span className="icon">ℹ️</span> Über & Lizenzen
            </button>
          </div>
        ) : renderAbout()}
        
        {status && (
          <div className="menu-status-bar">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
