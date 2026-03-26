import { authState, logout, apiSignal } from './store.ts';
import { Login } from './components/Login.tsx';
import { DocumentList } from './components/DocumentList.tsx';
import { MainMenu } from './components/MainMenu.tsx';
import { FilterModal } from './components/FilterModal.tsx';
import { Settings } from './components/Settings.tsx';
import { useState, useEffect } from 'preact/hooks';

export function App() {
  const auth = authState.value;
  const [view, setView] = useState<'inbox' | 'list' | 'settings'>('inbox');
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
          <button className={`nav-item ${view === 'inbox' ? 'active' : ''}`} onClick={() => setView('inbox')}>
            Posteingang
          </button>
          <button className={`nav-item ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>
            Alle Dokumente
          </button>
          <button className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
            Einstellungen
          </button>
        </nav>
      </header>
      
      <main>
        {view === 'inbox' && <DocumentList inboxOnly={true} />}
        {view === 'list' && <DocumentList inboxOnly={false} />}
        {view === 'settings' && <Settings />}
      </main>

      <nav className="bottom-nav">
        <button
          className={`nav-item ${view === 'inbox' ? 'active' : ''}`}
          onClick={() => setView('inbox')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block', margin: '0 auto 2px' }}>
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5v-3h3.56c.69 1.19 1.97 2 3.45 2s2.75-.81 3.45-2H19v3zm0-5h-4.99c0 1.1-.9 2-2.01 2s-2.01-.9-2.01-2H5V5h14v9z"/>
          </svg>
          Inbox
        </button>
        <button
          className={`nav-item ${view === 'list' ? 'active' : ''}`}
          onClick={() => setView('list')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block', margin: '0 auto 2px' }}>
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-5 6h8v2H8v-2zm0-4h8v2H8v-2z"/>
          </svg>
          Dokumente
        </button>
        <button
          className={`nav-item ${view === 'settings' ? 'active' : ''}`}
          onClick={() => setView('settings')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block', margin: '0 auto 2px' }}>
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
          Einstellungen
        </button>
      </nav>

      {menuOpen && <MainMenu onClose={() => setMenuOpen(false)} />}
      {filterOpen && <FilterModal onClose={() => setFilterOpen(false)} />}
    </div>
  );
}
