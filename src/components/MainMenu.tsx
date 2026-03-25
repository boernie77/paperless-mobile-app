import { useState, useEffect } from 'preact/hooks';
import { Camera, CameraResultType } from '@capacitor/camera';
import { authState, apiSignal, logout as logoutStore, filterSignal, failedDocsSignal, duplicateDocsSignal } from '../store.ts';
import { db } from '../db.ts';

interface MainMenuProps {
  onClose: () => void;
}

export function MainMenu({ onClose }: MainMenuProps) {
  const [autoDownload, setAutoDownload] = useState(false);
  const [failedDocs, setFailedDocs] = useState<any[]>([]);
  const [duplicateDocs, setDuplicateDocs] = useState<any[]>([]);
  const [syncReport, setSyncReport] = useState<any>(null);
  const [view, setView] = useState<'menu' | 'about' | 'report'>('menu');
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [estimatedSizeMb, setEstimatedSizeMb] = useState<number | null>(null);
  const [offlineCount, setOfflineCount] = useState<number | null>(null);

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
      setStatus('Lade Dokumentenliste...');
      const apiResult = selectionOnly ? { results: filterSignal.value, count: (filterSignal.value as any[]).length } : await api.getAllDocuments();
      let allDocs = apiResult.results;
      const totalServerCount = apiResult.count;
      
      // Deduplicate by ID and track duplicates
      const uniqueDocsMap = new Map();
      const duplicateList: any[] = [];
      
      (Array.isArray(allDocs) ? allDocs : []).forEach((d: any) => {
        if (d && d.id) {
          if (uniqueDocsMap.has(d.id)) {
            duplicateList.push(d);
          } else {
            uniqueDocsMap.set(d.id, d);
          }
        }
      });
      
      const uniqueDocs = Array.from(uniqueDocsMap.values());
      const totalToSync = uniqueDocs.length;
      let count = 0;
      let skipped = 0;
      const failures: any[] = [];
      
      setFailedDocs([]);
      setDuplicateDocs(duplicateList);
      setSyncReport(null);

      for (const doc of uniqueDocs) {
        setStatus(`Synchronisierung: ${count + 1 + skipped} von ${totalToSync} (Fehlgeschlagen: ${failures.length})`);
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
           failures.push({ 
             id: doc.id, 
             title: doc.title, 
             reason: e instanceof Error ? e.message : 'Unbekannter Fehler' 
           });
        }
      }
      
      await updateStats();
      const finalCount = await db.documents.where('is_offline').equals(1).count();
      setOfflineCount(finalCount);
      
      setFailedDocs(failures);
      setSyncReport({
        total: totalToSync,
        serverTotal: totalServerCount,
        success: count,
        failed: failures.length,
        duplicates: duplicateList.length
      });
      setView('report');
      setStatus('');
    } catch (err) {
      console.error(err);
      setStatus('Synchronisation fehlgeschlagen.');
    } finally {
      setDownloading(false);
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

  const renderSyncReport = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeIn 0.3s', paddingBottom: '2rem' }}>
      <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: syncReport?.failed > 0 ? '#ef4444' : 'var(--primary)' }}>
          {syncReport?.failed > 0 ? 'Synchronisierung unvollständig' : 'Synchronisierung abgeschlossen'}
        </h3>
        <p style={{ margin: 0, opacity: 0.8 }}>
          {syncReport?.success} von {syncReport?.total} erfolgreich gespeichert.
        </p>
        {(syncReport?.total !== syncReport?.serverTotal) && (
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#fb923c' }}>
            ⚠️ Hinweis: Server meldet {syncReport?.serverTotal} Dokumente, aber nur {syncReport?.total} einzigartige IDs gefunden.
          </p>
        )}
      </div>

      {(failedDocs.length > 0 || duplicateDocs.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <h4 style={{ margin: '0.5rem 0' }}>Details zu Abweichungen:</h4>
          <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {failedDocs.map(f => (
              <div key={`fail-${f.id}`} onClick={onClose} style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <div style={{ fontWeight: 'bold', color: '#ef4444' }}>❌ {f.title}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Fehler: {f.reason}</div>
              </div>
            ))}
            {duplicateDocs.map(d => (
              <div key={`dup-${d.id}-${Math.random()}`} onClick={onClose} style={{ padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>🔄 Duplikat: {d.title}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>ID {d.id} wurde mehrfach vom Server gemeldet.</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="menu-button" onClick={() => { 
        duplicateDocsSignal.value = null;
        failedDocsSignal.value = failedDocs.map(f => ({ id: f.id, title: f.title }));
        onClose(); 
      }} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
        Alle Fehler in Liste anzeigen
      </button>

      {duplicateDocs.length > 0 && (
        <button className="menu-button" onClick={() => { 
          failedDocsSignal.value = null;
          duplicateDocsSignal.value = duplicateDocs.map(d => ({ id: d.id, title: d.title }));
          onClose(); 
        }} style={{ background: 'rgba(59, 130, 246, 0.2)', color: 'var(--primary)', marginTop: '0.5rem' }}>
          Alle Duplikate in Liste anzeigen
        </button>
      )}

      <button className="menu-button" onClick={() => { setView('menu'); setSyncReport(null); }} style={{ marginTop: '0.5rem' }}>
        Schließen
      </button>
    </div>
  );

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
            <h2>
              {view === 'menu' ? 'Menü' : (view === 'about' ? 'Über & Lizenzen' : 'Synchronisierungs-Bericht')}
            </h2>
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
                  <button className="menu-button logout-btn" onClick={logoutStore} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                    <span className="icon">🚪</span> Abmelden
                  </button>
               </div>
            </div>
          ) : (view === 'about' ? renderAbout() : renderSyncReport())}
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
