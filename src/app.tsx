import { authState, logout, apiSignal } from './store.ts';
import { Login } from './components/Login.tsx';
import { DocumentList } from './components/DocumentList.tsx';
import { MainMenu } from './components/MainMenu.tsx';
import { FilterModal } from './components/FilterModal.tsx';
import { useState, useEffect } from 'preact/hooks';

export function App() {
  const auth = authState.value;
  const [view, setView] = useState<'inbox' | 'list'>('inbox');
  const [isOnline, setIsOnline] = useState(true);
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    if (!auth?.isAuthenticated) return;
    let interval: any;
    
    const checkStatus = async () => {
      const api = apiSignal.value;
      if (!api) return;
      try {
        await api.getTags();
        setIsOnline(true);
      } catch (err) {
        setIsOnline(false);
      }
    };
    
    checkStatus();
    interval = setInterval(checkStatus, 30000);
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
            <button className="icon-button" onClick={() => setMenuOpen(true)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
              </svg>
            </button>
            <h1>Paperless</h1>
            <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} title={isOnline ? 'Verbunden' : 'Nicht verbunden'} />
          </div>
          
          <div className="header-actions">
            <button className="icon-button" onClick={() => setFilterOpen(true)} title="Suchen & Filtern">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </button>

          </div>
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
        </nav>
      </header>
      
      <main>
        {view === 'inbox' && <DocumentList inboxOnly={true} />}
        {view === 'list' && <DocumentList inboxOnly={false} />}
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
      </nav>

      {menuOpen && <MainMenu onClose={() => setMenuOpen(false)} />}
      {filterOpen && <FilterModal onClose={() => setFilterOpen(false)} />}
    </div>
  );
}
