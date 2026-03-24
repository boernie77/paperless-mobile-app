import { useState } from 'preact/hooks';
import { initializeAuth } from '../store.ts';
import { PaperlessAPI } from '../api.ts';

export function Login() {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!url) {
      setError('Bitte die Server-URL ausfüllen.');
      return;
    }
    
    if (!tokenInput && (!username || !password)) {
      setError('Bitte Token ODER Benutzername/Passwort eingeben.');
      return;
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }
    
    setLoading(true);
    setError('');
    
    try {
      let activeToken = tokenInput.trim();
      
      // Wenn kein Token, aber Zugangsdaten da sind -> Token holen
      if (!activeToken && username && password) {
        activeToken = await PaperlessAPI.getToken(formattedUrl, username, password);
      }
      
      const api = new PaperlessAPI(formattedUrl, activeToken);
      await api.getTags(); // Testanfrage

      initializeAuth(formattedUrl, activeToken);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(`Verbindung fehlgeschlagen (${err.message}). Bitte prüfe URL und Zugangsdaten.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Paperless</h1>
        <p>Mit Instanz verbinden</p>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Server URL</label>
            <input 
              type="text" 
              placeholder="z.B. paperless.example.com" 
              value={url}
              onInput={(e) => setUrl((e.target as HTMLInputElement).value)}
            />
          </div>
          
          <div className="divider">ENTWEDER</div>

          <div className="input-group">
            <label>API Token (aus dem Profil)</label>
            <input 
              type="password" 
              placeholder="Dein Token (optional)" 
              value={tokenInput}
              onInput={(e) => setTokenInput((e.target as HTMLInputElement).value)}
            />
          </div>

          <div className="divider">ODER</div>
          
          <div className="input-group">
            <label>Benutzername</label>
            <input 
              type="text" 
              placeholder="Dein Benutzername (optional)" 
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
            />
          </div>

          <div className="input-group">
            <label>Passwort</label>
            <input 
              type="password" 
              placeholder="Dein Passwort (optional)" 
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            />
          </div>
          
          {error && <p className="error-message">{error}</p>}
          
          <button type="submit" className="btn primary-button" style={{ width: '100%', marginTop: '1.5rem' }} disabled={loading}>
            {loading ? 'Prüfe Daten...' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}
