import { useState, useEffect } from 'preact/hooks';
import { Camera, CameraResultType } from '@capacitor/camera';
import { apiSignal, logout, filterSignal } from '../store.ts';
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
  const [offlineCount, setOfflineCount] = useState<number | null>(null);
  const [autoDownload, setAutoDownload] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      try {
        // Count offline docs
        const count = await db.documents.filter(d => !!d.blob).count();
        if (active) setOfflineCount(count);
        
        // Get auto-download setting
        const setting = await db.settings.get('auto_download');
        if (active) setAutoDownload(!!setting?.value);

        const api = apiSignal.value;
        if (api) {
          const res = await api.getDocuments({ page_size: '1' });
          if (active) setEstimatedSizeMb(Math.round(res.count * 1.5 * 10) / 10);
        }
      } catch (err) {
        // Fallback or ignore
      }
    };
    fetchStats();
    return () => { active = false; };
  }, [apiSignal.value]);

  const toggleAutoDownload = async () => {
    const newValue = !autoDownload;
    setAutoDownload(newValue);
    await db.settings.put({ key: 'auto_download', value: newValue });
  };

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

  const downloadAll = async (useFilters = false) => {
    const api = apiSignal.value;
    if (!api) return;
    
    setDownloading(true);
    setStatus(useFilters ? 'Lade Auswahl herunter...' : 'Starte vollständige Synchronisation...');
    
    try {
      const allDocs: any[] = [];
      let nextUrl: string | null = 'documents/';
      
      const params: any = useFilters ? { ...filterSignal.value } : {};
      
      while (nextUrl) {
        setStatus(`Rufe Dokumentenliste ab... (${allDocs.length} gefunden)`);
        
        // Extract params from nextUrl if it's a full URL
        let fetchParams: any = {};
        if (nextUrl === 'documents/') {
          fetchParams = params;
        } else if (nextUrl.includes('?')) {
          const queryString = nextUrl.split('?')[1];
          const urlParams = new URLSearchParams(queryString);
          fetchParams = Object.fromEntries(urlParams.entries());
        }

        const result: any = await api.getDocuments(fetchParams);
        allDocs.push(...result.results);
        nextUrl = result.next;
        
        // Safety limit increased to something high but reasonable for mobile memory
        if (allDocs.length > 20000) {
           console.warn('Sync limit of 20,000 documents reached. Stopping to prevent memory issues.');
           break;
        }
      }

      let count = 0;
      for (const doc of allDocs) {
        setStatus(`Synchronisierung: ${count + 1} von ${allDocs.length}`);
        try {
           const existing = await db.documents.get(doc.id);
           if (existing?.blob && existing?.thumbnailBlob) {
             count++;
             continue;
           }

           const [blob, thumbnailBlob] = await Promise.all([
             api.downloadDocument(doc.id),
             api.getThumbnailBlob(doc.id)
           ]);
           await db.documents.put({ ...doc, blob, thumbnailBlob });
           count++;
        } catch(e) {
           console.error(`Failed to download doc ${doc.id}`, e);
        }
      }
      
      setStatus(`Erfolgreich: ${count} Dokumente offline gespeichert.`);
    } catch (err) {
      console.error(err);
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
        <p style={{ margin: 0 }}>v1.3.5 stable</p>
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

        <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {view === 'menu' ? (
            <div className="menu-items" style={{ flex: 1 }}>
              <button className="menu-button" onClick={takePhoto} disabled={uploading || downloading}>
                <span className="icon">📷</span> Foto aufnehmen
              </button>
              <button className="menu-button" onClick={importFile} disabled={uploading || downloading}>
                <span className="icon">📄</span> Datei importieren
              </button>
              <hr className="menu-divider" />
              
              <div className="menu-info-block">
                 <div className="menu-button" style={{ background: 'rgba(255, 255, 255, 0.03)', border: 'none', cursor: 'default' }}>
                   <span className="icon">📂</span> Offline verfügbar: <strong>{offlineCount ?? '...'}</strong>
                 </div>
                 <button className="menu-button" onClick={toggleAutoDownload} disabled={uploading || downloading} style={{ justifyContent: 'space-between' }}>
                   <span style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                     <span className="icon">⚡</span> Autom. Download
                   </span>
                   <span style={{ color: autoDownload ? 'var(--primary)' : 'var(--text-dim)', fontWeight: 'bold' }}>
                     {autoDownload ? 'AN' : 'AUS'}
                   </span>
                 </button>
              </div>

              <hr className="menu-divider" />
              <div className="menu-info-block">
                <button className="menu-button" onClick={() => downloadAll(false)} disabled={uploading || downloading}>
                  <span className="icon">☁️</span> Alle offline verfügbar machen
                </button>
                {Object.keys(filterSignal.value).length > 0 && (
                  <button className="menu-button" onClick={() => downloadAll(true)} disabled={uploading || downloading} style={{ background: 'rgba(59, 130, 246, 0.2)' }}>
                    <span className="icon">🔍</span> Auswahl laden
                  </button>
                )}
                <p className="menu-hint">Hinweis: Dies erfordert insgesamt ca. {estimatedSizeMb !== null ? estimatedSizeMb : '?'} MB Speicherplatz auf deinem Gerät.</p>
              </div>
              
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '1rem' }}>
                 <button className="menu-button" onClick={() => setView('about')} style={{ opacity: 0.7 }}>
                   <span className="icon">ℹ️</span> Über & Lizenzen
                 </button>
                 <button className="menu-button logout-btn" onClick={logout} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                   <span className="icon">🚪</span> Abmelden
                 </button>
              </div>
            </div>
          ) : renderAbout()}
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
