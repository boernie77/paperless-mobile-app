import { useEffect, useState } from 'preact/hooks';
import { logout, apiSignal, ownerFilterSignal } from '../store.ts';
import { db } from '../db.ts';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function Settings() {
  const [storageInfo, setStorageInfo] = useState<{ totalBytes: number; docCount: number } | null>(null);
  const [showLicenses, setShowLicenses] = useState(false);
  const [showImprint, setShowImprint] = useState(false);
  const [users, setUsers] = useState<{ id: number; username: string; first_name?: string; last_name?: string }[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<number[] | null>(ownerFilterSignal.value);

  useEffect(() => {
    // Calculate storage
    const calc = async () => {
      const docs = await db.documents.where('is_offline').equals(1).toArray();
      let totalBytes = 0;
      for (const doc of docs) {
        if (doc.blob) totalBytes += doc.blob.size;
        if (doc.thumbnailBlob) totalBytes += doc.thumbnailBlob.size;
      }
      setStorageInfo({ totalBytes, docCount: docs.length });
    };
    calc();

    // Fetch users
    const fetchUsers = async () => {
      const api = apiSignal.value;
      if (!api) return;
      try {
        const res = await api.getUsers();
        setUsers(res.results ?? []);
      } catch { /* no permission or offline */ }
    };
    fetchUsers();
  }, []);

  const toggleOwner = (id: number) => {
    setSelectedOwners(prev => {
      // null = all selected → start deselecting
      const current = prev ?? users.map(u => u.id);
      const next = current.includes(id)
        ? current.filter(x => x !== id)
        : [...current, id];
      // if all selected again → go back to null (no filter)
      const result = next.length === users.length ? null : next;
      ownerFilterSignal.value = result;
      if (result === null) localStorage.removeItem('owner_filter');
      else localStorage.setItem('owner_filter', JSON.stringify(result));
      return result;
    });
  };

  const isOwnerSelected = (id: number) =>
    selectedOwners === null || selectedOwners.includes(id);

  const reportBug = () => {
    window.open('https://github.com/boernie77/paperless-mobile-app/issues/new', '_system');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.25rem 0 5rem 0' }}>

      {/* View / User filter */}
      {users.length > 0 && (
        <section className="settings-section">
          <h2 className="settings-heading">Ansicht</h2>
          <div className="settings-card">
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
              Dokumente folgender Benutzer anzeigen:
            </p>
            {users.map(u => (
              <label key={u.id} className="settings-toggle-row">
                <span>
                  {u.first_name && u.last_name
                    ? `${u.first_name} ${u.last_name}`
                    : u.username}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: '0.4rem' }}>
                    @{u.username}
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="settings-checkbox"
                  checked={isOwnerSelected(u.id)}
                  onChange={() => toggleOwner(u.id)}
                />
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Storage */}
      <section className="settings-section">
        <h2 className="settings-heading">Speicher</h2>
        <div className="settings-card">
          <div className="settings-row">
            <span>Offline-Dokumente</span>
            <strong>{storageInfo?.docCount ?? '…'}</strong>
          </div>
          <div className="settings-row">
            <span>Gesamtgröße</span>
            <strong>{storageInfo != null ? formatBytes(storageInfo.totalBytes) : '…'}</strong>
          </div>
        </div>
      </section>

      {/* Support */}
      <section className="settings-section">
        <h2 className="settings-heading">Support</h2>
        <button className="settings-button" onClick={reportBug}>
          <span className="settings-icon">🐛</span>
          <span style={{ flex: 1 }}>Fehler melden</span>
          <span className="settings-chevron">›</span>
        </button>
      </section>

      {/* About & Licenses */}
      <section className="settings-section">
        <h2 className="settings-heading">Über & Lizenzen</h2>
        <div className="settings-card" style={{ gap: '0.6rem' }}>
          <div className="settings-row">
            <span>Version</span>
            <span style={{ color: 'var(--text-dim)' }}>1.0.1</span>
          </div>

          <button className="settings-button-inline" onClick={() => setShowLicenses(v => !v)}>
            <span>Open-Source-Lizenzen</span>
            <span className="settings-chevron">{showLicenses ? '∨' : '›'}</span>
          </button>
          {showLicenses && (
            <div style={{ fontSize: '0.82rem', lineHeight: '1.8', color: 'var(--text-dim)', paddingLeft: '0.25rem' }}>
              <b style={{ color: 'var(--text)' }}>Preact</b> — MIT<br />
              <b style={{ color: 'var(--text)' }}>@preact/signals</b> — MIT<br />
              <b style={{ color: 'var(--text)' }}>Dexie.js</b> — Apache 2.0<br />
              <b style={{ color: 'var(--text)' }}>PDF.js (pdfjs-dist)</b> — Apache 2.0<br />
              <b style={{ color: 'var(--text)' }}>Capacitor Core</b> — MIT<br />
              <b style={{ color: 'var(--text)' }}>@capacitor/camera</b> — MIT<br />
              <b style={{ color: 'var(--text)' }}>@capacitor/filesystem</b> — MIT<br />
              <b style={{ color: 'var(--text)' }}>@capacitor/preferences</b> — MIT<br />
              <b style={{ color: 'var(--text)' }}>@capacitor-community/file-opener</b> — MIT<br />
              <b style={{ color: 'var(--text)' }}>lucide-preact</b> — ISC<br />
              <b style={{ color: 'var(--text)' }}>Vite</b> — MIT<br />
              <b style={{ color: 'var(--text)' }}>TypeScript</b> — Apache 2.0<br />
              <b style={{ color: 'var(--text)' }}>Paperless-ngx Logo</b> — GPLv3
            </div>
          )}

          <button className="settings-button-inline" onClick={() => setShowImprint(v => !v)}>
            <span>Impressum & Datenschutz</span>
            <span className="settings-chevron">{showImprint ? '∨' : '›'}</span>
          </button>
          {showImprint && (
            <div style={{ fontSize: '0.82rem', lineHeight: '1.7', color: 'var(--text-dim)', paddingLeft: '0.25rem' }}>
              <b style={{ color: 'var(--text)' }}>Verantwortlich gemäß § 5 TMG:</b><br />
              Christian Bernauer<br />
              Dianastr. 2b, 90547 Stein<br />
              christian@bernauer24.com<br /><br />
              <b style={{ color: 'var(--text)' }}>Datenschutz:</b><br />
              Diese App speichert keine personenbezogenen Daten auf externen Servern.
              Alle Daten verbleiben auf deinem Gerät bzw. deinem eigenen Paperless-ngx-Server.
            </div>
          )}
        </div>
      </section>

      {/* Logout */}
      <section className="settings-section">
        <button
          className="settings-button"
          style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}
          onClick={logout}
        >
          <span className="settings-icon">🚪</span>
          <span style={{ flex: 1 }}>Abmelden</span>
        </button>
      </section>

    </div>
  );
}
