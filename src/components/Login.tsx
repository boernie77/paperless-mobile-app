import { useState } from 'preact/hooks';
import { initializeAuth } from '../store.ts';
import { PaperlessAPI } from '../api.ts';

export function Login() {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!url || !token) {
      setError('Bitte alle Felder ausfüllen.');
      return;
    }
    
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'http://' + formattedUrl;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const api = new PaperlessAPI(formattedUrl, token);
      // Führe Testanfrage durch
      await api.getTags();
      initializeAuth(formattedUrl, token);
    } catch (err) {
      console.error('Login error:', err);
      setError('Verbindung fehlgeschlagen. Bitte prüfe URL, Token und Netzwerk.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Paperless</h1>
        <p>Verbinde dich mit deiner Instanz</p>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Server URL oder IP</label>
            <input 
              type="text" 
              placeholder="z.B. https://paperless... oder 192.168..." 
              value={url}
              onInput={(e) => setUrl((e.target as HTMLInputElement).value)}
            />
          </div>
          
          <div className="input-group">
            <label>API Token</label>
            <input 
              type="password" 
              placeholder="Dein geheimer Token" 
              value={token}
              onInput={(e) => setToken((e.target as HTMLInputElement).value)}
            />
          </div>
          
          {error && <p className="error-message">{error}</p>}
          
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Prüfe Verbindung...' : 'Verbinden'}
          </button>
        </form>
      </div>
    </div>
  );
}

