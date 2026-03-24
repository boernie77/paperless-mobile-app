import { useState } from 'preact/hooks';
import { initializeAuth } from '../store.ts';
import { PaperlessAPI } from '../api.ts';

export function Login() {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!url || !username || !password) {
      setError('Bitte alle Felder ausfüllen.');
      return;
    }
    
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl; // Standard HTTPS bevorzugen
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Token über API holen
      const token = await PaperlessAPI.getToken(formattedUrl, username, password);
      
      const api = new PaperlessAPI(formattedUrl, token);
      await api.getTags(); // Führe Testanfrage durch
      initializeAuth(formattedUrl, token);
    } catch (err) {
      console.error('Login error:', err);
      setError('Verbindung fehlgeschlagen. Bitte prüfe URL, Benutzername und Passwort.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Paperless</h1>
        <p>Mit Benutzerkonto anmelden</p>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Server URL</label>
            <input 
              type="text" 
              placeholder="z.B. paper.bernauer24.com" 
              value={url}
              onInput={(e) => setUrl((e.target as HTMLInputElement).value)}
            />
          </div>
          
          <div className="input-group">
            <label>Benutzername</label>
            <input 
              type="text" 
              placeholder="Dein Benutzername" 
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
            />
          </div>

          <div className="input-group">
            <label>Passwort</label>
            <input 
              type="password" 
              placeholder="Dein Passwort" 
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            />
          </div>
          
          {error && <p className="error-message">{error}</p>}
          
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Prüfe Daten...' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}


