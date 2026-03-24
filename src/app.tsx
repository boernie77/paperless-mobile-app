import { authState, logout } from './store.ts';
import { Login } from './components/Login.tsx';
import { DocumentList } from './components/DocumentList.tsx';
import { CameraUpload } from './components/CameraUpload.tsx';
import { useState } from 'preact/hooks';

export function App() {
  const auth = authState.value;
  const [view, setView] = useState<'list' | 'camera'>('list');

  if (!auth?.isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="app-main">
      <header>
        <div className="header-top">
          <h1>Paperless</h1>
          <button onClick={logout} className="text-button">Abmelden</button>
        </div>
        
        <nav className="sidebar-nav">
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
        {view === 'list' ? <DocumentList /> : <CameraUpload />}
      </main>

      <nav className="bottom-nav">
        <button 
          className={`nav-item ${view === 'list' ? 'active' : ''}`}
          onClick={() => setView('list')}
        >
          Liste
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




