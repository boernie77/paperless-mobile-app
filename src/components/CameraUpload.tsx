import { Camera, CameraResultType } from '@capacitor/camera';
import { apiSignal } from '../store';
import { useState } from 'preact/hooks';

export function CameraUpload() {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  const takePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.Uri
      });

      if (image.webPath) {
        setUploading(true);
        setStatus('Dokument wird hochgeladen...');
        
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        
        const api = apiSignal.value;
        if (api) {
          const fileName = `Scan_${new Date().getTime()}.jpg`;
          await api.uploadDocument(blob, fileName);
          setStatus('Erfolgreich hochgeladen!');
        }
      }
    } catch (err) {
      console.error(err);
      setStatus('Fehler beim Upload.');
    } finally {
      setUploading(false);
      setTimeout(() => setStatus(''), 3000);
    }
  };

  return (
    <div className="camera-upload">
      <button 
        onClick={takePhoto} 
        disabled={uploading}
        className="primary-button fab"
      >
        {uploading ? '...' : '📷 Foto aufnehmen'}
      </button>
      {status && <p className="upload-status">{status}</p>}
    </div>
  );
}
