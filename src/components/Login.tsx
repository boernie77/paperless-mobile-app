import { useState } from 'preact/hooks';
import { initializeAuth } from '../store';

export function Login() {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!url || !token) {
      setError('Bitte alle Felder ausfüllen.');
      return;
    }
    
    try {
      initializeAuth(url, token);
    } catch (err) {
      setError('Verbindung fehlgeschlagen.');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Paperless</h1>
        <p>Verbinde dich mit deiner Instanz</p>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Server URL</label>
            <input 
              type="url" 
              placeholder="https://paperless.example.com" 
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
          
          <button type="submit" className="primary-button">Verbinden</button>
        </form>
      </div>
    </div>
  );
}
