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

  const updateStats = async () => {
    try {
      const count = await db.documents.where('is_offline').equals(1).count();
      setOfflineCount(count);
    } catch (e) {
      console.error('UpdateStats failed:', e);
    }
  };

  useEffect(() => {
    let active = true;
    const fetchSettings = async () => {
      try {
        await updateStats();
        
        const setting = await db.settings.get('auto_download');
        if (active) setAutoDownload(!!setting?.value);

        const api = apiSignal.value;
        if (api) {
          const res = await api.getDocuments({ page_size: '1' });
          if (active) setEstimatedSizeMb(Math.round(res.count * 1.5 * 10) / 10);
        }
      } catch (err) { }
    };
    fetchSettings();
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
        setStatus('Lade Foto hoch...');
        const api = apiSignal.value;
        if (!api) return;

        const response = await fetch(image.webPath);
        const blob = await response.blob();
        await api.uploadDocument(blob, `Foto ${new Date().toLocaleString()}`);
        setStatus('Erfolgreich hochgeladen!');
      }
    } catch (err) {
      console.error(err);
      setStatus('Fehler beim Upload.');
    } finally {
      setTimeout(() => setStatus(''), 3000);
      setUploading(false);
    }
  };

  const importFile = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      setUploading(true);
      setStatus('Lade Datei hoch...');
      const api = apiSignal.value;
      if (!api) return;

      try {
        await api.uploadDocument(file, file.name);
        setStatus('Datei erfolgreich hochgeladen!');
      } catch (err) {
        setStatus('Fehler beim Upload.');
      } finally {
        setTimeout(() => setStatus(''), 3000);
        setUploading(false);
      }
    };
    input.click();
  };

  const downloadAll = async (selectionOnly = false) => {
    const api = apiSignal.value;
    if (!api) return;

    setDownloading(true);
    setStatus('Vorbereiten...');

    try {
      let allDocs = [];
      if (selectionOnly) {
         const res = await api.getDocuments(filterSignal.value);
         allDocs = res.results;
      } else {
         allDocs = await api.getAllDocuments();
      }

      let count = 0;
      let skipped = 0;
      for (const doc of allDocs) {
        setStatus(`Synchronisierung: ${count + 1} von ${allDocs.length} (Fehlgeschlagen: ${skipped})`);
        try {
           const existing = await db.documents.get(doc.id);
           if (existing?.blob && existing?.thumbnailBlob) {
             if (existing.is_offline !== 1) await db.documents.update(doc.id, { is_offline: 1 });
             count++;
             continue;
           }

           const [blob, thumbnailBlob] = await Promise.all([
             api.downloadDocument(doc.id),
             api.getThumbnailBlob(doc.id)
           ]);
           await db.documents.put({ ...doc, blob, thumbnailBlob, is_offline: 1 });
           count++;
           updateStats();
        } catch(e) {
           console.error(`Failed to download doc ${doc.id}`, e);
           skipped++;
        }
      }
      
      setStatus(`Erfolgreich: ${count} Dokumente offline. Übersprungen: ${skipped}.`);
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

  const clearOfflineCache = async () => {
    if (!confirm('Möchtest du wirklich alle Offline-Dateien vom Gerät löschen? (Die Dokumente bleiben auf dem Server erhalten)')) return;
    
    setStatus('Lösche Cache...');
    try {
      await db.documents.where('is_offline').equals(1).modify({
        blob: undefined,
        thumbnailBlob: undefined,
        is_offline: 0
      });
      await updateStats();
      setStatus('Cache erfolgreich geleert!');
    } catch (e) {
      console.error(e);
      setStatus('Fehler beim Löschen des Cache.');
    } finally {
      setTimeout(() => setStatus(''), 3000);
    }
  };

  const renderAbout = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.3s', paddingBottom: '2rem' }}>
      <button className="header-button" onClick={() => setView('menu')}>← Zurück</button>

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
          Die Betreiber dieser App nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.
        </p>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="main-menu" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2>{view === 'menu' ? 'Menü' : 'Über & Lizenzen'}</h2>
            <span style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '0.2rem' }}>v1.0.1</span>
          </div>
          <button className="close-button" onClick={onClose} disabled={uploading || downloading}>✕</button>
        </div>

        <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {view === 'menu' ? (
            <div className="menu-items" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                <button className="menu-button" onClick={clearOfflineCache} disabled={uploading || downloading || offlineCount === 0} style={{ opacity: 0.8 }}>
                  <span className="icon">🗑️</span> Offline-Dateien löschen
                </button>
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
