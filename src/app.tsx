import { authState, logout, apiSignal } from './store.ts';
import { Login } from './components/Login.tsx';
import { DocumentList } from './components/DocumentList.tsx';
import { CameraUpload } from './components/CameraUpload.tsx';
import { useState, useEffect } from 'preact/hooks';

export function App() {
  const auth = authState.value;
  const [view, setView] = useState<'inbox' | 'list' | 'camera'>('inbox');
  const [isOnline, setIsOnline] = useState(true);

  // Einfacher Ping um Online-Status zu prüfen
  useEffect(() => {
    if (!auth?.isAuthenticated) return;
    let interval: any;
    
    const checkStatus = async () => {
      const api = apiSignal.value;
      if (!api) return;
      try {
        await api.getTags(); // Leichtgewichtiger Endpunkt
        setIsOnline(true);
      } catch (err) {
        setIsOnline(false);
      }
    };
    
    checkStatus();
    interval = setInterval(checkStatus, 30000); // Check all 30s
    return () => clearInterval(interval);
  }, [auth?.isAuthenticated]);

  if (!auth?.isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="app-main">
      <header>
        <div className="header-top">
          <div className="title-group">
            <h1>Paperless</h1>
            <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Verbunden' : 'Nicht verbunden'} />
          </div>
          <button onClick={logout} className="text-button">Abmelden</button>
        </div>
        
        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${view === 'inbox' ? 'active' : ''}`}
            onClick={() => setView('inbox')}
          >
            Posteingang
          </button>
          <button 
            className={`nav-item ${view === 'list' ? 'active' : ''}`}
            onClick={() => setView('list')}
          >
            Alle Dokumente
          </button>
          <button 
            className={`nav-item ${view === 'camera' ? 'active' : ''}`}
            onClick={() => setView('camera')}
          >
            Scan hochladen
          </button>
        </nav>
      </header>
      
      <main>
        {view === 'inbox' && <DocumentList inboxOnly={true} />}
        {view === 'list' && <DocumentList inboxOnly={false} />}
        {view === 'camera' && <CameraUpload />}
      </main>

      <nav className="bottom-nav">
        <button 
          className={`nav-item ${view === 'inbox' ? 'active' : ''}`}
          onClick={() => setView('inbox')}
        >
          Inbox
        </button>
        <button 
          className={`nav-item ${view === 'list' ? 'active' : ''}`}
          onClick={() => setView('list')}
        >
          Dokumente
        </button>
        <button 
          className={`nav-item ${view === 'camera' ? 'active' : ''}`}
          onClick={() => setView('camera')}
        >
          Foto
        </button>
      </nav>
    </div>
  );
}





